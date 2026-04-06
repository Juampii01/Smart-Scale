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
  if (!channelId) throw new Error("No se pudo resolver el canal de YouTube.")

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

async function fetchYouTubeVideos(channelId: string, publishedAfter?: string) {
  const key       = process.env.YOUTUBE_API_KEY!
  const dateParam = publishedAfter ? `&publishedAfter=${encodeURIComponent(publishedAfter)}` : ""
  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=50${dateParam}&key=${key}`
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

async function getTopVideos(channelId: string, timeframeDays: number) {
  const publishedAfter = new Date(Date.now() - timeframeDays * 86_400_000).toISOString()
  const videos = await fetchYouTubeVideos(channelId, publishedAfter)
  if (videos.length) return videos
  // Fallback: return most recent regardless of date
  return fetchYouTubeVideos(channelId)
}

// ─── Instagram ────────────────────────────────────────────────────────────────

function extractInstagramUsername(url: string): string {
  const m = url.match(/instagram\.com\/([^\/\?&]+)/)
  const user = m?.[1] ?? ""
  if (["p", "reel", "tv", "reels", "stories"].includes(user)) return ""
  return user || url.replace(/.*instagram\.com\/?/, "").replace(/\/$/, "").split("?")[0]
}

// Normalize items from any source into a common shape
function normalizeIGItems(items: any[], username: string): any[] {
  return items.map((item: any) => {
    // RapidAPI instagram-scraper-api2 format
    if (item.code !== undefined || item.taken_at !== undefined) {
      return {
        id:             item.id,
        shortCode:      item.code ?? item.shortCode,
        caption:        item.caption?.text ?? item.caption ?? "",
        timestamp:      item.taken_at ? new Date(item.taken_at * 1000).toISOString() : null,
        likesCount:     item.like_count ?? 0,
        commentsCount:  item.comment_count ?? 0,
        videoPlayCount: item.view_count ?? item.play_count ?? null,
        videoDuration:  item.video_duration ?? null,
        displayUrl:     item.image_versions2?.candidates?.[0]?.url ?? item.thumbnail_url ?? null,
        url:            `https://www.instagram.com/p/${item.code ?? item.shortCode}/`,
        ownerUsername:  username,
      }
    }
    // Instagram graph edge node format
    if (item.node) {
      const n = item.node
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
    }
    // Apify format (already normalized)
    return {
      id:             item.id,
      shortCode:      item.shortCode ?? item.shortcode,
      caption:        item.caption ?? "",
      timestamp:      item.timestamp ?? null,
      likesCount:     item.likesCount ?? 0,
      commentsCount:  item.commentsCount ?? 0,
      videoPlayCount: item.videoPlayCount ?? item.videoViewCount ?? null,
      videoDuration:  item.videoDuration ?? null,
      displayUrl:     item.displayUrl ?? item.displayImage ?? null,
      url:            item.url ?? (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : `https://www.instagram.com/${username}/`),
      ownerUsername:  username,
    }
  })
}

async function scrapeInstagramProfile(username: string): Promise<any[]> {
  // Attempt 1: RapidAPI Instagram Scraper (works from any server via proxy)
  const rapidKey = process.env.RAPIDAPI_KEY
  if (rapidKey) {
    try {
      const res = await fetch(
        `https://instagram-scraper-api2.p.rapidapi.com/v1/posts?username_or_id_or_url=${username}`,
        {
          headers: {
            "X-RapidAPI-Key": rapidKey,
            "X-RapidAPI-Host": "instagram-scraper-api2.p.rapidapi.com",
          },
          signal: AbortSignal.timeout(20_000),
        }
      )
      if (res.ok) {
        const data  = await res.json()
        const items = data?.data?.items ?? data?.items ?? []
        if (items.length > 0) return normalizeIGItems(items, username)
      }
    } catch {}
  }

  // Attempt 2: Apify instagram-scraper (needs Apify Starter plan)
  const apifyToken = process.env.APIFY_API_TOKEN
  if (apifyToken) {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=120`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directUrls: [`https://www.instagram.com/${username}/`], resultsType: "posts", resultsLimit: 30 }),
          signal: AbortSignal.timeout(135_000),
        }
      )
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) return normalizeIGItems(data, username)
      }
    } catch {}
  }

  return []
}

