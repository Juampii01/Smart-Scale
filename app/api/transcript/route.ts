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

// instagram-scraper-20253: endpoint /user-posts-reels?username_or_id_or_url=
const IG_HOST = "instagram-scraper-20253.p.rapidapi.com"

function igHeaders() {
  return {
    "X-RapidAPI-Key":  process.env.RAPIDAPI_KEY ?? "",
    "X-RapidAPI-Host": IG_HOST,
  }
}

// Extract username by scraping Instagram page HTML — tries embed URLs + bot UAs
async function extractUsernameFromPage(postUrl: string, shortCode: string): Promise<string | null> {
  const tryUrls = [
    `https://www.instagram.com/p/${shortCode}/embed/captioned/`,
    `https://www.instagram.com/reel/${shortCode}/embed/captioned/`,
    `https://www.instagram.com/p/${shortCode}/embed/`,
    `https://www.instagram.com/reel/${shortCode}/embed/`,
    postUrl,
  ]
  const uas = [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Twitterbot/1.0",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
  ]

  for (const url of tryUrls) {
    for (const ua of uas) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
          signal: AbortSignal.timeout(8_000),
        })
        if (!res.ok) {
          console.log("[transcript] page scrape:", url.split("/").slice(-3).join("/"), ua.slice(0, 20), "status:", res.status)
          continue
        }
        const html = await res.text()

        // Log raw title for debugging
        const rawTitle =
          html.match(/property="og:title"[^>]*content="([^"]+)"/i)?.[1] ??
          html.match(/content="([^"]+)"[^>]*property="og:title"/i)?.[1] ??
          html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? ""
        console.log("[transcript] page title:", rawTitle.slice(0, 120), "| ua:", ua.slice(0, 20), "url:", url.split("/").slice(-3).join("/"))

        if (rawTitle && rawTitle.toLowerCase() !== "instagram") {
          // "username on Instagram: ..." / "username (@handle) on Instagram" / "username • Instagram"
          const m = rawTitle.match(/^@?([A-Za-z0-9._]{1,30})(?:\s+\([^)]+\))?\s+(?:[•·]\s*)?(?:on\s+)?Instagram/i)
          if (m?.[1] && m[1].toLowerCase() !== "instagram") {
            console.log("[transcript] username from title:", m[1])
            return m[1]
          }
        }

        // JSON patterns embedded in the page
        const jsonPatterns = [
          /"owner"\s*:\s*\{[^}]*?"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/,
          /"user"\s*:\s*\{[^}]*?"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/,
          /"username"\s*:\s*"([A-Za-z0-9._]{1,30})"/,
          /instagram\.com\/([A-Za-z0-9._]{1,30})\/(?:p|reel|reels|tv)\//,
        ]
        const blocked = new Set(["p", "reel", "reels", "tv", "stories", "explore", "accounts", "instagram"])
        for (const pat of jsonPatterns) {
          const m = html.match(pat)
          if (m?.[1] && !blocked.has(m[1].toLowerCase())) {
            console.log("[transcript] username from JSON/link:", m[1])
            return m[1]
          }
        }
      } catch (e) {
        console.log("[transcript] page scrape error:", e instanceof Error ? e.message : String(e))
      }
    }
  }
  return null
}

// Try direct RapidAPI endpoints that may accept a shortcode (no username needed)
async function rapidApiGetPostDirectly(shortCode: string): Promise<any | null> {
  if (!process.env.RAPIDAPI_KEY) return null
  const endpoints = [
    `https://${IG_HOST}/post-details?shortcode=${shortCode}`,
    `https://${IG_HOST}/media?shortcode=${shortCode}`,
    `https://${IG_HOST}/reel?shortcode=${shortCode}`,
    `https://${IG_HOST}/media-by-shortcode?shortcode=${shortCode}`,
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: igHeaders(), signal: AbortSignal.timeout(12_000) })
      console.log("[transcript] direct endpoint:", url.split("?")[0].split("/").pop(), "→", res.status)
      if (!res.ok) continue
      const data = await res.json()
      const item = data?.data ?? data?.item ?? data
      if (item?.video_url || item?.video_versions) {
        console.log("[transcript] direct endpoint hit! videoUrl:", !!item.video_url)
        return item
      }
    } catch {}
  }
  return null
}

