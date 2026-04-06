import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"
import * as http from "http"
import * as tls from "tls"
import * as zlib from "zlib"

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

// ─── YouTube helpers ──────────────────────────────────────────────────────────

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
    const res  = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${key}`
    )
    const data = await res.json()
    channelId  = data.items?.[0]?.snippet?.channelId ?? data.items?.[0]?.id?.channelId ?? ""
  }

  if (!channelId) throw new Error("No se pudo resolver el canal de YouTube. Verificá la URL.")

  const chRes  = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${key}`)
  const chData = await chRes.json()
  const ch     = chData.items?.[0]

  return {
    channelId,
    channelName:   ch?.snippet?.title    ?? "Canal",
    channelAvatar: ch?.snippet?.thumbnails?.default?.url ?? null,
    channelUrl:    `https://www.youtube.com/channel/${channelId}`,
  }
}

async function getYouTubeTranscript(videoId: string): Promise<string | null> {
  // 1st try: native captions (fast, free)
  try {
    const { YoutubeTranscript } = await import("youtube-transcript")
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "es" })
      .catch(() => YoutubeTranscript.fetchTranscript(videoId))
    const text = segments.map((t: any) => t.text).join(" ")
    if (text.trim()) return text.trim()
  } catch {}

  // 2nd try: Apify YouTube transcript actor (uses Whisper when no captions)
  return apifyYouTubeTranscript(`https://www.youtube.com/watch?v=${videoId}`)
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

  const top5 = (statsData.items ?? [])
    .map((v: any) => ({
      video_id:    v.id,
      title:       v.snippet?.title ?? "",
      description: (v.snippet?.description ?? "").slice(0, 300),
      thumbnail:   v.snippet?.thumbnails?.high?.url ?? v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
      video_url:   `https://www.youtube.com/watch?v=${v.id}`,
      views:       Number(v.statistics?.viewCount  ?? 0),
      likes:       Number(v.statistics?.likeCount  ?? 0),
      comments:    Number(v.statistics?.commentCount ?? 0),
      duration:    parseDuration(v.contentDetails?.duration ?? ""),
      published_at: v.snippet?.publishedAt ?? null,
    }))
    .sort((a: any, b: any) => b.views - a.views)
    .slice(0, 5)

  return top5.map((v: any) => ({ ...v, transcript: null }))
}

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return "—"
  const h = m[1] ? `${m[1]}:` : ""
  const min = (m[2] ?? "0").padStart(h ? 2 : 1, "0")
  const sec = (m[3] ?? "0").padStart(2, "0")
  return `${h}${min}:${sec}`
}

// ─── Apify proxy fetch (Node.js built-ins only, no new packages) ─────────────
// Routes HTTP requests through Apify residential proxy to bypass Vercel IP blocks

let _apifyProxyPassword: string | null | undefined = undefined

