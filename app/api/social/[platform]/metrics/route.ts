/**
 * GET /api/social/[platform]/metrics
 *
 * Métricas EN VIVO de la cuenta conectada (sin tabla de snapshots). Todo se
 * deriva de perfil + media (no usa insights de cuenta, que requieren App Review).
 *
 * Adaptativo: si la media tiene views (videos/reels) las métricas se calculan
 * sobre views; si son imágenes (sin views) se calculan sobre interacciones
 * (likes + comentarios). El engagement siempre es sobre seguidores → nunca 0.
 */
import { NextRequest, NextResponse } from "next/server"
import { resolveSocialScope } from "@/lib/social/scope"
import { isSocialPlatform } from "@/lib/social/oauth"
import { getConnection, getValidYouTubeToken } from "@/lib/social/connection"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

interface MediaItem {
  id: string; thumbnail: string | null; permalink: string; caption: string
  likes: number; comments: number; views: number; reach?: number; type: string; timestamp: string | null
}

/** Corre fn sobre items con concurrencia limitada. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
      }
    }),
  )
  return out
}
interface Stat { label: string; value: string; sub?: string }

function fmt(n: number): string {
  if (!isFinite(n)) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}
const pct = (n: number) => `${(isFinite(n) ? n : 0).toFixed(1)}%`
const avg = (a: number[]) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0)
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

/**
 * Métricas detalladas calculadas desde la media. `followers` para el engagement.
 * `unit` = "reel" | "video" para los textos.
 */
function detailedFromMedia(media: MediaItem[], followers: number, unit: string): Stat[] {
  const n = media.length
  if (!n) return []
  const unitPl = unit === "video" ? "videos" : "publicaciones"

  const totalViews = media.reduce((s, m) => s + m.views, 0)
  const hasViews = totalViews > 0
  const interactions = media.map((m) => m.likes + m.comments)
  const totalLikes = media.reduce((s, m) => s + m.likes, 0)
  const totalComments = media.reduce((s, m) => s + m.comments, 0)

  // Métrica primaria: views si hay, si no interacciones
  const primary = hasViews ? media.map((m) => m.views) : interactions
  const avgPrimary = avg(primary)
  const maxPrimary = Math.max(...primary)
  const viral = primary.filter((v) => v > avgPrimary * 1.5).length
  const viralPct = Math.round((viral / n) * 100)
  const primaryLabel = hasViews ? "Views" : "Interacciones"

  const avgInteractions = avg(interactions)
  const engagement = followers > 0 ? (avgInteractions / followers) * 100 : 0

  const now = Date.now()
  const last30 = media.filter((m) => m.timestamp && now - new Date(m.timestamp).getTime() < 30 * 86_400_000).length

  const wd = Array.from({ length: 7 }, () => ({ eng: 0, count: 0 }))
  for (const m of media) {
    if (m.timestamp) { const d = new Date(m.timestamp).getDay(); wd[d].eng += m.likes + m.comments; wd[d].count++ }
  }
  let bestDay = "—", bestEng = -1
  wd.forEach((b, i) => { if (b.count > 0 && b.eng / b.count > bestEng) { bestEng = b.eng / b.count; bestDay = WEEKDAYS[i] } })

  const stats: Stat[] = [
    { label: `${primaryLabel} promedio`, value: fmt(avgPrimary), sub: `por ${unit}` },
    { label: `${primaryLabel} mediana`, value: fmt(median(primary)), sub: `el ${unit} típico` },
    { label: "Mejor publicación", value: fmt(maxPrimary), sub: avgPrimary > 0 ? `${Math.round((maxPrimary / avgPrimary - 1) * 100)}% sobre prom.` : undefined },
    { label: "Likes promedio", value: fmt(totalLikes / n) },
    { label: "Comentarios prom.", value: fmt(totalComments / n) },
    { label: "Engagement", value: pct(engagement), sub: "interacciones / seguidores" },
    { label: "Virales", value: `${viralPct}%`, sub: `${viral} de ${n} superan 1.5× prom.` },
    { label: "Cadencia", value: String(last30), sub: `${unitPl} (últimos 30 días)` },
    { label: "Mejor día", value: bestDay, sub: "mayor engagement" },
  ]
  return stats
}

