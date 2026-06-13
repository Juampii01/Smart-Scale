/**
 * GET /api/social/[platform]/metrics
 *
 * Métricas EN VIVO de la cuenta conectada (sin tabla de snapshots), agrupadas
 * por mes de publicación. Todo se deriva de perfil + media:
 *  - current: números de cuenta (seguidores/suscriptores, vistas totales…) — punto en el tiempo.
 *  - buckets: "Total" + un bucket por mes con overview + métricas detalladas + media.
 *
 * IG: las views/alcance por post salen del endpoint de insights (el campo directo no existe).
 */
import { NextRequest, NextResponse } from "next/server"
import { resolveSocialScope } from "@/lib/social/scope"
import { isSocialPlatform } from "@/lib/social/oauth"
import { getConnection, getValidYouTubeToken } from "@/lib/social/connection"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

interface MediaItem {
  id: string; thumbnail: string | null; permalink: string; caption: string
  likes: number; comments: number; views: number; reach?: number; type: string; timestamp: string | null
}
interface Stat { label: string; value: string; sub?: string }
interface Bucket { key: string; label: string; count: number; overview: Stat[]; detailed: Stat[]; media: MediaItem[] }

const fmt = (n: number): string => {
  if (!isFinite(n)) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}
const pct = (n: number) => `${(isFinite(n) ? n : 0).toFixed(1)}%`
const avg = (a: number[]) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0)
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const monthLabel = (ym: string) => { const [y, m] = ym.split("-"); const name = MONTHS[Number(m) - 1] ?? ""; return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}` }

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]) }
  }))
  return out
}

/** Métricas detalladas calculadas desde la media de un bucket. */
function detailed(media: MediaItem[], followers: number, unit: string): Stat[] {
  const n = media.length
  if (!n) return []
  const totalViews = media.reduce((s, m) => s + m.views, 0)
  const hasViews = totalViews > 0
  const interactions = media.map((m) => m.likes + m.comments)
  const totalLikes = media.reduce((s, m) => s + m.likes, 0)
  const totalComments = media.reduce((s, m) => s + m.comments, 0)
  const primary = hasViews ? media.map((m) => m.views) : interactions
  const avgPrimary = avg(primary)
  const maxPrimary = Math.max(...primary)
  const viral = primary.filter((v) => v > avgPrimary * 1.5).length
  const label = hasViews ? "Views" : "Interacciones"
  const avgInteractions = avg(interactions)
  const engagement = followers > 0 ? (avgInteractions / followers) * 100 : 0

  const wd = Array.from({ length: 7 }, () => ({ eng: 0, count: 0 }))
  for (const m of media) if (m.timestamp) { const d = new Date(m.timestamp).getDay(); wd[d].eng += m.likes + m.comments; wd[d].count++ }
  let bestDay = "—", bestEng = -1
  wd.forEach((b, i) => { if (b.count > 0 && b.eng / b.count > bestEng) { bestEng = b.eng / b.count; bestDay = WEEKDAYS[i] } })

  return [
    { label: `${label} promedio`, value: fmt(avgPrimary), sub: `por ${unit}` },
    { label: `${label} mediana`, value: fmt(median(primary)), sub: `el ${unit} típico` },
    { label: "Mejor publicación", value: fmt(maxPrimary), sub: avgPrimary > 0 ? `${Math.round((maxPrimary / avgPrimary - 1) * 100)}% sobre prom.` : undefined },
    { label: "Likes promedio", value: fmt(totalLikes / n) },
    { label: "Comentarios prom.", value: fmt(totalComments / n) },
    { label: "Engagement", value: pct(engagement), sub: "interacciones / seguidores" },
    { label: "Virales", value: `${Math.round((viral / n) * 100)}%`, sub: `${viral} de ${n} superan 1.5× prom.` },
    { label: "Mejor día", value: bestDay, sub: "mayor engagement" },
  ]
}

/** Overview de un bucket (totales del período). */
function overviewOf(media: MediaItem[], followers: number, unit: string): Stat[] {
  const n = media.length
  const totalViews = media.reduce((s, m) => s + m.views, 0)
  const totalReach = media.reduce((s, m) => s + (m.reach ?? 0), 0)
  const totalLikes = media.reduce((s, m) => s + m.likes, 0)
  const totalComments = media.reduce((s, m) => s + m.comments, 0)
  const engagement = followers > 0 ? (avg(media.map((m) => m.likes + m.comments)) / followers) * 100 : 0
  const out: Stat[] = [{ label: unit === "video" ? "Videos" : "Publicaciones", value: fmt(n) }]
  if (totalViews > 0) out.push({ label: "Views", value: fmt(totalViews) })
  if (totalReach > 0) out.push({ label: "Alcance", value: fmt(totalReach) })
  out.push({ label: "Likes", value: fmt(totalLikes) })
  out.push({ label: "Comentarios", value: fmt(totalComments) })
  out.push({ label: "Engagement", value: pct(engagement) })
  return out
}

/** Construye "Total" + un bucket por mes de publicación. */
function buildBuckets(media: MediaItem[], followers: number, unit: string): Bucket[] {
  const byMonth = new Map<string, MediaItem[]>()
  for (const m of media) {
    const ym = m.timestamp ? m.timestamp.slice(0, 7) : "sin-fecha"
    if (!byMonth.has(ym)) byMonth.set(ym, [])
    byMonth.get(ym)!.push(m)
  }
  const buckets: Bucket[] = [
    { key: "total", label: "Total", count: media.length, overview: overviewOf(media, followers, unit), detailed: detailed(media, followers, unit), media },
  ]
  const months = [...byMonth.keys()].filter((k) => k !== "sin-fecha").sort().reverse()
  for (const ym of months) {
    const mm = byMonth.get(ym)!
    buckets.push({ key: ym, label: monthLabel(ym), count: mm.length, overview: overviewOf(mm, followers, unit), detailed: detailed(mm, followers, unit), media: mm })
  }
  return buckets
}

// ─── Instagram ────────────────────────────────────────────────────────────────
const IG_BASE = "https://graph.instagram.com/v23.0"

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
    res = await fetch(`${IG_BASE}/${mediaId}/insights?metric=reach&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(8_000) })
    if (res.ok) return parse(await res.json())
  } catch { /* best-effort */ }
  return { views: 0, reach: 0 }
}

