import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// ─── Duration helper ──────────────────────────────────────────────────────────

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return "—"
  const h = m[1] ? `${m[1]}:` : ""
  const min = (m[2] ?? "0").padStart(h ? 2 : 1, "0")
  const sec = (m[3] ?? "0").padStart(2, "0")
  return `${h}${min}:${sec}`
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

async function resolveChannelId(url: string) {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error("Missing YOUTUBE_API_KEY")

  const channelMatch = url.match(/channel\/([^\/\?&]+)/)
  const handleMatch  = url.match(/@([^\/\?&]+)/)
  const userMatch    = url.match(/user\/([^\/\?&]+)/)
  let channelId = ""

  if (channelMatch) {
    channelId = channelMatch[1]
  } else {
    const query = handleMatch ? `@${handleMatch[1]}` : userMatch ? userMatch[1] : url
    const res   = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${key}`
    )
    const data  = await res.json()
    channelId   = data.items?.[0]?.snippet?.channelId ?? data.items?.[0]?.id?.channelId ?? ""
  }

  if (!channelId) throw new Error("No se pudo resolver el canal de YouTube. Verificá la URL.")

  const chRes  = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${key}`)
  const chData = await chRes.json()
  const ch     = chData.items?.[0]

  return {
    channelId,
    channelName:   ch?.snippet?.title ?? "Canal",
    channelAvatar: ch?.snippet?.thumbnails?.default?.url ?? null,
    channelUrl:    `https://www.youtube.com/channel/${channelId}`,
  }
}

async function getTopVideos(channelId: string, timeframeDays: number) {
  const key            = process.env.YOUTUBE_API_KEY!
  const publishedAfter = new Date(Date.now() - timeframeDays * 86_400_000).toISOString()

  const searchRes  = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=50&publishedAfter=${encodeURIComponent(publishedAfter)}&key=${key}`
  )
  const searchData = await searchRes.json()
  const videoIds: string[] = (searchData.items ?? []).map((v: any) => v.id?.videoId).filter(Boolean)
  if (!videoIds.length) return []

  const statsRes  = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.join(",")}&key=${key}`
  )
  const statsData = await statsRes.json()

  return (statsData.items ?? [])
    .map((v: any) => ({
      video_id:     v.id,
      title:        v.snippet?.title ?? "",
      description:  (v.snippet?.description ?? "").slice(0, 300),
      thumbnail:    v.snippet?.thumbnails?.high?.url ?? v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
      video_url:    `https://www.youtube.com/watch?v=${v.id}`,
      views:        Number(v.statistics?.viewCount  ?? 0),
      likes:        Number(v.statistics?.likeCount  ?? 0),
      comments:     Number(v.statistics?.commentCount ?? 0),
      duration:     parseDuration(v.contentDetails?.duration ?? ""),
      published_at: v.snippet?.publishedAt ?? null,
      transcript:   null,
    }))
    .sort((a: any, b: any) => b.views - a.views)
    .slice(0, 5)
}

// ─── Instagram ────────────────────────────────────────────────────────────────

function extractInstagramUsername(url: string): string | null {
  const m = url.match(/instagram\.com\/([^\/\?&]+)/)
  const user = m?.[1]
  if (!user || ["p", "reel", "tv", "reels", "stories"].includes(user)) return null
  return user
}

async function scrapeInstagramProfile(username: string): Promise<any[]> {
  // Primary: Instagram unofficial web API (no auth, works from most servers)
  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "es,en;q=0.9",
          "X-IG-App-ID": "936619743392459",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": `https://www.instagram.com/${username}/`,
        },
        signal: AbortSignal.timeout(15_000),
      }
    )
    if (res.ok) {
      const data  = await res.json()
      const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
      if (edges.length > 0) {
        return edges.map((e: any) => {
          const n = e.node
          return {
            id:             n.id,
            shortCode:      n.shortcode,
            caption:        n.edge_media_to_caption?.edges?.[0]?.node?.text ?? "",
            timestamp:      n.taken_at_timestamp ? new Date(n.taken_at_timestamp * 1000).toISOString() : null,
            likesCount:     n.edge_media_preview_like?.count ?? 0,
            commentsCount:  n.edge_media_to_comment?.count ?? 0,
            videoPlayCount: n.video_view_count ?? null,
            videoDuration:  n.video_duration ?? null,
            displayUrl:     n.display_url ?? null,
            url:            `https://www.instagram.com/p/${n.shortcode}/`,
            ownerUsername:  username,
          }
        })
      }
    }
  } catch {}

  // Fallback: Apify if available
  const token = process.env.APIFY_API_TOKEN
  if (token) {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=120`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directUrls: [`https://www.instagram.com/${username}/`], resultsType: "posts", resultsLimit: 50 }),
          signal: AbortSignal.timeout(135_000),
        }
      )
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) return data
      }
    } catch {}
  }

  return []
}