// ─── Instagram ────────────────────────────────────────────────────────────────
const IG_BASE = "https://graph.instagram.com/v23.0"

/** Views + reach de una media vía el endpoint de insights (el campo directo `views` no existe). */
async function igMediaInsights(mediaId: string, token: string): Promise<{ views: number; reach: number }> {
  const parse = (json: any) => {
    const out = { views: 0, reach: 0 }
    for (const d of json?.data ?? []) {
      const v = d?.values?.[0]?.value ?? 0
      if (d?.name === "views") out.views = v
      if (d?.name === "reach") out.reach = v
    }
    return out
  }
  try {
    let res = await fetch(`${IG_BASE}/${mediaId}/insights?metric=views,reach&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(8_000) })
    if (res.ok) return parse(await res.json())
    // Algunos tipos de media no soportan `views` → reintentar solo con reach
    res = await fetch(`${IG_BASE}/${mediaId}/insights?metric=reach&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(8_000) })
    if (res.ok) return parse(await res.json())
  } catch { /* best-effort */ }
  return { views: 0, reach: 0 }
}

async function instagramMetrics(accessToken: string) {
  const enc = encodeURIComponent(accessToken)
  const profileRes = await fetch(
    `${IG_BASE}/me?fields=followers_count,media_count&access_token=${enc}`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!profileRes.ok) throw new Error(`IG profile ${profileRes.status}`)
  const profile = (await profileRes.json()) as { followers_count?: number; media_count?: number }

  // Media reciente (hasta 24 para mantener el fetch de insights rápido)
  const mediaRes = await fetch(
    `${IG_BASE}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=24&access_token=${enc}`,
    { signal: AbortSignal.timeout(10_000) },
  )
  const mediaData = mediaRes.ok ? ((await mediaRes.json()) as { data?: Array<Record<string, any>> }) : { data: [] }
  const media: MediaItem[] = (mediaData.data ?? []).map((m) => ({
    id: String(m.id),
    thumbnail: m.media_type === "VIDEO" ? (m.thumbnail_url ?? m.media_url ?? null) : (m.media_url ?? null),
    permalink: m.permalink ?? "#",
    caption: (m.caption ?? "").slice(0, 140),
    likes: m.like_count ?? 0,
    comments: m.comments_count ?? 0,
    views: 0,
    type: m.media_type ?? "IMAGE",
    timestamp: m.timestamp ?? null,
  }))

  // Views + reach reales por media (insights), con concurrencia limitada
  const insights = await mapLimit(media, 8, (m) => igMediaInsights(m.id, accessToken))
  media.forEach((m, i) => { m.views = insights[i].views; m.reach = insights[i].reach })

  const followers = profile.followers_count ?? 0
  const posts = profile.media_count ?? 0
  const totalViews = media.reduce((s, m) => s + m.views, 0)
  const totalReach = media.reduce((s, m) => s + (m.reach ?? 0), 0)
  const totalLikes = media.reduce((s, m) => s + m.likes, 0)
  const totalComments = media.reduce((s, m) => s + m.comments, 0)
  const avgInteractions = media.length ? (totalLikes + totalComments) / media.length : 0
  const engagement = followers > 0 ? (avgInteractions / followers) * 100 : 0

  const overview: Stat[] = [
    { label: "Seguidores", value: fmt(followers) },
    { label: "Publicaciones", value: fmt(posts) },
    { label: "Engagement", value: pct(engagement) },
  ]
  if (totalViews > 0) overview.push({ label: "Views (recientes)", value: fmt(totalViews) })
  if (totalReach > 0) overview.push({ label: "Alcance (recientes)", value: fmt(totalReach) })
  overview.push({ label: "Likes promedio", value: fmt(media.length ? totalLikes / media.length : 0) })

  return { overview, detailed: detailedFromMedia(media, followers, "reel"), media }
}