async function instagramData(accessToken: string) {
  const enc = encodeURIComponent(accessToken)
  const profileRes = await fetch(`${IG_BASE}/me?fields=followers_count,media_count&access_token=${enc}`, { signal: AbortSignal.timeout(10_000) })
  if (!profileRes.ok) throw new Error(`IG profile ${profileRes.status}`)
  const profile = (await profileRes.json()) as { followers_count?: number; media_count?: number }

  // Hasta ~60 publicaciones (2 páginas) para cubrir varios meses
  const media: MediaItem[] = []
  let url = `${IG_BASE}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=50&access_token=${enc}`
  for (let page = 0; page < 2 && url && media.length < 60; page++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) break
    const data = (await res.json()) as { data?: Array<Record<string, any>>; paging?: { next?: string } }
    for (const m of data.data ?? []) {
      media.push({
        id: String(m.id),
        thumbnail: m.media_type === "VIDEO" ? (m.thumbnail_url ?? m.media_url ?? null) : (m.media_url ?? null),
        permalink: m.permalink ?? "#",
        caption: (m.caption ?? "").slice(0, 140),
        likes: m.like_count ?? 0, comments: m.comments_count ?? 0, views: 0,
        type: m.media_type ?? "IMAGE", timestamp: m.timestamp ?? null,
      })
    }
    url = data.paging?.next ?? ""
  }
  const slice = media.slice(0, 60)
  const insights = await mapLimit(slice, 10, (m) => igMediaInsights(m.id, accessToken))
  slice.forEach((m, i) => { m.views = insights[i].views; m.reach = insights[i].reach })

  const followers = profile.followers_count ?? 0
  const current: Stat[] = [
    { label: "Seguidores", value: fmt(followers) },
    { label: "Publicaciones totales", value: fmt(profile.media_count ?? 0) },
  ]
  return { current, buckets: buildBuckets(slice, followers, "reel") }
}

// ─── YouTube ──────────────────────────────────────────────────────────────────
async function youtubeData(accessToken: string) {
  const auth = { Authorization: `Bearer ${accessToken}` }
  const chRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&mine=true", { headers: auth, signal: AbortSignal.timeout(10_000) })
  if (!chRes.ok) throw new Error(`YT channel ${chRes.status}`)
  const chData = (await chRes.json()) as { items?: Array<{ statistics?: any; contentDetails?: { relatedPlaylists?: { uploads?: string } } }> }
  const ch = chData.items?.[0]
  const subs = Number(ch?.statistics?.subscriberCount ?? 0)
  const totalViews = Number(ch?.statistics?.viewCount ?? 0)
  const videoCount = Number(ch?.statistics?.videoCount ?? 0)
  const uploads = ch?.contentDetails?.relatedPlaylists?.uploads

  const media: MediaItem[] = []
  if (uploads) {
    const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=50`, { headers: auth, signal: AbortSignal.timeout(10_000) })
    if (plRes.ok) {
      const plData = (await plRes.json()) as { items?: Array<{ contentDetails?: { videoId?: string } }> }
      const ids = (plData.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean).join(",")
      if (ids) {
        const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids}`, { headers: auth, signal: AbortSignal.timeout(10_000) })
        if (vRes.ok) {
          const vData = (await vRes.json()) as { items?: Array<Record<string, any>> }
          for (const v of vData.items ?? []) media.push({
            id: String(v.id),
            thumbnail: v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
            permalink: `https://www.youtube.com/watch?v=${v.id}`,
            caption: (v.snippet?.title ?? "").slice(0, 140),
            likes: Number(v.statistics?.likeCount ?? 0), comments: Number(v.statistics?.commentCount ?? 0),
            views: Number(v.statistics?.viewCount ?? 0), type: "VIDEO", timestamp: v.snippet?.publishedAt ?? null,
          })
        }
      }
    }
  }
  const current: Stat[] = [
    { label: "Suscriptores", value: fmt(subs) },
    { label: "Vistas totales", value: fmt(totalViews) },
    { label: "Videos", value: fmt(videoCount) },
  ]
  return { current, buckets: buildBuckets(media, subs, "video") }
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
      const r = await instagramData(conn.accessToken)
      return NextResponse.json({ connected: true, platform, account, ...r })
    } else {
      const token = await getValidYouTubeToken(scope.clientId, conn)
      if (!token) return NextResponse.json({ connected: true, platform, account, current: [], buckets: [], note: "reconnect" })
      const r = await youtubeData(token)
      return NextResponse.json({ connected: true, platform, account, ...r })
    }
  } catch (e) {
    console.error(`[social/${platform}/metrics] error:`, e instanceof Error ? e.message : e)
    return NextResponse.json({ connected: true, platform, account, current: [], buckets: [], note: "error" })
  }
}