async function getApifyProxyPassword(): Promise<string | null> {
  if (_apifyProxyPassword !== undefined) return _apifyProxyPassword
  const token = process.env.APIFY_API_TOKEN
  if (!token) { _apifyProxyPassword = null; return null }
  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${token}`, {
      signal: AbortSignal.timeout(8_000),
    })
    const data = await res.json()
    _apifyProxyPassword = data?.proxy?.password ?? null
  } catch {
    _apifyProxyPassword = null
  }
  return _apifyProxyPassword
}

function unchunkBuffer(buf: Buffer): Buffer {
  const out: Buffer[] = []
  let offset = 0
  while (offset < buf.length) {
    const eol = buf.indexOf("\r\n", offset)
    if (eol === -1) break
    const size = parseInt(buf.slice(offset, eol).toString("ascii").trim(), 16)
    if (!size) break
    const start = eol + 2
    out.push(buf.slice(start, start + size))
    offset = start + size + 2
  }
  return Buffer.concat(out)
}

async function fetchViaApifyProxy(
  targetUrl: string,
  reqHeaders: Record<string, string>,
  timeoutMs = 20_000,
): Promise<any | null> {
  const proxyPass = await getApifyProxyPassword()
  if (!proxyPass) return null

  return new Promise((resolve) => {
    const target = new URL(targetUrl)
    const proxyAuth = Buffer.from(`groups-RESIDENTIAL:${proxyPass}`).toString("base64")
    const timer = setTimeout(() => { connectReq.destroy(); resolve(null) }, timeoutMs)

    const connectReq = http.request({
      host: "proxy.apify.com",
      port: 8000,
      method: "CONNECT",
      path: `${target.hostname}:443`,
      headers: {
        "Host": `${target.hostname}:443`,
        "Proxy-Authorization": `Basic ${proxyAuth}`,
      },
    })

    connectReq.once("connect", (_res: http.IncomingMessage, socket: any) => {
      const tlsSocket = tls.connect({ socket, servername: target.hostname, rejectUnauthorized: true })

      tlsSocket.once("secureConnect", () => {
        const path = `${target.pathname}${target.search}`
        const hLines = Object.entries({ ...reqHeaders, "Host": target.hostname, "Accept-Encoding": "gzip", "Connection": "close" })
          .map(([k, v]) => `${k}: ${v}`).join("\r\n")
        tlsSocket.write(`GET ${path} HTTP/1.1\r\n${hLines}\r\n\r\n`)

        const bufs: Buffer[] = []
        tlsSocket.on("data", (c: Buffer) => bufs.push(c))
        tlsSocket.once("end", () => {
          clearTimeout(timer)
          tlsSocket.destroy()
          const raw = Buffer.concat(bufs)
          const sep = raw.indexOf("\r\n\r\n")
          if (sep === -1) { resolve(null); return }
          const headers = raw.slice(0, sep).toString("utf8")
          let body = raw.slice(sep + 4)
          const status = parseInt((headers.match(/^HTTP\/\d\.\d (\d{3})/) ?? [])[1] ?? "0")
          if (status < 200 || status >= 300) { resolve(null); return }
          if (/Transfer-Encoding:\s*chunked/i.test(headers)) body = unchunkBuffer(body)
          const finish = (buf: Buffer) => {
            try { resolve(JSON.parse(buf.toString("utf8"))) } catch { resolve(null) }
          }
          if (/Content-Encoding:\s*gzip/i.test(headers)) {
            zlib.gunzip(body, (err, r) => { if (err) resolve(null); else finish(r) })
          } else {
            finish(body)
          }
        })
        tlsSocket.on("error", () => { clearTimeout(timer); resolve(null) })
      })
      tlsSocket.on("error", () => { clearTimeout(timer); resolve(null) })
    })
    connectReq.on("error", () => { clearTimeout(timer); resolve(null) })
    connectReq.end()
  })
}

// ─── Instagram helpers ────────────────────────────────────────────────────────

function extractInstagramUsername(url: string): string | null {
  const m = url.match(/instagram\.com\/([^\/\?&]+)/)
  const user = m?.[1]
  if (!user || ["p", "reel", "tv", "reels", "stories"].includes(user)) return null
  return user
}

async function apifyRunSync(actorId: string, input: object, timeoutSecs = 120): Promise<any[]> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) throw new Error("Missing APIFY_API_TOKEN")
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout((timeoutSecs + 15) * 1000),
    }
  )
  if (!res.ok) throw new Error(`Apify error ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

// Transcribe a YouTube video URL via Apify (fallback when no captions)
async function apifyYouTubeTranscript(youtubeUrl: string): Promise<string | null> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/codepoetry~youtube-transcript-ai-scraper/run-sync-get-dataset-items?token=${token}&timeout=90`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startUrls: [{ url: youtubeUrl }] }),
        signal: AbortSignal.timeout(105_000),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const items = Array.isArray(data) ? data : []
    const text = items[0]?.transcript_text ?? null
    return typeof text === "string" && text.trim() ? text.trim() : null
  } catch {
    return null
  }
}

// ─── AssemblyAI transcription (download → upload → transcribe) ───────────────

async function assemblyAITranscript(cdnUrl: string, timeoutMs = 200_000): Promise<string | null> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) return null
  try {
    // 1. Download video on our server
    let audioUrl = cdnUrl
    try {
      const dlRes = await fetch(cdnUrl, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "*/*" },
        signal: AbortSignal.timeout(60_000),
      })
      if (dlRes.ok) {
        const buffer = await dlRes.arrayBuffer()
        // 2. Upload to AssemblyAI storage
        const upRes = await fetch("https://api.assemblyai.com/v2/upload", {
          method: "POST",
          headers: { "Authorization": apiKey, "Content-Type": "application/octet-stream" },
          body: buffer,
          signal: AbortSignal.timeout(60_000),
        })
        if (upRes.ok) {
          const { upload_url } = await upRes.json()
          if (upload_url) audioUrl = upload_url
        }
      }
    } catch {}

    // 3. Try multiple body formats until one is accepted
    const submitBodies = [
      { audio_url: audioUrl, speech_model: "nano" },
      { audio_url: audioUrl, speech_model: "universal-2" },
      { audio_url: audioUrl, speech_models: ["universal-2"] },
      { audio_url: audioUrl },
    ]
    let transcriptId: string | null = null
    for (const body of submitBodies) {
      const res = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: { "Authorization": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (res.ok && json.id) { transcriptId = json.id; break }
    }
    if (!transcriptId) return null

    // 4. Poll for result
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000))
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { "Authorization": apiKey },
      })
      if (!pollRes.ok) return null
      const result = await pollRes.json()
      if (result.status === "completed") return result.text ?? null
      if (result.status === "error") return null
    }
  } catch {}
  return null
}

// Transcribe an Instagram post URL: Apify scraper → download → AssemblyAI
async function apifyInstagramTranscript(postUrl: string): Promise<string | null> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=60`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [postUrl],
          resultsType: "posts",
          resultsLimit: 1,
          addParentData: false,
        }),
        signal: AbortSignal.timeout(75_000),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const item = Array.isArray(data) ? data[0] : null
    if (!item) return null
    const videoUrl = item.videoUrl
      ?? item.videoSrc
      ?? (Array.isArray(item.videos) && item.videos[0]?.src ? item.videos[0].src : null)
      ?? (Array.isArray(item.videos) && item.videos[0]?.url ? item.videos[0].url : null)
      ?? null
    if (!videoUrl) return null
    return assemblyAITranscript(videoUrl, 180_000)
  } catch {
    return null
  }
}