// ─── YouTube ──────────────────────────────────────────────────────────────────
async function youtubeMetrics(accessToken: string) {
  const auth = { Authorization: `Bearer ${accessToken}` }
  const chRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&mine=true",
    { headers: auth, signal: AbortSignal.timeout(10_000) },
  )
  if (!chRes.ok) throw new Error(`YT channel ${chRes.status}`)
  const chData = (await chRes.json()) as {
    items?: Array<{ statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }>
  }
  const ch = chData.items?.[0]
  const subs = Number(ch?.statistics?.subscriberCount ?? 0)
  const totalChannelViews = Number(ch?.statistics?.viewCount ?? 0)
  const videoCount = Number(ch?.statistics?.videoCount ?? 0)
  const uploads = ch?.contentDetails?.relatedPlaylists?.uploads

  const media: MediaItem[] = []
  if (uploads) {
    const plRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=50`,
      { headers: auth, signal: AbortSignal.timeout(10_000) },
    )
    if (plRes.ok) {
      const plData = (await plRes.json()) as { items?: Array<{ contentDetails?: { videoId?: string } }> }
      const ids = (plData.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean).join(",")
      if (ids) {
        const vRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids}`,
          { headers: auth, signal: AbortSignal.timeout(10_000) },
        )
        if (vRes.ok) {
          const vData = (await vRes.json()) as { items?: Array<Record<string, any>> }
          for (const v of vData.items ?? []) {
            media.push({
              id: String(v.id),
              thumbnail: v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
              permalink: `https://www.youtube.com/watch?v=${v.id}`,
              caption: (v.snippet?.title ?? "").slice(0, 140),
              likes: Number(v.statistics?.likeCount ?? 0),
              comments: Number(v.statistics?.commentCount ?? 0),
              views: Number(v.statistics?.viewCount ?? 0),
              type: "VIDEO",
              timestamp: v.snippet?.publishedAt ?? null,
            })
          }
        }
      }
    }
  }

  const avgPerVideo = videoCount > 0 ? totalChannelViews / videoCount : 0
  const syncedAvg = media.length ? avg(media.map((m) => m.views)) : 0
  const growth = avgPerVideo > 0 && syncedAvg > 0 ? Math.round((syncedAvg / avgPerVideo - 1) * 100) : null

  const overview: Stat[] = [
    { label: "Suscriptores", value: fmt(subs) },
    { label: "Vistas totales", value: fmt(totalChannelViews) },
    { label: "Videos", value: fmt(videoCount) },
    { label: "Promedio/video", value: avgPerVideo > 0 ? fmt(avgPerVideo) : "—" },
    { label: "Crecimiento", value: growth !== null ? `${growth > 0 ? "+" : ""}${growth}%` : "—" },
  ]
  return { overview, detailed: detailedFromMedia(media, subs, "video"), media }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params
  if (!isSocialPlatform(platform)) return NextResponse.json({ error: "Plataforma no válida" }, { status: 400 })

  const scope = await resolveSocialScope(req, req.nextUrl.searchParams.get("client_id"))
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

  const conn = await getConnection(scope.clientId, platform)
  if (!conn) return NextResponse.json({ connected: false })
  const account = { name: conn.accountName, pic: conn.accountPic }

  try {
    if (platform === "instagram") {
      const r = await instagramMetrics(conn.accessToken)
      return NextResponse.json({ connected: true, platform, account, ...r })
    } else {
      const token = await getValidYouTubeToken(scope.clientId, conn)
      if (!token) return NextResponse.json({ connected: true, platform, account, overview: [], detailed: [], media: [], note: "reconnect" })
      const r = await youtubeMetrics(token)
      return NextResponse.json({ connected: true, platform, account, ...r })
    }
  } catch (e) {
    console.error(`[social/${platform}/metrics] error:`, e instanceof Error ? e.message : e)
    return NextResponse.json({ connected: true, platform, account, overview: [], detailed: [], media: [], note: "error" })
  }
}