async function rapidApiGetPostByShortcode(shortCode: string, username: string): Promise<any | null> {
  if (!process.env.RAPIDAPI_KEY) return null

  let paginationToken: string | null = null
  const maxPages = 5

  for (let page = 0; page < maxPages; page++) {
    try {
      const base = `https://${IG_HOST}/user-posts-reels?username_or_id_or_url=${encodeURIComponent(username)}&url_embed_safe=false`
      const url  = paginationToken ? `${base}&pagination_token=${encodeURIComponent(paginationToken)}` : base

      const res = await fetch(url, { headers: igHeaders(), signal: AbortSignal.timeout(30_000) })
      console.log("[transcript] rapidapi username page", page + 1, "status:", res.status)
      if (!res.ok) return null

      const data  = await res.json()
      const items: any[] = data?.data?.items ?? data?.items ?? []
      console.log("[transcript] page", page + 1, "items:", items.length, "codes:", items.slice(0, 5).map((i: any) => i.code ?? i.shortcode).join(","))

      const match = items.find((it: any) => (it.code ?? it.shortcode) === shortCode)
      if (match) return match

      paginationToken = data?.pagination_token ?? data?.data?.pagination_token ?? null
      if (!paginationToken || !items.length) break
    } catch {
      break
    }
  }
  return null
}

function extractVideoUrl(item: any): string | null {
  if (!item) return null
  if (item.video_url) return item.video_url
  if (Array.isArray(item.video_versions) && item.video_versions[0]?.url) return item.video_versions[0].url
  // carousel_media — look for video inside it
  if (Array.isArray(item.carousel_media)) {
    for (const m of item.carousel_media) {
      const v = m.video_url ?? m.video_versions?.[0]?.url
      if (v) return v
    }
  }
  return null
}

async function getInstagramTranscript(postUrl: string): Promise<{ transcript: string | null; caption: string | null; duration: string | null; username: string | null }> {
  const shortCode = postUrl.match(/\/(p|reel|reels|tv)\/([^/?#]+)/)?.[2] ?? null

  let username: string | null = null
  let caption:  string | null = null
  let duration: string | null = null
  let videoUrl: string | null = null

  // Paso 1: username desde la URL (formato: instagram.com/username/reel/shortcode/)
  const urlMatch = postUrl.match(/instagram\.com\/([^/?#]+)\/(p|reel|reels|tv)\//)
  if (urlMatch?.[1] && !["p", "reel", "reels", "tv", "stories"].includes(urlMatch[1])) {
    username = urlMatch[1]
  }

  // Paso 2: oEmbed
  if (!username) {
    try {
      const res = await fetch(
        `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`,
        { signal: AbortSignal.timeout(8_000) }
      )
      if (res.ok) {
        const data = await res.json()
        username = data.author_name ?? null
      }
    } catch {}
  }

  // Paso 3: HTML scraping — embed pages with bot UAs (less blocked than regular pages)
  if (!username && shortCode) {
    username = await extractUsernameFromPage(postUrl, shortCode)
  }

  console.log("[transcript] shortCode:", shortCode, "username after extraction:", username)

  // Paso 4a: username + shortcode → buscar post en sus reels
  if (!videoUrl && username && shortCode) {
    const item = await rapidApiGetPostByShortcode(shortCode, username)
    console.log("[transcript] by username+shortcode:", !!item, "videoUrl:", extractVideoUrl(item) ?? null)
    if (item) {
      videoUrl = extractVideoUrl(item)
      caption  = item.caption?.text ?? item.caption ?? null
      const rawDur = item.video_duration
      duration = rawDur ? `${Math.floor(rawDur / 60)}:${String(Math.round(rawDur % 60)).padStart(2, "0")}` : null
    }
  }

  // Paso 4b: intento directo por shortcode (endpoints alternativos en RapidAPI)
  if (!videoUrl && shortCode) {
    const item = await rapidApiGetPostDirectly(shortCode)
    console.log("[transcript] by direct shortcode:", !!item, "videoUrl:", extractVideoUrl(item) ?? null)
    if (item) {
      videoUrl = extractVideoUrl(item)
      caption  = item.caption?.text ?? item.caption ?? null
      username = item.user?.username ?? item.owner?.username ?? username
      const rawDur = item.video_duration
      duration = rawDur ? `${Math.floor(rawDur / 60)}:${String(Math.round(rawDur % 60)).padStart(2, "0")}` : null
    }
  }

  if (!videoUrl) {
    console.log("[transcript] no videoUrl found, returning null transcript")
    return { transcript: null, caption, duration, username }
  }

  // Paso 5: transcribir con AssemblyAI
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
