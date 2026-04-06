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

// ─── Helpers generales ────────────────────────────────────────────────────────

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return "—"
  const h = m[1] ? `${m[1]}:` : ""
  const min = (m[2] ?? "0").padStart(h ? 2 : 1, "0")
  const sec = (m[3] ?? "0").padStart(2, "0")
  return `${h}${min}:${sec}`
}

// ─── Apify ────────────────────────────────────────────────────────────────────

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

  if (!res.ok) {
    const errorText = await res.text().catch(() => "")
    throw new Error(`Apify [${actorId}] error ${res.status}${errorText ? `: ${errorText.slice(0, 500)}` : ""}`)
  }

  const data = await res.json().catch(() => [])
  return Array.isArray(data) ? data : []
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

async function resolveChannelId(url: string) {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error("Missing YOUTUBE_API_KEY")

  const channelMatch = url.match(/channel\/([^/?&]+)/)
  const handleMatch  = url.match(/@([^/?&]+)/)
  const userMatch    = url.match(/user\/([^/?&]+)/)

  let channelId = ""

  if (channelMatch) {
    channelId = channelMatch[1]
  } else {
    const query = handleMatch ? `@${handleMatch[1]}` : userMatch ? userMatch[1] : url
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${key}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) throw new Error(`YouTube search error ${res.status}`)
    const data = await res.json().catch(() => ({}))
    channelId = data.items?.[0]?.snippet?.channelId ?? data.items?.[0]?.id?.channelId ?? ""
  }

  if (!channelId) throw new Error("No se pudo resolver el canal de YouTube. Verificá la URL.")

  const chRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${key}`,
    { signal: AbortSignal.timeout(10_000) }
  )
  if (!chRes.ok) throw new Error(`YouTube channel lookup error ${chRes.status}`)
  const chData = await chRes.json().catch(() => ({}))
  const ch = chData.items?.[0]

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

  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=50&publishedAfter=${encodeURIComponent(publishedAfter)}&key=${key}`,
    { signal: AbortSignal.timeout(15_000) }
  )
  if (!searchRes.ok) throw new Error(`YouTube video search error ${searchRes.status}`)
  const searchData = await searchRes.json().catch(() => ({}))
  const videoIds: string[] = (searchData.items ?? [])
    .map((v: any) => v.id?.videoId)
    .filter(Boolean)

  if (!videoIds.length) return []

  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.join(",")}&key=${key}`,
    { signal: AbortSignal.timeout(15_000) }
  )
  if (!statsRes.ok) throw new Error(`YouTube stats error ${statsRes.status}`)
  const statsData = await statsRes.json().catch(() => ({}))

  const top5 = (statsData.items ?? [])
    .map((v: any) => ({
      video_id:     v.id,
      title:        v.snippet?.title ?? "",
      description:  (v.snippet?.description ?? "").slice(0, 300),
      thumbnail:    v.snippet?.thumbnails?.high?.url
                 ?? v.snippet?.thumbnails?.medium?.url
                 ?? v.snippet?.thumbnails?.default?.url
                 ?? null,
      video_url:    `https://www.youtube.com/watch?v=${v.id}`,
      views:        Number(v.statistics?.viewCount   ?? 0),
      likes:        Number(v.statistics?.likeCount   ?? 0),
      comments:     Number(v.statistics?.commentCount ?? 0),
      duration:     parseDuration(v.contentDetails?.duration ?? ""),
      published_at: v.snippet?.publishedAt ?? null,
      transcript:   null as string | null,
    }))
    .sort((a: any, b: any) => b.views - a.views)
    .slice(0, 5)

  // Fetch transcripts for each video
  const transcripts = await Promise.all(top5.map((v: any) => getYouTubeTranscript(v.video_id)))
  return top5.map((v: any, i: number) => ({ ...v, transcript: transcripts[i] ?? null }))
}

async function getYouTubeTranscript(videoId: string): Promise<string | null> {
  // 1. Native captions via youtube-transcript
  try {
    const { YoutubeTranscript } = await import("youtube-transcript")
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "es" })
      .catch(() => YoutubeTranscript.fetchTranscript(videoId))
    const text = segments.map((t: any) => t.text).join(" ").trim()
    if (text) return text
  } catch {}

  // 2. Apify YouTube transcript actor
  const token = process.env.APIFY_API_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/codepoetry~youtube-transcript-ai-scraper/run-sync-get-dataset-items?token=${token}&timeout=90`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startUrls: [{ url: `https://www.youtube.com/watch?v=${videoId}` }] }),
        signal: AbortSignal.timeout(105_000),
      }
    )
    if (res.ok) {
      const data = await res.json()
      const text = Array.isArray(data) ? (data[0]?.transcript_text ?? null) : null
      if (typeof text === "string" && text.trim()) return text.trim()
    }
  } catch {}

  return null
}

// ─── Instagram ────────────────────────────────────────────────────────────────

function extractInstagramUsername(url: string): string | null {
  const m    = url.match(/instagram\.com\/([^/?&]+)/)
  const user = m?.[1]
  if (!user || ["p", "reel", "tv", "reels", "stories"].includes(user)) return null
  return user
}

