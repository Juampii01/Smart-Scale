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
  const h   = m[1] ? `${m[1]}:` : ""
  const min = (m[2] ?? "0").padStart(h ? 2 : 1, "0")
  const sec = (m[3] ?? "0").padStart(2, "0")
  return `${h}${min}:${sec}`
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

async function resolveYouTubeChannel(url: string) {
  const key          = process.env.YOUTUBE_API_KEY!
  const channelMatch = url.match(/channel\/([^/?&]+)/)
  const handleMatch  = url.match(/@([^/?&]+)/)
  const userMatch    = url.match(/user\/([^/?&]+)/)

  let channelId = ""
  if (channelMatch) {
    channelId = channelMatch[1]
  } else {
    const query = handleMatch ? `@${handleMatch[1]}` : userMatch ? userMatch[1] : url
    const res   = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${key}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    const data  = await res.json()
    channelId   = data.items?.[0]?.snippet?.channelId ?? data.items?.[0]?.id?.channelId ?? ""
  }

  if (!channelId) throw new Error("No se pudo resolver el canal de YouTube.")

  const chRes  = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${key}`,
    { signal: AbortSignal.timeout(10_000) }
  )
  const chData = await chRes.json()
  const ch     = chData.items?.[0]

  return {
    channelId,
    channelName:   ch?.snippet?.title ?? "Canal",
    channelAvatar: ch?.snippet?.thumbnails?.medium?.url ?? ch?.snippet?.thumbnails?.default?.url ?? null,
    channelUrl:    `https://www.youtube.com/channel/${channelId}`,
    subscribers:   Number(ch?.statistics?.subscriberCount ?? 0),
  }
}

async function getYouTubePosts(channelId: string, limit = 50) {
  const key       = process.env.YOUTUBE_API_KEY!
  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${limit}&key=${key}`,
    { signal: AbortSignal.timeout(15_000) }
  )
  const searchData = await searchRes.json()
  const videoIds: string[] = (searchData.items ?? [])
    .map((v: any) => v.id?.videoId)
    .filter(Boolean)

  if (!videoIds.length) return []

  const statsRes  = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.join(",")}&key=${key}`,
    { signal: AbortSignal.timeout(15_000) }
  )
  const statsData = await statsRes.json()

  return (statsData.items ?? []).map((v: any) => ({
    post_id:      v.id,
    type:         "Video",
    title:        v.snippet?.title ?? "",
    caption:      (v.snippet?.description ?? "").slice(0, 300),
    thumbnail:    v.snippet?.thumbnails?.high?.url
               ?? v.snippet?.thumbnails?.medium?.url
               ?? v.snippet?.thumbnails?.default?.url
               ?? null,
    post_url:     `https://www.youtube.com/watch?v=${v.id}`,
    views:        Number(v.statistics?.viewCount   ?? 0),
    likes:        Number(v.statistics?.likeCount   ?? 0),
    comments:     Number(v.statistics?.commentCount ?? 0),
    duration:     parseDuration(v.contentDetails?.duration ?? ""),
    published_at: v.snippet?.publishedAt ?? null,
    analysis:     null as string | null,
  }))
}

// ─── Instagram ────────────────────────────────────────────────────────────────

const IG_HEADERS: Record<string, string> = {
  "User-Agent":       "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept":           "application/json, text/plain, */*",
  "Accept-Language":  "es,en;q=0.9",
  "X-IG-App-ID":      "936619743392459",
  "X-Requested-With": "XMLHttpRequest",
}

function mapIGEdges(edges: any[], username: string) {
  return edges.map((e: any) => {
    const n = e.node
    return {
      id:             n.id,
      shortCode:      n.shortcode,
      caption:        n.edge_media_to_caption?.edges?.[0]?.node?.text ?? "",
      timestamp:      n.taken_at_timestamp
        ? new Date(n.taken_at_timestamp * 1000).toISOString()
        : null,
      likesCount:     n.edge_media_preview_like?.count ?? 0,
      commentsCount:  n.edge_media_to_comment?.count  ?? 0,
      videoPlayCount: n.video_view_count ?? null,
      videoDuration:  n.video_duration   ?? null,
      displayUrl:     n.display_url      ?? null,
      url:            `https://www.instagram.com/p/${n.shortcode}/`,
      ownerUsername:  username,
      type:           n.is_video ? "Video" : "Image",
    }
  })
}

