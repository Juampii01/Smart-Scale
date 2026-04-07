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

// ─── GET: history ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? ""
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("transcript_history")
      .select("id, url, title, creator, duration, summary, transcript, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── DELETE: remove history item ─────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? ""
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    let body: { id?: string }
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const { error } = await supabase
      .from("transcript_history")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── URL detection ────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function isInstagramUrl(url: string): boolean {
  return /instagram\.com\/(p|reel|reels|tv)\//.test(url)
}

// ─── Transcription via AssemblyAI (download → upload → transcribe) ───────────

async function assemblyAITranscript(cdnUrl: string, timeoutMs = 200_000): Promise<string | null> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) return null

  // 1. Download video on our server (Instagram CDN requires our headers)
  let audioUrl = cdnUrl
  try {
    const dlRes = await fetch(cdnUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "*/*" },
      signal: AbortSignal.timeout(60_000),
    })
    if (dlRes.ok) {
      const buffer = await dlRes.arrayBuffer()
      // 2. Upload binary to AssemblyAI storage
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

  // 3. Try multiple body formats until one is accepted (API format varies by account tier)
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
    console.log("[assemblyai] submit body keys:", Object.keys(body).join(","), "→ status:", res.status, json.error ?? json.id ?? "")
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
    console.log("[assemblyai] poll:", result.status, result.error ?? "")
    if (result.status === "completed") return result.text ?? null
    if (result.status === "error") return null
  }
  return null
}

// ─── Instagram transcript via RapidAPI + AssemblyAI ──────────────────────────

const RAPIDAPI_IG_HOST = "instagram-scraper-20253.p.rapidapi.com"

