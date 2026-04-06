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

// ─── URL Parsers ──────────────────────────────────────────────────────────────

function extractInstagramShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

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

// ─── YouTube ──────────────────────────────────────────────────────────────────

async function researchYouTube(videoId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY
  const res    = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics,contentDetails&key=${apiKey}`,
    { signal: AbortSignal.timeout(10000) }
  )
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) throw new Error("Video no encontrado en YouTube")

  const durRaw   = item.contentDetails?.duration ?? ""
  const durMatch = durRaw.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  let duration = ""
  if (durMatch) {
    const h = durMatch[1] ? `${durMatch[1]}:` : ""
    const m = (durMatch[2] ?? "0").padStart(2, "0")
    const s = (durMatch[3] ?? "0").padStart(2, "0")
    duration = `${h}${m}:${s}`
  }

  return {
    platform: "youtube" as const,
    creator:     item.snippet?.channelTitle ?? null,
    description: item.snippet?.description?.slice(0, 800) ?? null,
    views:       parseInt(item.statistics?.viewCount ?? "0") || null,
    likes:       parseInt(item.statistics?.likeCount ?? "0") || null,
    comments:    parseInt(item.statistics?.commentCount ?? "0") || null,
    duration,
    videoId,
    videoUrl: null as string | null,
  }
}

async function getYouTubeTranscript(videoId: string): Promise<string | null> {
  // Try 1: youtube-transcript library (fast, free)
  try {
    const { YoutubeTranscript } = await import("youtube-transcript")
    for (const lang of ["es", "en", ""]) {
      try {
        const segments = lang
          ? await YoutubeTranscript.fetchTranscript(videoId, { lang })
          : await YoutubeTranscript.fetchTranscript(videoId)
        const text = segments.map((t: any) => t.text).join(" ").trim()
        if (text) return text
      } catch {}
    }
  } catch {}

  // Try 2: Apify YouTube transcript actor
  const apifyToken = process.env.APIFY_API_TOKEN
  if (apifyToken) {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/codepoetry~youtube-transcript-ai-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=60`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startUrls: [{ url: `https://www.youtube.com/watch?v=${videoId}` }] }),
          signal: AbortSignal.timeout(75_000),
        }
      )
      if (res.ok) {
        const data = await res.json()
        const text = Array.isArray(data) ? (data[0]?.transcript_text ?? null) : null
        if (typeof text === "string" && text.trim()) return text.trim()
      }
    } catch {}
  }

  // Try 3: AssemblyAI — accepts YouTube URLs directly
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
          const deadline = Date.now() + 60_000
          while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 4000))
            const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
              headers: { "Authorization": assemblyKey },
              signal: AbortSignal.timeout(10_000),
            })
            if (!poll.ok) break
            const result = await poll.json()
            if (result.status === "completed" && result.text) return result.text
            if (result.status === "error") break
          }
        }
      }
    } catch {}
  }

  return null
}

// ─── Instagram ────────────────────────────────────────────────────────────────

async function researchInstagram(url: string, shortcode: string) {
  const token = process.env.APIFY_API_TOKEN

  // Try Apify scrapers if token available
  if (token) {
    const scrapers = [
      { actor: "apify~instagram-post-scraper", body: { directUrls: [url], resultsLimit: 1 } },
      { actor: "apify~instagram-scraper",      body: { directUrls: [url], resultsType: "posts", resultsLimit: 1, addParentData: false } },
    ]
    for (const { actor, body } of scrapers) {
      try {
        const res = await fetch(
          `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=60`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(75_000),
          }
        )
        if (res.ok) {
          const data = await res.json()
          const item = Array.isArray(data) ? data[0] : null
          if (item) {
            const rawDur   = item.videoDuration ?? null
            const duration = rawDur
              ? `${Math.floor(rawDur / 60)}:${String(Math.round(rawDur % 60)).padStart(2, "0")}`
              : null
            return {
              platform: "instagram" as const,
              creator:     item.ownerUsername ?? null,
              description: item.caption ?? null,
              views:       item.videoPlayCount ?? item.videoViewCount ?? null,
              likes:       item.likesCount ?? null,
              comments:    item.commentsCount ?? null,
              duration,
              videoUrl:    item.videoUrl ?? null,
            }
          }
        }
      } catch {}
    }
  }

  // Fallback: Instagram oEmbed API (public, no auth needed)
  let creator: string | null = null
  let description: string | null = null
  try {
    const res = await fetch(
      `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&omitscript=true`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      creator     = data.author_name ?? null
      description = data.title ?? null
    }
  } catch {}

  return {
    platform: "instagram" as const,
    creator,
    description,
    views:    null,
    likes:    null,
    comments: null,
    duration: null,
    videoUrl: null as string | null,
  }
}

