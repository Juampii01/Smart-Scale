import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import Anthropic from "@anthropic-ai/sdk"
import { getInstagramTranscript } from "@/lib/instagram-transcript"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300


// ─── Helpers generales ────────────────────────────────────────────────────────

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return "—"
  const h = m[1] ? `${m[1]}:` : ""
  const min = (m[2] ?? "0").padStart(h ? 2 : 1, "0")
  const sec = (m[3] ?? "0").padStart(2, "0")
  return `${h}${min}:${sec}`
}

function extractYouTubeChannelIdFromHtml(html: string): string {
  const patterns = [
    /https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{20,})/i,
    /"channelId":"(UC[\w-]{20,})"/i,
    /itemprop="identifier" content="(UC[\w-]{20,})"/i,
    /browseId":"(UC[\w-]{20,})"/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1]
  }

  return ""
}

async function resolveChannelIdFromPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "es,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) return ""
    const html = await res.text()
    return extractYouTubeChannelIdFromHtml(html)
  } catch {
    return ""
  }
}



// ─── YouTube ──────────────────────────────────────────────────────────────────

async function resolveChannelId(url: string) {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error("Missing YOUTUBE_API_KEY")

  const channelMatch = url.match(/channel\/([^/?&]+)/)
  const handleMatch  = url.match(/@([^/?&]+)/)
  const userMatch    = url.match(/user\/([^/?&]+)/)
  const customMatch  = url.match(/youtube\.com\/c\/([^/?&]+)/)

  let channelId = ""

  if (channelMatch) {
    channelId = channelMatch[1]
  }

  if (!channelId && (handleMatch || userMatch || customMatch)) {
    channelId = await resolveChannelIdFromPage(url)
  }

  if (!channelId) {
    const query = handleMatch
      ? `@${handleMatch[1]}`
      : userMatch
        ? userMatch[1]
        : customMatch
          ? customMatch[1]
          : url

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=5&key=${key}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) throw new Error(`YouTube search error ${res.status}`)
    const data = await res.json().catch(() => ({}))

    channelId =
      data.items?.find((item: any) => {
        const handle = item?.snippet?.customUrl?.replace(/^@/, "")?.toLowerCase()
        return handleMatch ? handle === handleMatch[1].toLowerCase() : true
      })?.snippet?.channelId
      ?? data.items?.[0]?.snippet?.channelId
      ?? data.items?.[0]?.id?.channelId
      ?? ""
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
  const key = process.env.YOUTUBE_API_KEY!
  const publishedAfter = new Date(Date.now() - timeframeDays * 86_400_000).toISOString()

  async function searchVideos(params: { publishedAfter?: string; maxResults?: number }) {
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${params.maxResults ?? 50}${params.publishedAfter ? `&publishedAfter=${encodeURIComponent(params.publishedAfter)}` : ""}&key=${key}`,
      { signal: AbortSignal.timeout(15_000) }
    )
    if (!searchRes.ok) throw new Error(`YouTube video search error ${searchRes.status}`)
    const searchData = await searchRes.json().catch(() => ({}))
    return (searchData.items ?? [])
      .map((v: any) => v.id?.videoId)
      .filter(Boolean)
  }

  let videoIds: string[] = await searchVideos({ publishedAfter, maxResults: 50 })
  let usedTimeframeFallback = false

  if (!videoIds.length) {
    videoIds = await searchVideos({ maxResults: 15 })
    usedTimeframeFallback = true
  }

  if (!videoIds.length) return []

  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds.join(",")}&key=${key}`,
    { signal: AbortSignal.timeout(15_000) }
  )
  if (!statsRes.ok) throw new Error(`YouTube stats error ${statsRes.status}`)
  const statsData = await statsRes.json().catch(() => ({}))

  const cutoffDate = new Date(Date.now() - timeframeDays * 86_400_000)

  let items = (statsData.items ?? []).map((v: any) => ({
    video_id:     v.id,
    title:        v.snippet?.title ?? "",
    description:  v.snippet?.description ?? "",
    thumbnail:    v.snippet?.thumbnails?.high?.url
               ?? v.snippet?.thumbnails?.medium?.url
               ?? v.snippet?.thumbnails?.default?.url
               ?? null,
    video_url:    `https://www.youtube.com/watch?v=${v.id}`,
    views:        Number(v.statistics?.viewCount ?? 0),
    likes:        Number(v.statistics?.likeCount ?? 0),
    comments:     Number(v.statistics?.commentCount ?? 0),
    duration:     parseDuration(v.contentDetails?.duration ?? ""),
    published_at: v.snippet?.publishedAt ?? null,
    transcript:   null as string | null,
  }))

  if (!usedTimeframeFallback) {
    items = items.filter((item: any) => item.published_at ? new Date(item.published_at) >= cutoffDate : true)
  }

  const top5 = items
    .sort((a: any, b: any) => b.views - a.views)
    .slice(0, 5)

  if (!top5.length && usedTimeframeFallback) {
    return items
      .sort((a: any, b: any) => b.views - a.views)
      .slice(0, 5)
  }

  const transcripts = await Promise.all(top5.map((v: any) => getYouTubeTranscript(v.video_id)))
  return top5.map((v: any, i: number) => ({ ...v, transcript: transcripts[i] ?? null }))
}