const IG_HEADERS: Record<string, string> = {
  "User-Agent":        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept":            "application/json, text/plain, */*",
  "Accept-Language":   "es,en;q=0.9",
  "X-IG-App-ID":       "936619743392459",
  "X-Requested-With":  "XMLHttpRequest",
}

async function scrapeInstagramProfile(username: string): Promise<any[]> {
  const igUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`

  // 1. Direct fetch — funciona en localhost
  try {
    const res = await fetch(igUrl, {
      headers: IG_HEADERS,
      signal: AbortSignal.timeout(12_000),
    })
    if (res.ok) {
      const data  = await res.json()
      const edges: any[] = data?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
      if (edges.length > 0) return mapIGEdges(edges, username)
    }
  } catch {}

  // 2. Apify actor — funciona en Vercel (corre en servidores de Apify, no en los de Vercel)
  try {
    const items = await apifyRunSync(
      "apify~instagram-scraper",
      { directUrls: [`https://www.instagram.com/${username}/`], resultsType: "posts", resultsLimit: 50, addParentData: false },
      120
    )
    if (items.length) return items
  } catch {}

  // 3. Apify profile scraper como fallback adicional
  try {
    const items = await apifyRunSync(
      "apify~instagram-profile-scraper",
      { usernames: [username], resultsLimit: 50 },
      120
    )
    if (items.length) return items
  } catch {}

  return []
}

function mapIGEdges(edges: any[], username: string): any[] {
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
      videoPlayCount: n.video_view_count  ?? null,
      videoDuration:  n.video_duration    ?? null,
      displayUrl:     n.display_url       ?? null,
      url:            `https://www.instagram.com/p/${n.shortcode}/`,
      ownerUsername:  username,
    }
  })
}

async function getTopInstagramPosts(username: string, timeframeDays: number) {
  const items = await scrapeInstagramProfile(username)

  const mapped = items
    .filter((item: any) => {
      if (!item.timestamp) return true
      return new Date(item.timestamp) >= new Date(new Date(Date.now() - timeframeDays * 86_400_000).toISOString().split("T")[0])
    })
    .map((item: any) => {
      const views     = item.videoPlayCount ?? item.videoViewCount ?? item.likesCount ?? 0
      const shortCode = item.shortCode ?? item.shortcode ?? null
      const postUrl   = item.url
        ?? (shortCode ? `https://www.instagram.com/p/${shortCode}/` : null)
        ?? `https://www.instagram.com/${username}/`
      const rawDur    = item.videoDuration
      const duration  = rawDur
        ? `${Math.floor(rawDur / 60)}:${String(Math.round(rawDur % 60)).padStart(2, "0")}`
        : "—"

      return {
        video_id:     item.id ?? shortCode ?? String(Math.random()),
        title:        (item.caption ?? "").slice(0, 120) || "Sin descripción",
        description:  (item.caption ?? "").slice(0, 300),
        thumbnail:    null as string | null,
        video_url:    postUrl,
        post_url:     postUrl,
        views,
        likes:        item.likesCount    ?? 0,
        comments:     item.commentsCount ?? 0,
        duration,
        published_at: item.timestamp ?? null,
        platform:     "instagram" as const,
      }
    })
    .sort((a: any, b: any) => b.views - a.views)
    .slice(0, 5)

  // Transcripciones en paralelo
  const transcripts = await Promise.all(mapped.map((p: any) => getInstagramTranscript(p.post_url)))

  const posts = mapped.map((p: any, i: number) => {
    const { post_url, ...rest } = p
    return { ...rest, transcript: transcripts[i] ?? null }
  })

  return {
    posts,
    profileName:  username,
    profileAvatar: null as string | null,
    profileUrl:   `https://www.instagram.com/${username}/`,
  }
}

async function getInstagramTranscript(postUrl: string): Promise<string | null> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) return null
  try {
    // Obtener videoUrl via Apify
    const items = await apifyRunSync(
      "apify~instagram-post-scraper",
      { directUrls: [postUrl], resultsLimit: 1 },
      60
    ).catch(() =>
      apifyRunSync(
        "apify~instagram-scraper",
        { directUrls: [postUrl], resultsType: "posts", resultsLimit: 1, addParentData: false },
        60
      )
    )
    const item     = items[0]
    if (!item) return null
    const firstVideo = Array.isArray(item.videos) ? item.videos[0] : null
    const videoUrl = item.videoUrl
      ?? item.videoSrc
      ?? firstVideo?.src
      ?? firstVideo?.url
      ?? null
    if (!videoUrl) return null

    // Transcribir con Whisper via Apify
    return transcribeWithWhisper(videoUrl)
  } catch {
    return null
  }
}

async function transcribeWithWhisper(videoUrl: string): Promise<string | null> {
  try {
    const items = await apifyRunSync(
      "apify~whisper-speech-to-text",
      { audioUrl: videoUrl, language: "auto", translate: false },
      180
    )
    const item = items[0]
    return item?.text ?? item?.transcription ?? null
  } catch {
    return null
  }
}

// ─── Claude análisis ──────────────────────────────────────────────────────────

async function generateAnalyses(channelName: string, videos: any[]): Promise<string[]> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY")

    const anthropic = new Anthropic({ apiKey })
    const list = videos
      .map((v, i) =>
        `${i + 1}. "${v.title}" — ${v.views.toLocaleString()} views, ${v.likes.toLocaleString()} likes, ${v.comments.toLocaleString()} comentarios`
      )
      .join("\n")

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-6",
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

    const raw = msg.content.find((block) => block.type === "text")
    const text = raw?.type === "text" ? raw.text.trim() : "[]"
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed) && parsed.length === videos.length) return parsed
  } catch (error) {
    console.error("generateAnalyses error:", error)
  }

  return videos.map(() => "Análisis no disponible.")
}

// ─── GET: historial ───────────────────────────────────────────────────────────
