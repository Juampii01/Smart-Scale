import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300


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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
}

function stripXmlTags(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function parseCaptionXml(xml: string): string | null {
  const textMatches = [...xml.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)]
  if (textMatches.length) {
    const text = textMatches
      .map((match) => stripXmlTags(match[1] ?? ""))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()

    return text || null
  }

  const paragraphMatches = [...xml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  if (paragraphMatches.length) {
    const text = paragraphMatches
      .map((match) => {
        const paragraphInner = match[1] ?? ""
        const segmentMatches = [...paragraphInner.matchAll(/<s\b[^>]*>([\s\S]*?)<\/s>/gi)]

        if (segmentMatches.length) {
          return segmentMatches
            .map((segment) => stripXmlTags(segment[1] ?? ""))
            .filter(Boolean)
            .join(" ")
        }

        return stripXmlTags(paragraphInner)
      })
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()

    return text || null
  }

  return null
}

function extractPlayerResponse(html: string): any | null {
  const patterns = [
    /ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\})\s*;/,
    /window\[["']ytInitialPlayerResponse["']\]\s*=\s*(\{[\s\S]*?\})\s*;/,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (!match?.[1]) continue
    try {
      return JSON.parse(match[1])
    } catch {
      continue
    }
  }

  return null
}

async function getYouTubeTranscriptFromCaptionTracks(
  videoId: string
): Promise<{ transcript: string | null; provider: string; reason?: string; debug?: string }> {
  try {
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
    })

    const watchHtml = await watchRes.text()
    if (!watchRes.ok) {
      return {
        transcript: null,
        provider: "youtube_watch_page",
        reason: `watch_page_failed_${watchRes.status}`,
        debug: watchHtml.slice(0, 800),
      }
    }

    const playerResponse = extractPlayerResponse(watchHtml)
    const playabilityStatus = playerResponse?.playabilityStatus?.status ?? null
    const playabilityReason = playerResponse?.playabilityStatus?.reason ?? null

    const captionTracks: any[] = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    if (!captionTracks.length) {
      return {
        transcript: null,
        provider: "youtube_watch_page",
        reason: playabilityStatus === "LOGIN_REQUIRED" ? "login_required" : "no_caption_tracks",
        debug: JSON.stringify({ playabilityStatus, playabilityReason }),
      }
    }

    const preferredTrack =
      captionTracks.find((track) => track?.languageCode === "en") ??
      captionTracks.find((track) => track?.languageCode?.startsWith("en")) ??
      captionTracks.find((track) => !track?.kind) ??
      captionTracks[0]

    if (!preferredTrack?.baseUrl) {
      return {
        transcript: null,
        provider: "youtube_watch_page",
        reason: "caption_track_missing_base_url",
        debug: JSON.stringify(captionTracks[0] ?? null),
      }
    }

    const captionUrl = preferredTrack.baseUrl.includes("fmt=")
      ? preferredTrack.baseUrl
      : `${preferredTrack.baseUrl}&fmt=srv3`

    const captionRes = await fetch(captionUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
    })

    const captionXml = await captionRes.text()
    if (!captionRes.ok) {
      return {
        transcript: null,
        provider: "youtube_watch_page",
        reason: `caption_fetch_failed_${captionRes.status}`,
        debug: captionXml.slice(0, 800),
      }
    }

    const transcript = parseCaptionXml(captionXml)
    if (!transcript) {
      return {
        transcript: null,
        provider: "youtube_watch_page",
        reason: "caption_parse_failed",
        debug: captionXml.slice(0, 2000),
      }
    }

    return {
      transcript,
      provider: "youtube_watch_page",
    }
  } catch (err: any) {
    return {
      transcript: null,
      provider: "youtube_watch_page",
      reason: "watch_page_exception",
      debug: err?.message ?? String(err),
    }
  }
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

// ─── Instagram transcript via Apify + AssemblyAI ─────────────────────────────

