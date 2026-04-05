import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 min — Apify + Whisper can take a while

// ─── Auth ─────────────────────────────────────────────────────────────────────

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

// ─── Apify helpers ────────────────────────────────────────────────────────────

async function apifyRunSync(actorId: string, input: object, timeoutSecs = 120): Promise<any[]> {
  const token = process.env.APIFY_API_TOKEN!
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout((timeoutSecs + 10) * 1000),
    }
  )

  if (!res.ok) {
    const msg = await res.text().catch(() => "")
    throw new Error(`Apify [${actorId}] error ${res.status}: ${msg.slice(0, 300)}`)
  }

  const data = await res.json()
  return Array.isArray(data) ? data : []
}

// ─── Instagram via Apify ──────────────────────────────────────────────────────

async function researchInstagramApify(url: string) {
  const items = await apifyRunSync("apify~instagram-scraper", {
    directUrls: [url],
    resultsType: "posts",
    resultsLimit: 1,
    addParentData: false,
  }, 120)

  const item = items[0]
  if (!item) throw new Error("Apify no encontró datos para este post. Verificá que el link sea público.")

  const videoDuration = item.videoDuration ?? null
  let duration: string | null = null
  if (videoDuration) {
    const m = Math.floor(videoDuration / 60)
    const s = Math.round(videoDuration % 60)
    duration = `${m}:${String(s).padStart(2, "0")}`
  }

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

// ─── Transcript via Apify Whisper ─────────────────────────────────────────────

async function transcribeWithWhisper(videoUrl: string): Promise<string | null> {
  try {
    const items = await apifyRunSync("apify~whisper-speech-to-text", {
      audioUrl: videoUrl,
      language: "auto",
      translate: false,
    }, 180)
    const item = items[0]
    return item?.text ?? item?.transcription ?? null
  } catch (e) {
    console.warn("[whisper] transcription failed:", (e as any)?.message)
    return null
  }
}

// ─── Instagram fallback (no Apify) ───────────────────────────────────────────

async function researchInstagramFallback(shortcode: string, originalUrl: string) {
  let creator: string | null = null
  let description: string | null = null

  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(originalUrl)}&omitscript=true`
    const res = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      creator = data.author_name ?? null
      description = data.title ?? null
    }
  } catch {}

  if (!creator || !description) {
    try {
      const res = await fetch(`https://www.instagram.com/p/${shortcode}/`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const html = await res.text()
        const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
        if (jsonLdMatch) {
          try {
            const j = JSON.parse(jsonLdMatch[1])
            if (!creator) creator = j?.author?.identifier?.value ?? j?.author?.name ?? null
            if (!description) description = j?.description ?? j?.articleBody ?? null
          } catch {}
        }
        if (!creator) {
          const m = html.match(/"username":"([^"]+)"/)
          if (m) creator = m[1]
        }
      }
    } catch {}
  }

  return { platform: "instagram" as const, creator, description, views: null, likes: null, comments: null, duration: null, videoUrl: null }
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

async function researchYouTube(videoId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics,contentDetails&key=${apiKey}`,
    { signal: AbortSignal.timeout(10000) }
  )
  const data = await res.json()
  const item = data.items?.[0]
  if (!item) throw new Error("Video no encontrado en YouTube")

  const snippet = item.snippet
  const stats = item.statistics
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
    platform: "youtube" as const,
    creator:     snippet.channelTitle ?? null,
    description: snippet.description?.slice(0, 800) ?? null,
    views:       parseInt(stats.viewCount ?? "0") || null,
    likes:       parseInt(stats.likeCount ?? "0") || null,
    comments:    parseInt(stats.commentCount ?? "0") || null,
    duration,
    videoId,
    videoUrl:    null,
  }
}

async function getYouTubeTranscript(videoId: string): Promise<string | null> {
  // Try 1: Apify YouTube transcript actor (bypasses IP blocks)
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
        const text = Array.isArray(data) ? (data[0]?.transcript_text ?? data[0]?.captions_text ?? null) : null
        if (typeof text === "string" && text.trim()) return text.trim()
      }
    } catch {}
  }

  // Try 2: youtube-transcript library
  try {
    const { YoutubeTranscript } = await import("youtube-transcript")
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "es" })
      .catch(() => YoutubeTranscript.fetchTranscript(videoId))
    const text = segments.map((t: any) => t.text).join(" ").trim()
    if (text) return text
  } catch {}

  return null
}

// ─── Claude Analysis ──────────────────────────────────────────────────────────

async function generateAnalysis(opts: {
  platform: string
  creator: string | null
  description: string | null
  transcript: string | null
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
- El CAPTION/DESCRIPCIÓN suele ser solo un CTA (llamada a la acción) para generar comentarios, DMs o clics. NO es el contenido del video. No lo analices como si fuera el tema principal.
- Si el caption dice cosas como "comentá X", "escribime", "mandame un DM", etc., eso es estrategia de distribución, no contenido.

${transcript ? `TRANSCRIPT DEL VIDEO:\n${transcript.slice(0, 4000)}` : ""}
${description ? `\nCAPTION (solo CTA/distribución):\n${description}` : ""}

Generá un análisis del VIDEO (lo que se dice/muestra) en español. Usá EXACTAMENTE este formato, sin markdown, sin asteriscos, sin #:

TEMA PRINCIPAL
[De qué trata el video: qué enseña, cuenta o muestra]

HOOK
[Cómo abre el video y capta la atención en los primeros segundos]

ESTRUCTURA
[Cómo está organizado el desarrollo del video]

MENSAJE CLAVE
[Qué idea o aprendizaje central quiere dejar en el espectador]

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

    const ytId = extractYouTubeId(url)
    const igShortcode = extractInstagramShortcode(url)

    if (!ytId && !igShortcode) {
      return NextResponse.json({ error: "URL no reconocida. Pegá un link de Instagram o YouTube." }, { status: 400 })
    }

    let metadata: any
    let transcript: string | null = null
    const hasApify = Boolean(process.env.APIFY_API_TOKEN)

    if (ytId) {
      // ── YouTube ──────────────────────────────────────────────────────────
      metadata = await researchYouTube(ytId)
      transcript = await getYouTubeTranscript(ytId)

    } else if (hasApify) {
      // ── Instagram via Apify (full data + Whisper transcript) ──────────────
      metadata = await researchInstagramApify(url)

      if (metadata.videoUrl) {
        transcript = await transcribeWithWhisper(metadata.videoUrl)
      }

    } else {
      // ── Instagram fallback (no Apify key) ─────────────────────────────────
      metadata = await researchInstagramFallback(igShortcode!, url)
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
      partial:     !hasApify && metadata.platform === "instagram",
    })
  } catch (err: any) {
    console.error("[analyze] error:", err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
