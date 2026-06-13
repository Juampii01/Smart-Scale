/**
 * GET /api/social/[platform]/metrics
 *
 * Trae métricas EN VIVO de la cuenta conectada (sin tabla de snapshots):
 *  - Instagram: Graph API (graph.instagram.com) — seguidores, posts, media reciente.
 *  - YouTube: Data API v3 — suscriptores, vistas, videos, videos recientes.
 * Devuelve KPIs normalizados + grilla de media. Degrada con `note` si algo falla.
 */
import { NextRequest, NextResponse } from "next/server"
import { resolveSocialScope } from "@/lib/social/scope"
import { isSocialPlatform } from "@/lib/social/oauth"
import { getConnection, getValidYouTubeToken } from "@/lib/social/connection"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface Kpi { key: string; label: string; value: number; format?: "int" | "pct" | "float"; }
interface MediaItem {
  id: string; thumbnail: string | null; permalink: string; caption: string;
  likes: number; comments: number; views?: number; type: string; timestamp: string | null;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

// ─── Instagram ────────────────────────────────────────────────────────────────
async function instagramMetrics(accessToken: string) {
  const base = "https://graph.instagram.com/v23.0"
  const profileRes = await fetch(
    `${base}/me?fields=followers_count,media_count,username,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!profileRes.ok) throw new Error(`IG profile ${profileRes.status}`)
  const profile = (await profileRes.json()) as { followers_count?: number; media_count?: number; username?: string; profile_picture_url?: string }

  let media: MediaItem[] = []
  try {
    const mediaRes = await fetch(
      `${base}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=12&access_token=${encodeURIComponent(accessToken)}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (mediaRes.ok) {
      const data = (await mediaRes.json()) as { data?: Array<Record<string, any>> }
      media = (data.data ?? []).map((m) => ({
        id: String(m.id),
        thumbnail: m.media_type === "VIDEO" ? (m.thumbnail_url ?? m.media_url ?? null) : (m.media_url ?? null),
        permalink: m.permalink ?? "#",
        caption: (m.caption ?? "").slice(0, 140),
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
        type: m.media_type ?? "IMAGE",
        timestamp: m.timestamp ?? null,
      }))
    }
  } catch { /* media best-effort */ }

  const followers = profile.followers_count ?? 0
  const posts = profile.media_count ?? 0
  const avgLikes = avg(media.map((m) => m.likes))
  const avgComments = avg(media.map((m) => m.comments))
  const engagement = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0

  const kpis: Kpi[] = [
    { key: "followers", label: "Seguidores", value: followers, format: "int" },
    { key: "posts", label: "Publicaciones", value: posts, format: "int" },
    { key: "avg_likes", label: "Likes promedio", value: Math.round(avgLikes), format: "int" },
    { key: "avg_comments", label: "Comentarios promedio", value: Math.round(avgComments), format: "int" },
    { key: "engagement", label: "Engagement", value: engagement, format: "pct" },
  ]
  return { kpis, media }
}

// ─── YouTube ──────────────────────────────────────────────────────────────────
async function youtubeMetrics(accessToken: string) {
  const auth = { Authorization: `Bearer ${accessToken}` }
  const chRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&mine=true",
    { headers: auth, signal: AbortSignal.timeout(10_000) },
  )
  if (!chRes.ok) throw new Error(`YT channel ${chRes.status}`)
  const chData = (await chRes.json()) as {
    items?: Array<{
      statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string }
      contentDetails?: { relatedPlaylists?: { uploads?: string } }
    }>
  }
  const ch = chData.items?.[0]
  const subs = Number(ch?.statistics?.subscriberCount ?? 0)
  const views = Number(ch?.statistics?.viewCount ?? 0)
  const videoCount = Number(ch?.statistics?.videoCount ?? 0)
  const uploads = ch?.contentDetails?.relatedPlaylists?.uploads

  let media: MediaItem[] = []
  if (uploads) {
    try {
      const plRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=12`,
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
            media = (vData.items ?? []).map((v) => ({
              id: String(v.id),
              thumbnail: v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
              permalink: `https://www.youtube.com/watch?v=${v.id}`,
              caption: (v.snippet?.title ?? "").slice(0, 140),
              likes: Number(v.statistics?.likeCount ?? 0),
              comments: Number(v.statistics?.commentCount ?? 0),
              views: Number(v.statistics?.viewCount ?? 0),
              type: "VIDEO",
              timestamp: v.snippet?.publishedAt ?? null,
            }))
          }
        }
      }
    } catch { /* media best-effort */ }
  }

  const avgViews = videoCount > 0 ? views / videoCount : 0
  const kpis: Kpi[] = [
    { key: "subscribers", label: "Suscriptores", value: subs, format: "int" },
    { key: "views", label: "Vistas totales", value: views, format: "int" },
    { key: "videos", label: "Videos", value: videoCount, format: "int" },
    { key: "avg_views", label: "Vistas promedio", value: Math.round(avgViews), format: "int" },
  ]
  return { kpis, media }
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
      const { kpis, media } = await instagramMetrics(conn.accessToken)
      return NextResponse.json({ connected: true, platform, account, kpis, media })
    } else {
      const token = await getValidYouTubeToken(scope.clientId, conn)
      if (!token) return NextResponse.json({ connected: true, platform, account, kpis: [], media: [], note: "reconnect" })
      const { kpis, media } = await youtubeMetrics(token)
      return NextResponse.json({ connected: true, platform, account, kpis, media })
    }
  } catch (e) {
    console.error(`[social/${platform}/metrics] error:`, e instanceof Error ? e.message : e)
    return NextResponse.json({ connected: true, platform, account, kpis: [], media: [], note: "error" })
  }
}