async function getYouTubeTranscript(videoId: string): Promise<string | null> {
  const token = process.env.APIFY_TOKEN
  if (!token) return null

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/automation-lab~youtube-transcript/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [`https://www.youtube.com/watch?v=${videoId}`],
          language: "en",
          includeAutoGenerated: true,
          mergeSegments: true,
        }),
        signal: AbortSignal.timeout(120_000),
      }
    )

    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      console.log("[content-research][yt transcript] apify error:", res.status, txt.slice(0, 500))
      return null
    }

    const rawText = await res.text()
    let data: any[] = []

    try {
      data = JSON.parse(rawText)
    } catch (err) {
      console.log("[content-research][yt transcript] parse error:", String(err))
      console.log("[content-research][yt transcript] raw:", rawText.slice(0, 500))
      return null
    }

    const item = data?.[0] ?? null
    const text = [
      item?.fullText,
      item?.transcript,
      item?.text,
      item?.captionsText,
      item?.subtitlesText,
      item?.segments?.map?.((segment: any) => segment?.text).filter(Boolean).join(" "),
      item?.captions?.map?.((caption: any) => caption?.text).filter(Boolean).join(" "),
      item?.subtitles?.map?.((subtitle: any) => subtitle?.text ?? subtitle?.subtitle).filter(Boolean).join(" "),
    ].find((value) => typeof value === "string" && value.trim())?.trim() ?? null

    if (!text) {
      console.log("[content-research][yt transcript] no transcript fields found")
      console.log("[content-research][yt transcript] raw:", rawText.slice(0, 500))
      return null
    }

    return text
  } catch (e) {
    console.log("[content-research][yt transcript] exception:", String(e))
    return null
  }
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