async function rapidApiGetVideoUrl(
  lookupKey: string,
  shortCode: string,
  postUrl?: string
): Promise<{ videoUrl: string | null; caption: string | null; duration: string | null; username?: string | null }> {
  const empty = { videoUrl: null, caption: null, duration: null }
  if (!process.env.RAPIDAPI_KEY) return empty

  // user-reels endpoint is user-centric — skip if lookupKey is a URL (needs username, not shortcode URL)
  const isUsernameKey = !lookupKey.startsWith("http")

  const headers = {
    "Content-Type": "application/json",
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
    "X-RapidAPI-Host": RAPIDAPI_IG_HOST,
  }

  if (isUsernameKey) try {
    console.log("[transcript] rapidapi userreels lookup:", lookupKey, "shortCode:", shortCode)

    const res = await fetch(
      `https://${RAPIDAPI_IG_HOST}/user-reels?username_or_id_or_url=${encodeURIComponent(lookupKey)}`,
      { headers, signal: AbortSignal.timeout(30_000) }
    )

    if (res.ok) {
      const data = await res.json()
      const items: any[] = data?.data?.items ?? data?.items ?? []
      const match =
        items.find((it: any) => (it.code ?? it.shortcode ?? it.pk) === shortCode) ??
        items.find((it: any) => `${it.code ?? it.shortcode ?? ""}`.toLowerCase() === shortCode.toLowerCase()) ??
        items[0]

      const rawDur =
        match?.video_duration ??
        match?.duration ??
        match?.video_versions?.[0]?.duration ??
        null

      const videoUrl =
        match?.video_url ??
        match?.video_versions?.[0]?.url ??
        match?.carousel_media?.find?.((item: any) => item?.video_url)?.video_url ??
        match?.carousel_media?.find?.((item: any) => item?.video_versions?.[0]?.url)?.video_versions?.[0]?.url ??
        null

      const caption =
        match?.caption?.text ??
        match?.caption ??
        match?.title ??
        null

      if (videoUrl) {
        return {
          videoUrl,
          caption,
          duration: rawDur && Number.isFinite(Number(rawDur))
            ? `${Math.floor(Number(rawDur) / 60)}:${String(Math.round(Number(rawDur) % 60)).padStart(2, "0")}`
            : null,
        }
      }

      console.log("[transcript] rapidapi userreels missing video fields:", {
        itemsCount: items.length,
        matchedShortCode: !!match,
        hasVideoUrl: !!match?.video_url,
        hasVideoVersions: !!match?.video_versions,
        hasCarouselMedia: !!match?.carousel_media,
      })
    } else {
      const errorText = await res.text().catch(() => "")
      console.log("[transcript] rapidapi status:", res.status, errorText)
    }
  } catch (err) {
    console.log("[transcript] rapidapi error:", err)
  }

  // Fallbacks: try Instagram embed pages and the public page HTML.
  // Embed pages are usually more stable than the normal page for extracting `video_url` / `og:video`.
  const extractVideoFromHtml = (html: string) => {
    const decodeValue = (value: string) => {
      let decoded = value
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/\\\//g, "/")

      decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )

      return decoded
    }

    const patterns = [
      /<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /"video_url":"([^"]+)"/i,
      /"video_versions":\s*\[.*?"url":"([^"]+)"/i,
      /"contentUrl":"([^"]+)"/i,
      /"video_dash_manifest":"([^"]+)"/i,
    ]

    const rawVideo = patterns
      .map((pattern) => html.match(pattern)?.[1] ?? null)
      .find(Boolean)

    const ogDescriptionMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)

    // Try to extract username from HTML — works even from cloud IPs
    const usernamePatterns = [
      /"username":"([^"]+)"/i,
      /"owner":\s*\{[^}]*"username":"([^"]+)"/i,
      /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/www\.instagram\.com\/([^/?#"']+)\/(?:reel|p)\//i,
      /instagram\.com\/([^/?#"'\s]+)\/(?:reel|p)\//i,
    ]
    let extractedUsername: string | null = null
    for (const p of usernamePatterns) {
      const m = html.match(p)
      const candidate = m?.[1]?.replace(/^@/, "").trim() ?? null
      if (candidate && !["reel", "p", "reels", "tv"].includes(candidate)) {
        extractedUsername = candidate
        break
      }
    }

    if (!rawVideo && !extractedUsername) return null

    const videoUrl = rawVideo ? decodeValue(rawVideo) : null
    if (videoUrl && !/^https?:\/\//i.test(videoUrl)) return null

    return {
      videoUrl: videoUrl ?? null,
      caption: ogTitleMatch?.[1]
        ? decodeValue(ogTitleMatch[1])
        : ogDescriptionMatch?.[1]
          ? decodeValue(ogDescriptionMatch[1])
          : null,
      duration: null,
      username: extractedUsername,
    }
  }

  const htmlHeaders = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  }

  const candidateUrls = [
    `https://www.instagram.com/reel/${shortCode}/embed/captioned/`,
    `https://www.instagram.com/p/${shortCode}/embed/captioned/`,
    postUrl,
  ].filter(Boolean) as string[]

  const apiCandidateUrls = [
    `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(postUrl ?? `https://www.instagram.com/p/${shortCode}/`)}`,
    `https://www.instagram.com/p/${shortCode}/?__a=1&__d=dis`,
    `https://www.instagram.com/reel/${shortCode}/?__a=1&__d=dis`,
  ]

  for (const apiUrl of apiCandidateUrls) {
    try {
      console.log("[transcript] api fallback url:", apiUrl)
      const apiRes = await fetch(apiUrl, {
        headers: htmlHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      })

      if (!apiRes.ok) {
        console.log("[transcript] api fallback status:", apiUrl, apiRes.status)
        continue
      }

      const contentType = apiRes.headers.get("content-type") ?? ""
      const raw = await apiRes.text()
      console.log("[transcript] api fallback content-type:", apiUrl, contentType)

      if (contentType.includes("application/json") || raw.trim().startsWith("{")) {
        try {
          const json = JSON.parse(raw)
          const jsonVideoUrl =
            json?.video_url ??
            json?.graphql?.shortcode_media?.video_url ??
            json?.items?.[0]?.video_versions?.[0]?.url ??
            json?.items?.[0]?.video_url ??
            null

          if (jsonVideoUrl) {
            return {
              videoUrl: jsonVideoUrl,
              caption:
                json?.title ??
                json?.author_name ??
                json?.graphql?.shortcode_media?.edge_media_to_caption?.edges?.[0]?.node?.text ??
                json?.items?.[0]?.caption?.text ??
                null,
              duration: null,
            }
          }
        } catch (err) {
          console.log("[transcript] api fallback json parse error:", apiUrl, err)
        }
      }

      const extracted = extractVideoFromHtml(raw)
      if (extracted?.videoUrl) {
        return extracted
      }
    } catch (err) {
      console.log("[transcript] api fallback error:", apiUrl, err)
    }
  }

  for (const candidateUrl of candidateUrls) {
    try {
      console.log("[transcript] html fallback url:", candidateUrl)
      const pageRes = await fetch(candidateUrl, {
        headers: htmlHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      })

      if (!pageRes.ok) {
        console.log("[transcript] html fallback status:", candidateUrl, pageRes.status)
        continue
      }

      const html = await pageRes.text()
      const extracted = extractVideoFromHtml(html)
      console.log("[transcript] html fallback markers:", candidateUrl, {
        hasOgVideo: /og:video/i.test(html),
        hasVideoUrl: /"video_url"/i.test(html),
        hasVideoVersions: /"video_versions"/i.test(html),
        hasContentUrl: /"contentUrl"/i.test(html),
        extractedUsername: extracted?.username ?? null,
        htmlLength: html.length,
      })
      if (extracted?.videoUrl) {
        return extracted
      }
      // Even without video URL, if we got a username from HTML, try RapidAPI now
      if (extracted?.username && process.env.RAPIDAPI_KEY) {
        console.log("[transcript] got username from HTML:", extracted.username, "— retrying RapidAPI")
        const rapidHeaders = {
          "Content-Type": "application/json",
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
          "X-RapidAPI-Host": RAPIDAPI_IG_HOST,
        }
        try {
          const rapidRes = await fetch(
            `https://${RAPIDAPI_IG_HOST}/user-reels?username_or_id_or_url=${encodeURIComponent(extracted.username)}`,
            { headers: rapidHeaders, signal: AbortSignal.timeout(30_000) }
          )
          if (rapidRes.ok) {
            const data = await rapidRes.json()
            const items: any[] = data?.data?.items ?? data?.items ?? []
            const match =
              items.find((it: any) => (it.code ?? it.shortcode) === shortCode) ??
              items.find((it: any) => `${it.code ?? it.shortcode ?? ""}`.toLowerCase() === shortCode.toLowerCase())
            const videoUrl = match?.video_url ?? match?.video_versions?.[0]?.url ?? null
            console.log("[transcript] RapidAPI retry result — items:", items.length, "videoUrl:", !!videoUrl)
            if (videoUrl) {
              const rawDur = match?.video_duration ?? match?.duration ?? null
              return {
                videoUrl,
                caption: match?.caption?.text ?? match?.caption ?? null,
                duration: rawDur && Number.isFinite(Number(rawDur))
                  ? `${Math.floor(Number(rawDur) / 60)}:${String(Math.round(Number(rawDur) % 60)).padStart(2, "0")}`
                  : null,
                username: extracted.username,
              }
            }
          }
        } catch (err) {
          console.log("[transcript] RapidAPI retry error:", err)
        }
      }
    } catch (err) {
      console.log("[transcript] html fallback error:", candidateUrl, err)
    }
  }

  return empty
}

async function getInstagramTranscript(postUrl: string): Promise<{ transcript: string | null; caption: string | null; duration: string | null; username: string | null }> {
  // Extract shortcode and username from URL
  // Supports: /p/CODE/, /reel/CODE/, /username/reel/CODE/
  const shortCode = postUrl.match(/\/(p|reel|reels|tv)\/([^/?#]+)/)?.[2] ?? null

  // Try to get username directly from URL (format: instagram.com/username/reel/shortcode/)
  let username: string | null = null
  const urlUsernameMatch = postUrl.match(/instagram\.com\/([^/?#]+)\/(p|reel|reels|tv)\//)
  if (urlUsernameMatch?.[1] && !["p", "reel", "reels", "tv"].includes(urlUsernameMatch[1])) {
    username = urlUsernameMatch[1]
  }

  // Fallback: oEmbed to get username — try both endpoints (v1 is more reliable for public posts)
  if (!username) {
    const oEmbedUrls = [
      `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(postUrl)}`,
      `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`,
    ]
    for (const oEmbedUrl of oEmbedUrls) {
      try {
        console.log("[transcript] oEmbed attempt:", oEmbedUrl)
        const oEmbedRes = await fetch(oEmbedUrl, { signal: AbortSignal.timeout(8_000) })
        console.log("[transcript] oEmbed status:", oEmbedRes.status)
        if (oEmbedRes.ok) {
          const oEmbed = await oEmbedRes.json()
          username = oEmbed.author_name ?? null
          console.log("[transcript] oEmbed author_name:", username)
          if (username) break
        }
      } catch (err) {
        console.log("[transcript] oEmbed error:", oEmbedUrl, err)
      }
    }
  }

  console.log("[transcript] shortCode:", shortCode, "username:", username)

  if (!shortCode) {
    return { transcript: null, caption: null, duration: null, username }
  }

  // RapidAPI user-reels endpoint is user-centric — it needs a username, not a shortcode.
  // Skip RapidAPI entirely when username is null to avoid wasting quota (returns 0 items).
  if (!username) {
    console.log("[transcript] no username found — skipping RapidAPI, going straight to HTML fallbacks")
  }
  const lookupKey = username ?? null
  console.log("[transcript] lookupKey:", lookupKey, "shortCode:", shortCode)
  const result = await rapidApiGetVideoUrl(lookupKey ?? postUrl, shortCode, postUrl)
  const { videoUrl, caption, duration } = result
  // Username might have been extracted from HTML inside rapidApiGetVideoUrl
  if (!username && result.username) username = result.username
  console.log("[transcript] videoUrl found:", !!videoUrl, "username:", username)

  if (!videoUrl) {
    return { transcript: null, caption, duration, username }
  }

  // Transcribe with AssemblyAI
  const transcript = await assemblyAITranscript(videoUrl, 100_000)
  return { transcript, caption, duration, username }
}

// ─── YouTube metadata ─────────────────────────────────────────────────────────

async function getYouTubeMetadata(videoId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${apiKey}`,
    { signal: AbortSignal.timeout(10000) }
  )
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) throw new Error("Video no encontrado en YouTube.")

  const durRaw: string = item.contentDetails?.duration ?? ""
  const durMatch = durRaw.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  let duration = ""
  if (durMatch) {
    const h = durMatch[1] ? `${durMatch[1]}:` : ""
    const m = (durMatch[2] ?? "0").padStart(2, "0")
    const s = (durMatch[3] ?? "0").padStart(2, "0")
    duration = `${h}${m}:${s}`
  }

  return {
    title:     item.snippet?.title ?? null,
    creator:   item.snippet?.channelTitle ?? null,
    thumbnail: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    duration,
  }
}

// ─── YouTube transcript ───────────────────────────────────────────────────────

async function getYouTubeTranscript(videoId: string): Promise<string | null> {
  // Try 1: youtube-transcript library (works locally, sometimes in prod)
  try {
    const { YoutubeTranscript } = await import("youtube-transcript")
    const langs = ["es", "en", ""]
    for (const lang of langs) {
      try {
        const segments = lang
          ? await YoutubeTranscript.fetchTranscript(videoId, { lang })
          : await YoutubeTranscript.fetchTranscript(videoId)
        const text = segments.map((t: any) => t.text).join(" ").trim()
        if (text) return text
      } catch {}
    }
  } catch {}

  // Try 2: AssemblyAI — accepts YouTube URLs directly, bypasses IP blocks
  const assemblyKey = process.env.ASSEMBLYAI_API_KEY
  if (assemblyKey) {
    try {
      const submitRes = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: { "Authorization": assemblyKey, "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: `https://www.youtube.com/watch?v=${videoId}` }),
        signal: AbortSignal.timeout(15_000),
      })
      if (submitRes.ok) {
        const { id } = await submitRes.json()
        if (id) {
          const deadline = Date.now() + 240_000
          while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 4000))
            const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
              headers: { "Authorization": assemblyKey },
              signal: AbortSignal.timeout(10_000),
            })
            if (!pollRes.ok) break
            const result = await pollRes.json()
            if (result.status === "completed" && result.text) return result.text
            if (result.status === "error") break
          }
        }
      }
    } catch {}
  }

  return null
}