/**
 * Tries multiple Apify actors in priority order to resolve an Instagram reel/post.
 *
 * Priority:
 *  1. apify~instagram-scraper      — official actor, residential proxies, directUrls input
 *  2. clockworks~instagram-scraper — popular community actor, same directUrls interface
 *  3. apify~instagram-reel-scraper — official reel scraper, requires username (only when known)
 *
 * Returns the raw item object from the first actor that succeeds, or null.
 */
async function runApifyInstagramResolvers(
  postUrl: string,
  shortCode: string | null,
  username: string | null,
): Promise<any | null> {
  const token = process.env.APIFY_TOKEN
  if (!token) return null

  const base       = postUrl.replace(/\/+$/, "")
  const withSlash  = `${base}/`

  // ── Actors that accept directUrls ────────────────────────────────────────────
  // Each actor is tried with the trailing-slash URL first (Instagram canonical form),
  // then without. We pass `timeout` as a query param so Apify kills the run on its
  // side before our fetch timeout fires.
  const DIRECT_ACTORS: Array<{
    id: string
    buildInputs: (url: string) => Record<string, any>[]
  }> = [
    {
      id: "apify~instagram-scraper",
      buildInputs: (url) => [
        { directUrls: [url], resultsType: "posts",   resultsLimit: 1 },
        { directUrls: [url], resultsType: "details", resultsLimit: 1 },
      ],
    },
    {
      id: "clockworks~instagram-scraper",
      buildInputs: (url) => [
        { directUrls: [url], resultsType: "posts", resultsLimit: 1 },
      ],
    },
  ]

  for (const actor of DIRECT_ACTORS) {
    for (const url of [withSlash, base]) {
      for (const input of actor.buildInputs(url)) {
        try {
          const endpoint =
            `https://api.apify.com/v2/acts/${actor.id}/run-sync-get-dataset-items` +
            `?token=${token}&timeout=90&memory=1024`

          console.log("[transcript] Apify attempt:", actor.id, JSON.stringify(input))

          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
            signal: AbortSignal.timeout(110_000),
          })

          const raw = await res.text()
          console.log("[transcript] Apify status:", actor.id, res.status, "url:", url)

          if (!res.ok) {
            console.log("[transcript] Apify error body:", raw.slice(0, 400))
            continue
          }

          let data: any
          try { data = JSON.parse(raw) } catch {
            console.log("[transcript] Apify invalid JSON:", raw.slice(0, 200))
            continue
          }

          const item = Array.isArray(data) ? data[0] : (data?.items?.[0] ?? null)
          if (item) {
            console.log("[transcript] Apify success:", actor.id, "keys:", Object.keys(item).slice(0, 20).join(","))
            return item
          }

          console.log("[transcript] Apify returned empty dataset:", actor.id, "url:", url)
        } catch (err) {
          console.log("[transcript] Apify fetch error:", actor.id, err)
        }
      }
    }
  }

  // ── Fallback: reel scraper by username ───────────────────────────────────────
  // Only works when the URL contains the username (instagram.com/USER/reel/CODE/).
  // Fetches the user's last 20 reels and picks the one matching the shortcode.
  if (username && shortCode) {
    try {
      const endpoint =
        `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items` +
        `?token=${token}&timeout=90&memory=1024`

      const input = { username, resultsLimit: 20 }
      console.log("[transcript] Apify reel-scraper fallback, username:", username, "shortCode:", shortCode)

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(110_000),
      })

      if (res.ok) {
        const data = await res.json()
        const items: any[] = Array.isArray(data) ? data : []
        const match =
          items.find((it) => [it.shortCode, it.code, it.shortcode].some((v) => v === shortCode)) ??
          items[0] ??
          null

        if (match) {
          console.log("[transcript] Apify reel-scraper success, keys:", Object.keys(match).slice(0, 20).join(","))
          return match
        }
      } else {
        console.log("[transcript] Apify reel-scraper error:", res.status)
      }
    } catch (err) {
      console.log("[transcript] Apify reel-scraper fetch error:", err)
    }
  }

  return null
}