// Apify fallback for Instagram profile
async function apifyInstagramProfileFetch(username: string): Promise<any[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) return []

  const profileUrl = `https://www.instagram.com/${username}/`

  const attempts: Array<{ actor: string; input: Record<string, any> }> = [
    {
      actor: "apify~instagram-api-scraper",
      input: {
        directUrls: [profileUrl],
        resultsType: "posts",
        resultsLimit: 50,
        addParentData: false,
      },
    },
    {
      actor: "apify~instagram-profile-scraper",
      input: {
        usernames: [username],
        resultsLimit: 50,
      },
    },
    {
      actor: "scrapepilotapi~instagram-profile-post-scraper",
      input: {
        startUrls: [profileUrl],
        maxPosts: 50,
        pinnedMode: "include",
      },
    },
  ]

  for (const attempt of attempts) {
    const endpoint = `https://api.apify.com/v2/acts/${attempt.actor}/run-sync-get-dataset-items?token=${token}`
    try {
      console.log("[apify][ig profile] attempt:", attempt.actor, attempt.input)

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt.input),
        signal: AbortSignal.timeout(60_000),
      })

      const raw = await res.text()
      console.log("[apify][ig profile] status:", attempt.actor, res.status)

      if (!res.ok) {
        console.log("[apify][ig profile] body:", raw.slice(0, 500))
        continue
      }

      let data: any = null
      try {
        data = JSON.parse(raw)
      } catch {
        console.log("[apify][ig profile] invalid JSON:", attempt.actor, raw.slice(0, 300))
        continue
      }

      const items = Array.isArray(data)
        ? data
        : data?.items ?? data?.results ?? []

      if (Array.isArray(items) && items.length > 0) {
        console.log("[apify][ig profile] items:", attempt.actor, items.length)
        return items
      }
    } catch (e) {
      console.log("[apify][ig profile] exception:", attempt.actor, String(e))
    }
  }

  return []
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
      console.log("[content-research] direct fetch edges:", edges.length)
      if (edges.length > 0) return mapIGEdges(edges, username)
    }
  } catch (e) { console.log("[content-research] direct fetch error:", String(e)) }

  // 2. Apify fallback
  const apifyItems = await apifyInstagramProfileFetch(username)
  if (apifyItems.length) {
    return apifyItems.map((item: any) => {
      const shortCode =
        item.shortCode ??
        item.shortcode ??
        item.code ??
        item.id ??
        item.postId ??
        null

      const rawTimestamp =
        item.timestamp ??
        item.takenAt ??
        item.taken_at ??
        item.createdAt ??
        item.created_at ??
        null

      const isoTimestamp =
        typeof rawTimestamp === "number"
          ? new Date(rawTimestamp > 1e12 ? rawTimestamp : rawTimestamp * 1000).toISOString()
          : typeof rawTimestamp === "string"
            ? rawTimestamp
            : null

      return {
        id:             item.id ?? shortCode ?? String(Math.random()),
        shortCode,
        caption:        item.caption ?? item.text ?? item.title ?? item.description ?? item.captionText ?? "",
        timestamp:      isoTimestamp,
        likesCount:     item.likesCount ?? item.likes ?? item.likeCount ?? 0,
        commentsCount:  item.commentsCount ?? item.comments ?? item.commentCount ?? 0,
        videoPlayCount: item.videoPlayCount ?? item.videoViewCount ?? item.views ?? item.playCount ?? null,
        videoDuration:  item.videoDuration ?? item.duration ?? item.video_duration ?? null,
        displayUrl:     item.displayUrl ?? item.thumbnailUrl ?? item.imageUrl ?? item.display_url ?? null,
        videoUrl:       item.videoUrl ?? item.video ?? item.video_url ?? item.downloadedVideo ?? null,
        url:            item.url ?? (shortCode ? `https://www.instagram.com/p/${shortCode}/` : `https://www.instagram.com/${username}/`),
        ownerUsername:  item.ownerUsername ?? item.username ?? item.authorUsername ?? username,
      }
    })
  }

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
  console.log("[content-research] scrapeInstagramProfile returned", items.length, "items")

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
        video_id:      item.id ?? shortCode ?? String(Math.random()),
        title:         (item.caption ?? "").slice(0, 120) || "Sin descripción",
        description:   (item.caption ?? "").slice(0, 300),
        thumbnail:     item.displayUrl ?? null,
        video_url:     postUrl,
        post_url:      postUrl,
        cdn_video_url: item.videoUrl ?? null,
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

  console.log("[content-research] mapped posts after filter+sort:", mapped.length)

  // Transcripciones usando el mismo pipeline que la sección Transcript de videos
  const transcripts = await Promise.all(
    mapped.map((p: any) => getInstagramTranscript(p.post_url, p.cdn_video_url).then(r => r.transcript))
  )

  const posts = mapped.map((p: any, i: number) => {
    const { post_url, cdn_video_url, ...rest } = p
    return { ...rest, transcript: transcripts[i] ?? null }
  })

  return {
    posts,
    profileName:  username,
    profileAvatar: null as string | null,
    profileUrl:   `https://www.instagram.com/${username}/`,
  }
}