// ─── Claude summary ───────────────────────────────────────────────────────────

async function generateSummary(transcript: string, creator: string | null): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Generá un resumen ejecutivo de este video de YouTube${creator ? ` del canal "${creator}"` : ""}.

TRANSCRIPT:
${transcript.slice(0, 5000)}

Usá EXACTAMENTE este formato, sin markdown, sin asteriscos, sin #:

RESUMEN
[2-3 oraciones de qué trata el video]

PUNTOS CLAVE
[3-5 puntos principales separados por salto de línea, sin guiones ni viñetas]

CONCLUSIÓN
[1 oración con el mensaje final]

Sé directo y concreto. Sin emojis en los títulos.`,
    }],
  })
  return (msg.content[0] as any).text ?? ""
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? ""
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    let body: { url?: string }
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const url = body.url?.trim()
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 })

    let title: string | null = null
    let creator: string | null = null
    let thumbnail: string | null = null
    let duration: string | null = null
    let transcript: string | null = null
    let summary: string = ""

    if (isInstagramUrl(url)) {
      // ── Instagram path ──────────────────────────────────────────────────────
      const ig = await getInstagramTranscript(url)
      transcript = ig.transcript
      creator    = ig.username
      duration   = ig.duration
      title      = ig.caption ? ig.caption.slice(0, 100) : `Reel de Instagram${ig.username ? ` · ${ig.username}` : ""}`
      thumbnail  = null

      if (!transcript) {
        return NextResponse.json({
          error: ig.username
            ? "No se pudo transcribir este reel. Asegurate de que el video sea público, tenga audio y permita extraer el video."
            : "No se pudo transcribir este reel. No se pudo resolver el video desde Instagram. Probá con un reel público o una URL con username visible.",
        }, { status: 422 })
      }
      summary = await generateSummary(transcript, creator)
    } else {
      // ── YouTube path ────────────────────────────────────────────────────────
      const videoId = extractYouTubeId(url)
      if (!videoId) {
        return NextResponse.json({ error: "URL no reconocida. Pegá un link de YouTube o Instagram." }, { status: 400 })
      }
      const metadata = await getYouTubeMetadata(videoId)
      title     = metadata.title
      creator   = metadata.creator
      thumbnail = metadata.thumbnail
      duration  = metadata.duration
      transcript = await getYouTubeTranscript(videoId)

      if (!transcript) {
        return NextResponse.json({
          error: "Este video no tiene subtítulos disponibles. Probá con otro video.",
        }, { status: 422 })
      }
      summary = await generateSummary(transcript, creator)
    }

    // Save to history
    await supabase.from("transcript_history").insert({
      user_id:   user.id,
      url,
      title,
      creator,
      duration,
      transcript,
      summary,
    }).then(({ error }) => {
      if (error) console.warn("[transcript] failed to save history:", error.message)
    })

    return NextResponse.json({
      creator,
      title,
      thumbnail,
      duration,
      transcript,
      summary,
    })
  } catch (err: any) {
    console.error("[transcript] error:", err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