async function getTopInstagramPosts(username: string, timeframeDays: number) {
  const since = new Date(Date.now() - timeframeDays * 86_400_000)
  const items = await scrapeInstagramProfile(username)

  if (!items.length) {
    throw new Error("No se pudo acceder al perfil de Instagram. El perfil puede ser privado o estar temporalmente bloqueado.")
  }

  const inRange = items.filter((item: any) => {
    const ts = item.timestamp ?? item.takenAt ?? item.taken_at_timestamp
    if (!ts) return true
    return new Date(ts) >= since
  })
  const source = inRange.length > 0 ? inRange : items

  const posts = source
    .map((item: any) => {
      const views    = item.videoPlayCount ?? item.videoViewCount ?? item.videoViewsCount ?? item.likesCount ?? 0
      const shortCode = item.shortCode ?? item.shortcode ?? null
      const duration  = item.videoDuration
        ? `${Math.floor(item.videoDuration / 60)}:${String(Math.round(item.videoDuration % 60)).padStart(2, "0")}`
        : "—"
      const postUrl   = item.url ?? item.postUrl
        ?? (shortCode ? `https://www.instagram.com/p/${shortCode}/` : `https://www.instagram.com/${username}/`)
      return {
        video_id:     item.id ?? shortCode ?? String(Math.random()),
        title:        (item.caption ?? "").slice(0, 120) || "Sin descripción",
        description:  (item.caption ?? "").slice(0, 300),
        thumbnail:    item.displayUrl ?? item.thumbnailUrl ?? item.displayImage ?? null,
        video_url:    postUrl,
        views,
        likes:        item.likesCount ?? item.likes ?? 0,
        comments:     item.commentsCount ?? item.comments ?? 0,
        duration,
        published_at: item.timestamp ?? item.takenAt ?? null,
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
        content: `Analizá estos ${videos.length} videos del canal "${channelName}". Para cada video escribí un análisis breve (2-3 oraciones): qué tema trata, por qué funcionó y qué lección de contenido se puede extraer. En español.\n\nVideos:\n${list}\n\nRespondé SOLO con un JSON array de exactamente ${videos.length} strings. Sin markdown.\nEjemplo: ["análisis 1", "análisis 2"]`,
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

    let channelName   = ""
    let channelAvatar: string | null = null
    let channelUrl    = channel_url.trim()
    let videos: any[] = []

    if (isInstagram) {
      const username = extractInstagramUsername(channel_url.trim())
      if (!username) return NextResponse.json({ error: "URL de Instagram inválida." }, { status: 400 })
      const ig  = await getTopInstagramPosts(username, Number(timeframe_days))
      channelName   = ig.profileName
      channelAvatar = ig.profileAvatar
      channelUrl    = ig.profileUrl
      videos        = ig.posts
    } else {
      const yt = await resolveChannelId(channel_url.trim())
      channelName   = yt.channelName
      channelAvatar = yt.channelAvatar
      channelUrl    = yt.channelUrl
      videos        = await getTopVideos(yt.channelId, Number(timeframe_days))
      if (!videos.length) return NextResponse.json({ error: "No se encontraron videos para este canal." }, { status: 404 })
    }

    const analyses           = await generateAnalyses(channelName, videos)
    const videosWithAnalysis = videos.map((v, i) => ({ ...v, analysis: analyses[i] ?? "—" }))

    const payload: Record<string, any> = {
      user_id:        user.id,
      channel_url:    channel_url.trim(),
      channel_name:   channelName,
      channel_avatar: channelAvatar,
      timeframe_days: Number(timeframe_days),
      platform:       isInstagram ? "instagram" : "youtube",
      videos:         videosWithAnalysis,
    }
    const { error: insertErr } = await supabase.from("content_research_history").insert(payload)
    if (insertErr) {
      console.warn("[content-research] insert error:", insertErr.message)
      await supabase.from("content_research_history").insert({
        user_id: user.id, channel_url: channel_url.trim(), channel_name: channelName,
        timeframe_days: Number(timeframe_days), videos: videosWithAnalysis,
      })
    }

    return NextResponse.json({ channelName, channelAvatar, channelUrl, timeframe_days, platform: isInstagram ? "instagram" : "youtube", videos: videosWithAnalysis })
  } catch (err: any) {
    console.error("[content-research] error:", err)
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
