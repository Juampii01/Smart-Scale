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

async function rapidApiGetVideoUrl(username: string, shortCode: string): Promise<{ videoUrl: string | null; caption: string | null; duration: string | null }> {
  if (!process.env.RAPIDAPI_KEY) return { videoUrl: null, caption: null, duration: null }
  const headers = {
    "X-RapidAPI-Key":  process.env.RAPIDAPI_KEY,
    "X-RapidAPI-Host": RAPIDAPI_IG_HOST,
  }
  try {
    const res = await fetch(
      `https://${RAPIDAPI_IG_HOST}/user-posts-reels?username_or_id_or_url=${encodeURIComponent(username)}&url_embed_safe=false`,
      { headers, signal: AbortSignal.timeout(30_000) }
    )
    if (!res.ok) return { videoUrl: null, caption: null, duration: null }
    const data  = await res.json()
    const items: any[] = data?.data?.items ?? data?.items ?? []
    const match = items.find((it: any) => (it.code ?? it.shortcode) === shortCode)
    if (match) {
      const rawDur = match.video_duration
      return {
        videoUrl: match.video_url ?? null,
        caption:  match.caption?.text ?? match.caption ?? null,
        duration: rawDur ? `${Math.floor(rawDur / 60)}:${String(Math.round(rawDur % 60)).padStart(2, "0")}` : null,
      }
    }
  } catch {}
  return { videoUrl: null, caption: null, duration: null }
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

  // Fallback: oEmbed to get username
  if (!username) {
    try {
      const oEmbedRes = await fetch(
        `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`,
        { signal: AbortSignal.timeout(8_000) }
      )
      if (oEmbedRes.ok) {
        const oEmbed = await oEmbedRes.json()
        username = oEmbed.author_name ?? null
      }
    } catch {}
  }

  console.log("[transcript] shortCode:", shortCode, "username:", username)

  if (!username || !shortCode) {
    // Can't proceed without username — return null so caller shows proper error
    return { transcript: null, caption: null, duration: null, username }
  }

  // Fetch video URL via RapidAPI
  const { videoUrl, caption, duration } = await rapidApiGetVideoUrl(username, shortCode)
  console.log("[transcript] videoUrl found:", !!videoUrl)

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
      title      = ig.caption ? ig.caption.slice(0, 100) : "Reel de Instagram"
      thumbnail  = null

      if (!transcript) {
        if (!ig.username) {
          return NextResponse.json({
            error: "No se pudo identificar el usuario. Usá el link completo con usuario: instagram.com/usuario/reel/CODIGO/",
          }, { status: 422 })
        }
        return NextResponse.json({
          error: "No se pudo transcribir este reel. Asegurate de que el video sea público y tenga audio.",
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