async function getTopInstagramPosts(username: string, timeframeDays: number) {
  const since = new Date(Date.now() - timeframeDays * 86_400_000)
  const items = await scrapeInstagramProfile(username)

  const posts = items
    .filter((item: any) => {
      if (!item.timestamp) return true
      return new Date(item.timestamp) >= since
    })
    .map((item: any) => {
      const views     = item.videoPlayCount ?? item.videoViewCount ?? item.likesCount ?? 0
      const shortCode = item.shortCode ?? item.shortcode ?? null
      const duration  = item.videoDuration
        ? `${Math.floor(item.videoDuration / 60)}:${String(Math.round(item.videoDuration % 60)).padStart(2, "0")}`
        : "—"
      const postUrl   = item.url ?? (shortCode ? `https://www.instagram.com/p/${shortCode}/` : `https://www.instagram.com/${username}/`)
      return {
        video_id:     item.id ?? shortCode ?? String(Math.random()),
        title:        (item.caption ?? "").slice(0, 120) || "Sin descripción",
        description:  (item.caption ?? "").slice(0, 300),
        thumbnail:    item.displayUrl ?? null,
        video_url:    postUrl,
        views,
        likes:        item.likesCount ?? 0,
        comments:     item.commentsCount ?? 0,
        duration,
        published_at: item.timestamp ?? null,
        platform:     "instagram" as const,
        transcript:   null,
      }
    })
    .sort((a: any, b: any) => b.views - a.views)
    .slice(0, 5)

  return { posts, profileName: username, profileAvatar: null, profileUrl: `https://www.instagram.com/${username}/` }
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

async function generateAnalyses(channelName: string, videos: any[]): Promise<string[]> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const list = videos
      .map((v, i) => `${i + 1}. "${v.title}" — ${v.views.toLocaleString()} views, ${v.likes.toLocaleString()} likes, ${v.comments.toLocaleString()} comentarios`)
      .join("\n")

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `Analizá estos ${videos.length} videos del canal "${channelName}". Para cada video escribí un análisis breve (2-3 oraciones) sobre: qué tema trata, por qué funcionó con esa audiencia y qué lección de contenido se puede extraer. En español, tono profesional.\n\nVideos:\n${list}\n\nRespondé SOLO con un JSON array de exactamente ${videos.length} strings. Sin markdown, sin texto adicional.\nEjemplo: ["análisis 1", "análisis 2"]`,
      }],
    })

    const text   = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]"
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed) && parsed.length === videos.length) return parsed
  } catch {}
  return videos.map(() => "Análisis no disponible.")
}

// ─── GET: history ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    let { data, error } = await supabase
      .from("content_research_history")
      .select("id, channel_url, channel_name, channel_avatar, timeframe_days, platform, videos, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      const fallback = await supabase
        .from("content_research_history")
        .select("id, channel_url, channel_name, timeframe_days, videos, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
      data  = fallback.data as any
      error = fallback.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

// ─── POST: research ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { channel_url, timeframe_days, platform } = body

    if (!channel_url?.trim()) return NextResponse.json({ error: "channel_url es requerido" }, { status: 400 })
    if (![30, 60, 90].includes(Number(timeframe_days))) return NextResponse.json({ error: "timeframe_days debe ser 30, 60 o 90" }, { status: 400 })

    const isInstagram = platform === "instagram" || /instagram\.com/.test(channel_url)

    let channelName = ""
    let channelAvatar: string | null = null
    let channelUrl = channel_url.trim()
    let videos: any[] = []

    if (isInstagram) {
      const username = extractInstagramUsername(channel_url.trim())
        ?? channel_url.trim().replace(/.*instagram\.com\/?/, "").replace(/\/$/, "")
      const ig  = await getTopInstagramPosts(username, Number(timeframe_days))
      channelName   = ig.profileName
      channelAvatar = ig.profileAvatar
      channelUrl    = ig.profileUrl
      videos        = ig.posts
      if (!videos.length) return NextResponse.json({ error: `No se encontraron posts en los últimos ${timeframe_days} días.` }, { status: 404 })
    } else {
      const yt = await resolveChannelId(channel_url.trim())
      channelName   = yt.channelName
      channelAvatar = yt.channelAvatar
      channelUrl    = yt.channelUrl
      videos        = await getTopVideos(yt.channelId, Number(timeframe_days))
      if (!videos.length) return NextResponse.json({ error: `No se encontraron videos en los últimos ${timeframe_days} días.` }, { status: 404 })
    }

    const analyses          = await generateAnalyses(channelName, videos)
    const videosWithAnalysis = videos.map((v, i) => ({ ...v, analysis: analyses[i] ?? "—" }))

    const insertPayload: Record<string, any> = {
      user_id:        user.id,
      channel_url:    channel_url.trim(),
      channel_name:   channelName,
      channel_avatar: channelAvatar,
      timeframe_days: Number(timeframe_days),
      platform:       isInstagram ? "instagram" : "youtube",
      videos:         videosWithAnalysis,
    }
    const insertResult = await supabase.from("content_research_history").insert(insertPayload)
    if (insertResult.error) {
      console.warn("[content-research] insert error:", insertResult.error.message)
      await supabase.from("content_research_history").insert({
        user_id: user.id, channel_url: channel_url.trim(), channel_name: channelName,
        timeframe_days: Number(timeframe_days), videos: videosWithAnalysis,
      })
    }

    return NextResponse.json({ channelName, channelAvatar, channelUrl, timeframe_days, platform: isInstagram ? "instagram" : "youtube", videos: videosWithAnalysis })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── DELETE: remove history item ─────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

    const { error } = await supabase
      .from("content_research_history")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