async function getInstagramTranscript(postUrl: string): Promise<{ transcript: string | null; caption: string | null; duration: string | null; username: string | null }> {
  const normalizedPostUrl = postUrl.replace(/\/+$/, "").replace("/reels/", "/reel/")
  const shortCode = normalizedPostUrl.match(/\/(p|reel|reels|tv)\/([^/?#]+)/)?.[2] ?? null

  // Extract username from URL when the format is instagram.com/USER/reel/CODE/
  let username: string | null = null
  const urlUsernameMatch = normalizedPostUrl.match(/instagram\.com\/([^/?#]+)\/(p|reel|reels|tv)\//)
  if (urlUsernameMatch?.[1] && !["p", "reel", "reels", "tv"].includes(urlUsernameMatch[1])) {
    username = urlUsernameMatch[1]
  }

  let caption: string | null = null
  let duration: string | null = null
  let videoUrl: string | null = null

  console.log("[transcript] shortCode:", shortCode, "username from url:", username)
  console.log("[transcript] intentando resolver reel con Apify...")

  try {
    if (!process.env.APIFY_TOKEN) {
      console.log("[transcript] APIFY_TOKEN missing")
      return { transcript: null, caption: null, duration: null, username: null }
    }

    const item = await runApifyInstagramResolvers(normalizedPostUrl, shortCode, username)

    if (!item) {
      console.log("[transcript] Apify no devolvió items utilizables")
      return { transcript: null, caption: null, duration: null, username: null }
    }

    // Collect videoUrl — field names vary across actors
    videoUrl =
      item?.videoUrl          ??
      item?.video_url         ??
      item?.videoUrlHd        ??
      item?.videoUrlSd        ??
      item?.mediaUrl          ??
      item?.video             ??
      item?.downloadUrl       ??
      item?.downloadedVideo   ??
      item?.postVideoUrl      ??
      item?.media?.videoUrl   ??
      null

    // Collect caption
    caption =
      item?.caption      ??
      item?.text         ??
      item?.description  ??
      item?.title        ??
      null

    // Collect username (may come from actor even when URL didn't have it)
    if (!username) {
      username =
        item?.ownerUsername    ??
        item?.username         ??
        item?.authorUsername   ??
        item?.owner?.username  ??
        item?.author?.username ??
        null
    }

    // Collect duration
    const rawDuration =
      item?.videoDuration ??
      item?.duration      ??
      item?.video_duration ??
      null

    if (rawDuration && Number.isFinite(Number(rawDuration))) {
      duration = `${Math.floor(Number(rawDuration) / 60)}:${String(Math.round(Number(rawDuration) % 60)).padStart(2, "0")}`
    }

    console.log("[transcript] Apify result:", {
      hasVideoUrl: !!videoUrl,
      username,
      hasCaption: !!caption,
      duration,
      allKeys: Object.keys(item),
    })

    if (!videoUrl) {
      console.log("[transcript] item had no video URL field, returning null transcript")
      return { transcript: null, caption, duration, username }
    }

    const transcript = await assemblyAITranscript(videoUrl, 100_000)
    return { transcript, caption, duration, username }
  } catch (err) {
    console.log("[transcript] Apify/Assembly error:", err)
    return { transcript: null, caption, duration, username }
  }
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
async function getYouTubeTranscript(
  videoId: string
): Promise<{ transcript: string | null; provider: string | null; reason?: string; debug?: string }> {
  const token = process.env.APIFY_TOKEN

  let apifyFailure: { provider: string | null; reason?: string; debug?: string } | null = null

  if (token) {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/automation-lab~youtube-transcript/run-sync-get-dataset-items?token=${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            urls: [`https://www.youtube.com/watch?v=${videoId}`],
            language: "en",
            includeAutoGenerated: true,
            mergeSegments: true,
          }),
          signal: AbortSignal.timeout(120_000),
        }
      )

      const rawText = await res.text()

      if (!res.ok) {
        apifyFailure = {
          provider: "apify",
          reason: `apify_failed_${res.status}`,
          debug: rawText,
        }
      } else {
        let data: any[] = []
        try {
          data = JSON.parse(rawText)
        } catch (err: any) {
          apifyFailure = {
            provider: "apify",
            reason: "apify_parse_failed",
            debug: `${err?.message ?? String(err)} | raw=${rawText}`,
          }
          data = []
        }

        const item = data?.[0] ?? null

        const transcript = [
          item?.fullText,
          item?.transcript,
          item?.text,
          item?.captionsText,
          item?.subtitlesText,
          item?.segments?.map?.((segment: any) => segment?.text).filter(Boolean).join(" "),
          item?.captions?.map?.((caption: any) => caption?.text).filter(Boolean).join(" "),
          item?.subtitles?.map?.((subtitle: any) => subtitle?.text ?? subtitle?.subtitle).filter(Boolean).join(" "),
        ].find((value) => typeof value === "string" && value.trim())?.trim() ?? null

        if (transcript) {
          return {
            transcript,
            provider: "apify",
          }
        }

        const apifyItemError = typeof item?.error === "string" ? item.error : null
        const normalizedApifyError = apifyItemError?.toLowerCase() ?? ""
        apifyFailure = {
          provider: "apify",
          reason:
            normalizedApifyError.includes("login") ||
            normalizedApifyError.includes("age-restricted") ||
            normalizedApifyError.includes("private")
              ? "login_required"
              : "no_captions_found",
          debug: rawText,
        }
      }
    } catch (err: any) {
      apifyFailure = {
        provider: "apify",
        reason: "apify_exception",
        debug: err?.message ?? String(err),
      }
    }
  } else {
    apifyFailure = {
      provider: "apify",
      reason: "missing_apify_token",
      debug: "APIFY_TOKEN is not set",
    }
  }

  const watchPageResult = await getYouTubeTranscriptFromCaptionTracks(videoId)
  if (watchPageResult.transcript) {
    return watchPageResult
  }

  const preferredFailure = (() => {
    if (watchPageResult.reason === "login_required") return watchPageResult
    if (watchPageResult.reason === "no_caption_tracks") return watchPageResult
    if (watchPageResult.reason?.startsWith("caption_fetch_failed_")) return watchPageResult
    if (watchPageResult.reason === "caption_parse_failed") return watchPageResult
    return apifyFailure ?? watchPageResult
  })()

  return {
    transcript: null,
    provider: preferredFailure?.provider ?? null,
    reason: preferredFailure?.reason,
    debug: [
      apifyFailure ? `apify: ${apifyFailure.debug ?? apifyFailure.reason ?? "unknown"}` : null,
      watchPageResult ? `watch_page: ${watchPageResult.debug ?? watchPageResult.reason ?? "unknown"}` : null,
    ].filter(Boolean).join("\n\n"),
  }
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
            ? "No se pudo transcribir este reel. Apify pudo detectar el post, pero no se pudo obtener o transcribir el video."
            : "No se pudo transcribir este reel. Apify no pudo resolver el video desde Instagram. Probá con un reel público e intentá más tarde.",
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

      const ytResult = await getYouTubeTranscript(videoId)
      transcript = ytResult.transcript

      if (!transcript) {
        const errorMessage = ytResult.reason === "login_required"
          ? "No se pudo obtener la transcripción porque este video requiere login, tiene restricción de edad o es privado."
          : "No se pudo obtener la transcripción de este video desde los proveedores disponibles."

        return NextResponse.json({
          error: errorMessage,
          provider: ytResult.provider,
          reason: ytResult.reason,
          debug: ytResult.debug,
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
