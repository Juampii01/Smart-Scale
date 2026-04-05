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

async function resolveYouTubeChannel(url: string) {
  const key = process.env.YOUTUBE_API_KEY!
  const channelMatch = url.match(/channel\/([^\/\?&]+)/)
  const handleMatch  = url.match(/@([^\/\?&]+)/)
  const userMatch    = url.match(/user\/([^\/\?&]+)/)
  let channelId = ""
  if (channelMatch) {
    channelId = channelMatch[1]
  } else {
    const query = handleMatch ? `@${handleMatch[1]}` : userMatch ? userMatch[1] : url
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${key}`)
    const data = await res.json()
    channelId = data.items?.[0]?.snippet?.channelId ?? data.items?.[0]?.id?.channelId ?? ""
  }
  if (!channelId) throw new Error("No se pudo resolver el canal de YouTube.")
  const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${key}`)
  const chData = await chRes.json()
  const ch = chData.items?.[0]
  return {
    channelId,
    channelName:   ch?.snippet?.title ?? "Canal",
    channelAvatar: ch?.snippet?.thumbnails?.medium?.url ?? ch?.snippet?.thumbnails?.default?.url ?? null,
    channelUrl:    `https://www.youtube.com/channel/${channelId}`,
    subscribers:   Number(ch?.statistics?.subscriberCount ?? 0),
  }
}

async function getYouTubePosts(channelId: string, limit = 50) {
  const key = process.env.YOUTUBE_API_KEY!
  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${limit}&key=${key}`
  )
  const searchData = await searchRes.json()
  const videoIds: string[] = (searchData.items ?? []).map((v: any) => v.id?.videoId).filter(Boolean)
  if (!videoIds.length) return []

  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.join(",")}&key=${key}`
  )
  const statsData = await statsRes.json()

  return (statsData.items ?? []).map((v: any) => ({
    post_id:      v.id,
    type:         "Video",
    title:        v.snippet?.title ?? "",
    caption:      (v.snippet?.description ?? "").slice(0, 300),
    thumbnail:    v.snippet?.thumbnails?.high?.url ?? v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
    post_url:     `https://www.youtube.com/watch?v=${v.id}`,
    views:        Number(v.statistics?.viewCount  ?? 0),
    likes:        Number(v.statistics?.likeCount  ?? 0),
    comments:     Number(v.statistics?.commentCount ?? 0),
    duration:     parseDuration(v.contentDetails?.duration ?? ""),
    published_at: v.snippet?.publishedAt ?? null,
    analysis:     null as string | null,
  }))
}

// ─── Instagram ────────────────────────────────────────────────────────────────

async function getInstagramPosts(url: string, limit = 50) {
  const token = process.env.APIFY_API_TOKEN!
  const username = url.match(/instagram\.com\/([^\/\?&]+)/)?.[1] ?? url.replace(/.*instagram\.com\/?/, "").replace(/\/$/, "")

  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: "posts",
        resultsLimit: limit,
      }),
      signal: AbortSignal.timeout(135_000),
    }
  )
  if (!res.ok) throw new Error(`Instagram scraper error ${res.status}`)
  const items = await res.json()
  if (!Array.isArray(items) || !items.length) throw new Error("No se encontraron posts en este perfil.")

  const profile = items[0]
  const profileName   = profile.ownerUsername ?? username
  const profileAvatar = null

  const posts = items.map((item: any) => ({
    post_id:      item.id ?? item.shortCode ?? String(Math.random()),
    type:         item.type ?? "Image",
    title:        (item.caption ?? "").slice(0, 120) || "Sin descripción",
    caption:      (item.caption ?? "").slice(0, 300),
    thumbnail:    item.displayUrl ?? item.thumbnailUrl ?? null,
    post_url:     item.url ?? (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : `https://www.instagram.com/${username}/`),
    views:        item.videoPlayCount ?? item.videoViewCount ?? item.likesCount ?? 0,
    likes:        item.likesCount ?? 0,
    comments:     item.commentsCount ?? 0,
    duration:     item.videoDuration
      ? `${Math.floor(item.videoDuration / 60)}:${String(Math.round(item.videoDuration % 60)).padStart(2, "0")}`
      : null,
    published_at: item.timestamp ?? null,
    analysis:     null as string | null,
  }))

  return { posts, profileName, profileAvatar, profileUrl: `https://www.instagram.com/${username}/` }
}

// ─── AI Analysis (batch) ──────────────────────────────────────────────────────

async function generateBatchAnalyses(channelName: string, posts: any[]): Promise<string[]> {
  // Only analyse top 10 by views to keep cost + time reasonable
  const sorted = [...posts].sort((a, b) => b.views - a.views).slice(0, 10)
  const idxMap = new Map(sorted.map((p, i) => [p.post_id, i]))

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const list = sorted.map((p, i) =>
      `${i + 1}. "${p.title.slice(0, 80)}" — ${p.views.toLocaleString()} views, ${p.likes.toLocaleString()} likes`
    ).join("\n")

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Sos un experto en estrategia de contenido. Analizá estos ${sorted.length} videos del perfil "${channelName}". Para cada uno escribí 2-3 oraciones en español sobre: por qué funcionó, qué patrón de contenido usa, y qué se puede aprender.\n\n${list}\n\nRespondé SOLO con un JSON array de exactamente ${sorted.length} strings. Sin markdown.`,
      }],
    })
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]"
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return posts.map(() => null as any)

    // Map analyses back to original post order
    return posts.map(p => {
      const idx = idxMap.get(p.post_id)
      return idx !== undefined && parsed[idx] ? parsed[idx] : null
    })
  } catch {
    return posts.map(() => null as any)
  }
}

// ─── GET: load saved account ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("video_feed_accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ account: data ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

// ─── POST: connect / refresh account ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { channel_url, platform } = await req.json()
    if (!channel_url?.trim()) return NextResponse.json({ error: "channel_url requerido" }, { status: 400 })

    const isInstagram = platform === "instagram" || /instagram\.com/.test(channel_url)

    let channelName = "", channelAvatar: string | null = null, channelUrl = channel_url.trim(), posts: any[] = []

    if (isInstagram) {
      const ig = await getInstagramPosts(channel_url.trim(), 50)
      channelName   = ig.profileName
      channelAvatar = ig.profileAvatar
      channelUrl    = ig.profileUrl
      posts = ig.posts
    } else {
      const yt = await resolveYouTubeChannel(channel_url.trim())
      channelName   = yt.channelName
      channelAvatar = yt.channelAvatar
      channelUrl    = yt.channelUrl
      posts = await getYouTubePosts(yt.channelId, 50)
    }

    if (!posts.length) return NextResponse.json({ error: "No se encontraron posts." }, { status: 404 })

    const postsWithAnalysis = posts

    // Upsert — one record per user
    const { error: upsertErr } = await supabase
      .from("video_feed_accounts")
      .upsert({
        user_id:      user.id,
        platform:     isInstagram ? "instagram" : "youtube",
        channel_url:  channelUrl,
        channel_name: channelName,
        channel_avatar: channelAvatar,
        posts:        postsWithAnalysis,
        updated_at:   new Date().toISOString(),
      }, { onConflict: "user_id" })

    if (upsertErr) console.warn("[video-feed] upsert error:", upsertErr.message)

    return NextResponse.json({ channelName, channelAvatar, channelUrl, platform: isInstagram ? "instagram" : "youtube", posts: postsWithAnalysis })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── DELETE: disconnect account ───────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await supabase.from("video_feed_accounts").delete().eq("user_id", user.id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