// ─── Helpers de caché ─────────────────────────────────────────────────────────

/** ISO start of current UTC week (Monday 00:00:00Z) */
function startOfCurrentWeekUTC(): Date {
  const now = new Date()
  const dow = now.getUTCDay() || 7               // 1=Mon … 7=Sun
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow + 1))
}

/** ISO start of current UTC month */
function startOfCurrentMonthUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
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
      model: "claude-haiku-4-5",
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

    // Tolerant parse: strip markdown fences if model added them
    const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim()
    const parsed  = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.length === videos.length) return parsed

    // Length mismatch — pad or trim gracefully
    if (Array.isArray(parsed)) {
      return videos.map((_, i) => parsed[i] ?? "Análisis no disponible.")
    }
  } catch (error) {
    console.error("[content-research][generateAnalyses] error:", error)
  }

  return videos.map(() => "Análisis no disponible.")
}

// ─── GET: historial ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("content_research_history")
      .select("id, channel_url, channel_name, channel_avatar, timeframe_days, platform, videos, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── POST: nueva investigación ────────────────────────────────────────────────

const MONTHLY_LIMIT = 5

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: "Body inválido." }, { status: 400 })

    const { channel_url, timeframe_days = 60, platform } = body
    if (!channel_url?.trim()) return NextResponse.json({ error: "channel_url requerido" }, { status: 400 })

    const isInstagram = platform === "instagram" || /instagram\.com/.test(channel_url)

    // ── Paso 1: resolver URL canónica (barato) ────────────────────────────
    let canonicalUrl  = ""
    let channelName   = ""
    let channelAvatar: string | null = null
    let channelId     = ""

    if (isInstagram) {
      const username = extractInstagramUsername(channel_url.trim())
      if (!username) return NextResponse.json({ error: "URL de Instagram no válida." }, { status: 400 })
      canonicalUrl = `https://www.instagram.com/${username}/`
      channelName  = username
    } else {
      try {
        const ch      = await resolveChannelId(channel_url.trim())
        channelName   = ch.channelName
        channelAvatar = ch.channelAvatar
        canonicalUrl  = ch.channelUrl
        channelId     = ch.channelId
      } catch (err: any) {
        console.error("[content-research][resolve] error:", err?.message)
        return NextResponse.json({ error: err?.message ?? "No se pudo resolver el canal de YouTube." }, { status: 400 })
      }
    }

    // ── Paso 2: caché semanal — misma cuenta + mismo período esta semana ──
    //    Si ya se analizó → devolvemos el resultado guardado sin gastar tokens
    const weekStart = startOfCurrentWeekUTC()

    const { data: cached, error: cacheErr } = await supabase
      .from("content_research_history")
      .select("id, channel_url, channel_name, channel_avatar, timeframe_days, platform, videos, created_at")
      .eq("user_id", user.id)
      .eq("channel_url", canonicalUrl)
      .eq("timeframe_days", timeframe_days)
      .gte("created_at", weekStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cacheErr) {
      console.warn("[content-research][cache check] error:", cacheErr.message)
      // No bloqueamos — seguimos con análisis fresco
    }

    if (cached) {
      console.log("[content-research] cache hit:", canonicalUrl)
      return NextResponse.json({
        id:            cached.id,
        channelName:   cached.channel_name,
        channelAvatar: cached.channel_avatar,
        channelUrl:    cached.channel_url,
        platform:      cached.platform,
        timeframe_days: cached.timeframe_days,
        videos:        cached.videos,
        cached:        true,
      })
    }

    // ── Paso 3: límite mensual — máx 5 análisis nuevos por mes ───────────
    const monthStart = startOfCurrentMonthUTC()

    const { count: monthCount, error: countErr } = await supabase
      .from("content_research_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString())

    if (countErr) {
      console.warn("[content-research][month count] error:", countErr.message)
    }

    if ((monthCount ?? 0) >= MONTHLY_LIMIT) {
      return NextResponse.json({
        error:       `Límite mensual alcanzado. Podés realizar hasta ${MONTHLY_LIMIT} análisis nuevos por mes. Los análisis ya realizados seguirán disponibles en tu historial.`,
        limit:        MONTHLY_LIMIT,
        used:         monthCount ?? MONTHLY_LIMIT,
        resets_at:    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString(),
        limit_reached: true,
      }, { status: 429 })
    }

    // ── Paso 4: análisis completo (costoso — solo si pasaron pasos 2 y 3) ─
    let videos: any[] = []

    if (isInstagram) {
      const username = extractInstagramUsername(channel_url.trim())!
      try {
        const ig      = await getTopInstagramPosts(username, timeframe_days)
        channelName   = ig.profileName
        channelAvatar = ig.profileAvatar
        canonicalUrl  = ig.profileUrl
        videos        = ig.posts
      } catch (err: any) {
        console.error("[content-research][ig fetch] error:", err?.message)
        return NextResponse.json({ error: "No se pudieron obtener los posts de Instagram. Verificá la URL e intentá de nuevo." }, { status: 502 })
      }
    } else {
      try {
        videos = await getTopVideos(channelId, timeframe_days)
      } catch (err: any) {
        console.error("[content-research][yt videos] error:", err?.message)
        return NextResponse.json({ error: "No se pudieron obtener los videos de YouTube. Verificá la URL e intentá de nuevo." }, { status: 502 })
      }
    }

    if (!videos.length) {
      return NextResponse.json({
        error: isInstagram
          ? "No se encontraron publicaciones recientes en este perfil. Probá con un período de tiempo más largo."
          : `No se encontraron videos recientes en este canal en los últimos ${timeframe_days} días. Probá con un período más largo.`,
      }, { status: 404 })
    }

    // ── Paso 5: análisis Claude (Haiku — optimizado) ──────────────────────
    let analyses: string[]
    try {
      analyses = await generateAnalyses(channelName, videos)
    } catch (err: any) {
      console.error("[content-research][claude] error:", err?.message)
      analyses = videos.map(() => "Análisis no disponible.")
    }

    const videosWithAnalysis = videos.map((v: any, i: number) => ({
      ...v,
      analysis: analyses[i] ?? "Análisis no disponible.",
    }))

    // ── Paso 6: guardar en historial ──────────────────────────────────────
    const { data: inserted, error: insertErr } = await supabase
      .from("content_research_history")
      .insert({
        user_id:        user.id,
        platform:       isInstagram ? "instagram" : "youtube",
        channel_url:    canonicalUrl,
        channel_name:   channelName,
        channel_avatar: channelAvatar,
        timeframe_days,
        videos:         videosWithAnalysis,
      })
      .select("id")
      .single()

    if (insertErr) console.warn("[content-research][insert] error:", insertErr.message)

    return NextResponse.json({
      id:            inserted?.id ?? null,
      channelName,
      channelAvatar,
      channelUrl:    canonicalUrl,
      platform:      isInstagram ? "instagram" : "youtube",
      timeframe_days,
      videos:        videosWithAnalysis,
      cached:        false,
      used:          (monthCount ?? 0) + 1,
      limit:         MONTHLY_LIMIT,
    })
  } catch (err: any) {
    console.error("[content-research][POST] error:", err)
    return NextResponse.json({ error: err?.message ?? "Error interno. Intentá de nuevo en unos minutos." }, { status: 500 })
  }
}

// ─── DELETE: eliminar análisis ────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

    await supabase.from("content_research_history").delete().eq("id", id).eq("user_id", user.id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