async function getInstagramPosts(url: string, limit = 50) {
  const token    = process.env.APIFY_API_TOKEN
  const username = url.match(/instagram\.com\/([^/?&]+)/)?.[1]
    ?? url.replace(/.*instagram\.com\/?/, "").replace(/\/$/, "")
  const igUrl    = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`

  let rawItems: any[] = []

  // 1. Direct fetch — funciona en localhost
  try {
    const res = await fetch(igUrl, { headers: IG_HEADERS, signal: AbortSignal.timeout(12_000) })
    if (res.ok) {
      const data  = await res.json()
      const edges: any[] = data?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
      if (edges.length > 0) rawItems = mapIGEdges(edges, username)
    }
  } catch {}

  // 2. Apify actor — funciona en Vercel (los servidores de Apify no están bloqueados por Instagram)
  if (!rawItems.length && token) {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=120`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            directUrls: [`https://www.instagram.com/${username}/`],
            resultsType: "posts",
            resultsLimit: limit,
            addParentData: false,
          }),
          signal: AbortSignal.timeout(135_000),
        }
      )
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length) rawItems = data
      }
    } catch {}
  }

  // 3. Apify profile scraper como fallback adicional
  if (!rawItems.length && token) {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${token}&timeout=120`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernames: [username], resultsLimit: limit }),
          signal: AbortSignal.timeout(135_000),
        }
      )
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length) rawItems = data
      }
    } catch {}
  }

  if (!rawItems.length) throw new Error("No se encontraron posts en este perfil.")

  const profileName   = rawItems[0]?.ownerUsername ?? username
  const profileAvatar = null as string | null

  const posts = rawItems.map((item: any) => ({
    post_id:      item.id ?? item.shortCode ?? String(Math.random()),
    type:         item.type ?? (item.isVideo ? "Video" : "Image"),
    title:        (item.caption ?? "").slice(0, 120) || "Sin descripción",
    caption:      (item.caption ?? "").slice(0, 300),
    thumbnail:    item.displayUrl ?? item.thumbnailUrl ?? null,
    post_url:     item.url
      ?? (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : null)
      ?? `https://www.instagram.com/${username}/`,
    views:        Math.max(0, item.videoPlayCount ?? item.videoViewCount ?? item.likesCount ?? 0),
    likes:        item.likesCount    ?? 0,
    comments:     item.commentsCount ?? 0,
    duration:     item.videoDuration
      ? `${Math.floor(item.videoDuration / 60)}:${String(Math.round(item.videoDuration % 60)).padStart(2, "0")}`
      : null,
    published_at: item.timestamp ?? null,
    analysis:     null as string | null,
  }))

  return { posts, profileName, profileAvatar, profileUrl: `https://www.instagram.com/${username}/` }
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

async function generateBatchAnalyses(channelName: string, posts: any[]): Promise<(string | null)[]> {
  const top    = [...posts].sort((a, b) => b.views - a.views).slice(0, 10)
  const idxMap = new Map(top.map((p, i) => [p.post_id, i]))

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const list = top.map((p, i) =>
      `${i + 1}. "${p.title.slice(0, 80)}" — ${p.views.toLocaleString()} views, ${p.likes.toLocaleString()} likes`
    ).join("\n")

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Sos un experto en estrategia de contenido. Analizá estos ${top.length} videos del perfil "${channelName}". Para cada uno escribí 2-3 oraciones en español sobre: por qué funcionó, qué patrón de contenido usa, y qué se puede aprender.\n\n${list}\n\nRespondé SOLO con un JSON array de exactamente ${top.length} strings. Sin markdown.`,
      }],
    })

    const raw    = msg.content[0]
    const text   = raw.type === "text" ? raw.text.trim() : "[]"
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return posts.map(() => null)

    return posts.map(p => {
      const idx = idxMap.get(p.post_id)
      return idx !== undefined ? (parsed[idx] ?? null) : null
    })
  } catch {
    return posts.map(() => null)
  }
}

// ─── GET: cargar cuenta guardada ─────────────────────────────────────────────

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
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── POST: conectar / refrescar cuenta ───────────────────────────────────────

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

    let channelName   = ""
    let channelAvatar: string | null = null
    let channelUrl    = channel_url.trim()
    let posts: any[]  = []

    if (isInstagram) {
      const ig    = await getInstagramPosts(channel_url.trim(), 50)
      channelName   = ig.profileName
      channelAvatar = ig.profileAvatar
      channelUrl    = ig.profileUrl
      posts         = ig.posts
    } else {
      const yt    = await resolveYouTubeChannel(channel_url.trim())
      channelName   = yt.channelName
      channelAvatar = yt.channelAvatar
      channelUrl    = yt.channelUrl
      posts         = await getYouTubePosts(yt.channelId, 50)
    }

    if (!posts.length) return NextResponse.json({ error: "No se encontraron posts." }, { status: 404 })

    const { error: upsertErr } = await supabase
      .from("video_feed_accounts")
      .upsert(
        {
          user_id:        user.id,
          platform:       isInstagram ? "instagram" : "youtube",
          channel_url:    channelUrl,
          channel_name:   channelName,
          channel_avatar: channelAvatar,
          posts,
          updated_at:     new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    if (upsertErr) console.warn("[video-feed] upsert error:", upsertErr.message)

    return NextResponse.json({
      channelName,
      channelAvatar,
      channelUrl,
      platform: isInstagram ? "instagram" : "youtube",
      posts,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── DELETE: desconectar cuenta ───────────────────────────────────────────────

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
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