const IG_PROFILE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "es,en;q=0.9",
  "X-IG-App-ID": "936619743392459",
  "X-Requested-With": "XMLHttpRequest",
}

function mapIGEdges(edges: any[], username: string): any[] {
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

async function scrapeInstagramProfile(username: string): Promise<any[]> {
  const igUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`

  // 1. Direct fetch — works locally (IPs not blocked)
  try {
    const res = await fetch(igUrl, { headers: IG_PROFILE_HEADERS, signal: AbortSignal.timeout(12_000) })
    if (res.ok) {
      const data  = await res.json()
      const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
      if (edges.length > 0) return mapIGEdges(edges, username)
    }
  } catch {}

  // 2. Via Apify residential proxy — works on Vercel (bypasses IP block)
  const proxyData = await fetchViaApifyProxy(igUrl, { ...IG_PROFILE_HEADERS, "Referer": `https://www.instagram.com/${username}/` })
  if (proxyData) {
    const edges = proxyData?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
    if (edges.length > 0) return mapIGEdges(edges, username)
  }

  // 3. Apify actors fallback
  const profileUrl = `https://www.instagram.com/${username}/`
  try {
    const items = await apifyRunSync("apify~instagram-scraper", {
      directUrls: [profileUrl], resultsType: "posts", resultsLimit: 50, addParentData: false,
    }, 120)
    if (items.length) return items
  } catch {}

  return []
}

async function getTopInstagramPosts(username: string, timeframeDays: number) {
  const since = new Date(Date.now() - timeframeDays * 86_400_000).toISOString().split("T")[0]

  const items = await scrapeInstagramProfile(username)

  const filtered = items
    .filter((item: any) => {
      if (!item.timestamp) return true
      return new Date(item.timestamp) >= new Date(since)
    })
    .map((item: any) => {
      const views = item.videoPlayCount ?? item.videoViewCount ?? item.likesCount ?? 0
      const duration = item.videoDuration
        ? `${Math.floor(item.videoDuration / 60)}:${String(Math.round(item.videoDuration % 60)).padStart(2, "0")}`
        : "—"
      const shortCode = item.shortCode ?? item.shortcode ?? null
      const postUrl = item.url
        ?? (shortCode ? `https://www.instagram.com/p/${shortCode}/` : null)
        ?? `https://www.instagram.com/${username}/`

      return {
        video_id:     item.id ?? shortCode ?? String(Math.random()),
        title:        (item.caption ?? "").slice(0, 120) || "Sin descripción",
        description:  (item.caption ?? "").slice(0, 300),
        thumbnail:    null,              // intentionally blank for Instagram
        video_url:    postUrl,
        post_url:     postUrl,           // URL for Apify Instagram transcript actor
        views,
        likes:        item.likesCount ?? 0,
        comments:     item.commentsCount ?? 0,
        duration,
        published_at: item.timestamp ?? null,
        platform:     "instagram" as const,
      }
    })
    .sort((a: any, b: any) => b.views - a.views)
    .slice(0, 5)

  // Transcribe each post in parallel using the Instagram transcript actor
  const transcripts = await Promise.all(
    filtered.map((p: any) => apifyInstagramTranscript(p.post_url))
  )

  const posts = filtered.map((p: any, i: number) => {
    const { post_url, ...rest } = p
    return { ...rest, transcript: transcripts[i] ?? null }
  })

  return { posts, profileName: username, profileAvatar: null, profileUrl: `https://www.instagram.com/${username}/` }
}

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
        content: `Analizá estos ${videos.length} videos del canal "${channelName}". Para cada video escribí un análisis breve (2-3 oraciones) sobre: qué tema trata, por qué funcionó con esa audiencia y qué lección de contenido se puede extraer. En español, tono profesional.

Videos:
${list}

Respondé SOLO con un JSON array de exactamente ${videos.length} strings. Sin markdown, sin texto adicional.
Ejemplo: ["análisis 1", "análisis 2"]`,
      }],
    })

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]"
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

    // Try with channel_avatar first; fall back without it if the column doesn't exist yet
    let { data, error } = await supabase
      .from("content_research_history")
      .select("id, channel_url, channel_name, channel_avatar, timeframe_days, platform, videos, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      // Fallback: select only columns that are guaranteed to exist
      const fallback = await supabase
        .from("content_research_history")
        .select("id, channel_url, channel_name, timeframe_days, videos, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
      data = fallback.data as any
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
    const isYouTube   = !isInstagram

    let channelName = ""
    let channelAvatar: string | null = null
    let channelUrl = channel_url.trim()
    let videos: any[] = []

    if (isYouTube) {
      const yt = await resolveChannelId(channel_url.trim())
      channelName   = yt.channelName
      channelAvatar = yt.channelAvatar
      channelUrl    = yt.channelUrl
      videos = await getTopVideos(yt.channelId, Number(timeframe_days))
      if (!videos.length) {
        return NextResponse.json({ error: `No se encontraron videos en los últimos ${timeframe_days} días.` }, { status: 404 })
      }
    } else {
      const username = extractInstagramUsername(channel_url.trim())
        ?? channel_url.trim().replace(/.*instagram\.com\/?/, "").replace(/\/$/, "")
      const ig = await getTopInstagramPosts(username, Number(timeframe_days))
      channelName   = ig.profileName
      channelAvatar = ig.profileAvatar
      channelUrl    = ig.profileUrl
      videos = ig.posts
      if (!videos.length) {
        return NextResponse.json({ error: `No se encontraron posts en los últimos ${timeframe_days} días.` }, { status: 404 })
      }
    }

    const analyses = await generateAnalyses(channelName, videos)
    const videosWithAnalysis = videos.map((v, i) => ({ ...v, analysis: analyses[i] ?? "—" }))

    // Insert with all fields; retry dropping unknown columns if schema is outdated
    const insertPayload: Record<string, any> = {
      user_id:        user.id,
      channel_url:    channel_url.trim(),
      channel_name:   channelName,
      channel_avatar: channelAvatar,
      timeframe_days: Number(timeframe_days),
      platform:       isInstagram ? "instagram" : "youtube",
      videos:         videosWithAnalysis,
    }
    let insertResult = await supabase.from("content_research_history").insert(insertPayload)
    if (insertResult.error) {
      console.warn("[content-research] insert error (full):", insertResult.error.message)
      // Retry without optional columns that may not exist in older schema
      const minimalPayload: Record<string, any> = {
        user_id:        user.id,
        channel_url:    channel_url.trim(),
        channel_name:   channelName,
        timeframe_days: Number(timeframe_days),
        videos:         videosWithAnalysis,
      }
      insertResult = await supabase.from("content_research_history").insert(minimalPayload)
      if (insertResult.error) {
        console.warn("[content-research] insert error (minimal):", insertResult.error.message)
      }
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
