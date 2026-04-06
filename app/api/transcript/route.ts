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

const RAPIDAPI_IG_HOST = "instagram-scraper-20251.p.rapidapi.com"

async function rapidApiGetPostByShortcode(shortCode: string, username: string): Promise<any | null> {
  if (!process.env.RAPIDAPI_KEY) return null
  const headers = {
    "X-RapidAPI-Key":  process.env.RAPIDAPI_KEY,
    "X-RapidAPI-Host": RAPIDAPI_IG_HOST,
  }
  for (const endpoint of ["reels", "posts"] as const) {
    try {
      const res = await fetch(
        `https://${RAPIDAPI_IG_HOST}/user/${endpoint}?username=${encodeURIComponent(username)}&count=50`,
        { headers, signal: AbortSignal.timeout(30_000) }
      )
      if (!res.ok) continue
      const data  = await res.json()
      const items: any[] = data?.data?.items ?? data?.items ?? []
      const match = items.find((it: any) => (it.code ?? it.shortcode) === shortCode)
      if (match) return match
    } catch {}
  }
  return null
}

async function extractUsernameFromPostPage(postUrl: string): Promise<string | null> {
  try {
    const res = await fetch(postUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // Try og:title which often contains "@username"
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ?? null
    if (ogTitle) {
      const m = ogTitle.match(/@([\w.]+)/)
      if (m) return m[1]
    }
    // Try JSON-LD or window._sharedData
    const jsonLd = html.match(/"owner":\s*\{"id":"[^"]+","username":"([^"]+)"/)
    if (jsonLd) return jsonLd[1]
  } catch {}
  return null
}

async function getInstagramTranscript(postUrl: string): Promise<{ transcript: string | null; caption: string | null; duration: string | null; username: string | null }> {
  // Step 1: extract shortcode from URL
  const shortCode = postUrl.match(/\/(p|reel|reels|tv)\/([^/?#]+)/)?.[2] ?? null

  let username: string | null = null
  let caption:  string | null = null
  let duration: string | null = null
  let videoUrl: string | null = null

  // Step 2a: try Instagram oEmbed (works when Instagram allows it)
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

  // Step 2b: fallback — scrape the post page for username
  if (!username) {
    username = await extractUsernameFromPostPage(postUrl)
  }

  console.log("[transcript] shortCode:", shortCode, "username:", username)

  // Step 3: fetch post details from RapidAPI using username + shortcode
  if (username && shortCode) {
    try {
      const item = await rapidApiGetPostByShortcode(shortCode, username)
      console.log("[transcript] rapidapi item found:", !!item, "videoUrl:", item?.video_url ?? null)
      if (item) {
        videoUrl = item.video_url ?? null
        caption  = item.caption?.text ?? item.caption ?? null
        const rawDur = item.video_duration
        duration = rawDur
          ? `${Math.floor(rawDur / 60)}:${String(Math.round(rawDur % 60)).padStart(2, "0")}`
          : null
      }
    } catch (e) {
      console.error("[transcript] rapidapi error:", e)
    }
  }

  if (!videoUrl) {
    console.log("[transcript] no videoUrl found, returning null transcript")
    return { transcript: null, caption, duration, username }
  }

  // Step 4: transcribe the CDN mp4 with AssemblyAI
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
        const hasAssemblyAI = !!process.env.ASSEMBLYAI_API_KEY
        return NextResponse.json({
          error: hasAssemblyAI
            ? "No se pudo transcribir este reel. Asegurate de que el video tenga audio y sea público."
            : "Transcripción de Instagram no disponible. Configurá ASSEMBLYAI_API_KEY en las variables de entorno.",
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