async function transcribeInstagramVideo(videoUrl: string): Promise<string | null> {
  const assemblyKey = process.env.ASSEMBLYAI_API_KEY
  if (!assemblyKey) return null

  // Download CDN video and upload to AssemblyAI
  let audioUrl = videoUrl
  try {
    const dlRes = await fetch(videoUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "*/*" },
      signal: AbortSignal.timeout(60_000),
    })
    if (dlRes.ok) {
      const buffer = await dlRes.arrayBuffer()
      const upRes  = await fetch("https://api.assemblyai.com/v2/upload", {
        method: "POST",
        headers: { "Authorization": assemblyKey, "Content-Type": "application/octet-stream" },
        body: buffer,
        signal: AbortSignal.timeout(60_000),
      })
      if (upRes.ok) {
        const { upload_url } = await upRes.json()
        if (upload_url) audioUrl = upload_url
      }
    }
  } catch {}

  const submitRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { "Authorization": assemblyKey, "Content-Type": "application/json" },
    body: JSON.stringify({ audio_url: audioUrl }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!submitRes.ok) return null
  const { id } = await submitRes.json()
  if (!id) return null

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000))
    const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { "Authorization": assemblyKey },
      signal: AbortSignal.timeout(10_000),
    })
    if (!poll.ok) return null
    const result = await poll.json()
    if (result.status === "completed" && result.text) return result.text
    if (result.status === "error") return null
  }
  return null
}

// ─── Claude Analysis ──────────────────────────────────────────────────────────

async function generateAnalysis(opts: {
  platform:    string
  creator:     string | null
  description: string | null
  transcript:  string | null
}): Promise<string> {
  const { platform, creator, description, transcript } = opts
  const content = [transcript, description].filter(Boolean).join("\n\n")
  if (!content.trim()) return ""

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `Sos un estratega de contenido digital. Analizá este video de ${platform}${creator ? ` del creador @${creator}` : ""}.

IMPORTANTE:
- El TRANSCRIPT es lo que se dice en el video. Es la fuente principal del análisis.
- El CAPTION/DESCRIPCIÓN suele ser solo un CTA. No lo analices como si fuera el tema principal.

${transcript ? `TRANSCRIPT DEL VIDEO:\n${transcript.slice(0, 4000)}` : ""}
${description ? `\nCAPTION:\n${description}` : ""}

Generá un análisis del VIDEO en español. Usá EXACTAMENTE este formato, sin markdown, sin asteriscos, sin #:

TEMA PRINCIPAL
[De qué trata el video]

HOOK
[Cómo abre el video y capta la atención]

ESTRUCTURA
[Cómo está organizado el desarrollo]

MENSAJE CLAVE
[Qué idea central quiere dejar en el espectador]

POR QUÉ FUNCIONA
[Por qué este video genera engagement y retención]

Sé directo, concreto y basado en el transcript. Sin emojis en los títulos.`,
    }],
  })

  return (msg.content[0] as any).text ?? ""
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

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

    const ytId        = extractYouTubeId(url)
    const igShortcode = extractInstagramShortcode(url)

    if (!ytId && !igShortcode) {
      return NextResponse.json({ error: "URL no reconocida. Pegá un link de Instagram o YouTube." }, { status: 400 })
    }

    let metadata: any
    let transcript: string | null = null

    if (ytId) {
      metadata   = await researchYouTube(ytId)
      transcript = await getYouTubeTranscript(ytId)
    } else {
      metadata   = await researchInstagram(url, igShortcode!)
      if (metadata.videoUrl) {
        transcript = await transcribeInstagramVideo(metadata.videoUrl)
      }
    }

    const analysis = await generateAnalysis({
      platform:    metadata.platform,
      creator:     metadata.creator,
      description: metadata.description,
      transcript,
    })

    return NextResponse.json({
      platform:    metadata.platform,
      creator:     metadata.creator,
      post_url:    url,
      description: metadata.description,
      views:       metadata.views,
      likes:       metadata.likes,
      comments:    metadata.comments,
      duration:    metadata.duration ?? null,
      transcript,
      analysis,
      partial:     !process.env.APIFY_API_TOKEN && metadata.platform === "instagram",
    })
  } catch (err: any) {
    console.error("[analyze] error:", err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
