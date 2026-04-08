/**
 * Shared Instagram transcription pipeline.
 * Used by both /api/transcript and /api/content-research.
 *
 * Logic mirrors app/api/transcript/route.ts exactly — any fix there
 * should be mirrored here (or ideally both imported from here).
 */

const RAPIDAPI_IG_HOST = "instagram-scraper-20253.p.rapidapi.com"

// ─── AssemblyAI: download → upload → transcribe ───────────────────────────────

export async function assemblyAITranscript(cdnUrl: string, timeoutMs = 200_000): Promise<string | null> {
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

// ─── RapidAPI + HTML fallbacks: extract video URL ─────────────────────────────

async function rapidApiGetVideoUrl(
  lookupKey: string,
  shortCode: string,
  postUrl?: string
): Promise<{ videoUrl: string | null; caption: string | null; duration: string | null; username?: string | null }> {
  const empty = { videoUrl: null, caption: null, duration: null }
  if (!process.env.RAPIDAPI_KEY) return empty

  const isUsernameKey = !lookupKey.startsWith("http")

  const headers = {
    "Content-Type": "application/json",
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
    "X-RapidAPI-Host": RAPIDAPI_IG_HOST,
  }

  if (isUsernameKey) try {
    console.log("[ig-transcript] rapidapi userreels lookup:", lookupKey, "shortCode:", shortCode)

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

      console.log("[ig-transcript] rapidapi userreels missing video fields:", {
        itemsCount: items.length,
        matchedShortCode: !!match,
        hasVideoUrl: !!match?.video_url,
        hasVideoVersions: !!match?.video_versions,
        hasCarouselMedia: !!match?.carousel_media,
      })
    } else {
      const errorText = await res.text().catch(() => "")
      console.log("[ig-transcript] rapidapi status:", res.status, errorText)
    }
  } catch (err) {
    console.log("[ig-transcript] rapidapi error:", err)
  }

  // Fallbacks: try Instagram embed pages and the public page HTML.
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
      console.log("[ig-transcript] api fallback url:", apiUrl)
      const apiRes = await fetch(apiUrl, {
        headers: htmlHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      })

      if (!apiRes.ok) {
        console.log("[ig-transcript] api fallback status:", apiUrl, apiRes.status)
        continue
      }

      const contentType = apiRes.headers.get("content-type") ?? ""
      const raw = await apiRes.text()
      console.log("[ig-transcript] api fallback content-type:", apiUrl, contentType)

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

          // oEmbed returns author_name even when no video_url — use it to retry RapidAPI
          const authorName = json?.author_name ?? null
          console.log("[ig-transcript] api fallback json author_name:", authorName)
          if (authorName && process.env.RAPIDAPI_KEY) {
            console.log("[ig-transcript] retrying RapidAPI with author_name:", authorName)
            const rapidHeaders = {
              "Content-Type": "application/json",
              "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
              "X-RapidAPI-Host": RAPIDAPI_IG_HOST,
            }
            const rapidRes = await fetch(
              `https://${RAPIDAPI_IG_HOST}/user-reels?username_or_id_or_url=${encodeURIComponent(authorName)}`,
              { headers: rapidHeaders, signal: AbortSignal.timeout(30_000) }
            )
            if (rapidRes.ok) {
              const data = await rapidRes.json()
              const items: any[] = data?.data?.items ?? data?.items ?? []
              const match =
                items.find((it: any) => (it.code ?? it.shortcode) === shortCode) ??
                items.find((it: any) => `${it.code ?? it.shortcode ?? ""}`.toLowerCase() === shortCode.toLowerCase())
              const videoUrl = match?.video_url ?? match?.video_versions?.[0]?.url ?? null
              console.log("[ig-transcript] RapidAPI via oEmbed author — items:", items.length, "videoUrl:", !!videoUrl)
              if (videoUrl) {
                const rawDur = match?.video_duration ?? match?.duration ?? null
                return {
                  videoUrl,
                  caption: match?.caption?.text ?? match?.caption ?? json?.title ?? null,
                  duration: rawDur && Number.isFinite(Number(rawDur))
                    ? `${Math.floor(Number(rawDur) / 60)}:${String(Math.round(Number(rawDur) % 60)).padStart(2, "0")}`
                    : null,
                  username: authorName,
                }
              }
            }
          }
        } catch (err) {
          console.log("[ig-transcript] api fallback json parse error:", apiUrl, err)
        }
      }

      const extracted = extractVideoFromHtml(raw)
      if (extracted?.videoUrl) {
        return extracted
      }
    } catch (err) {
      console.log("[ig-transcript] api fallback error:", apiUrl, err)
    }
  }

  for (const candidateUrl of candidateUrls) {
    try {
      console.log("[ig-transcript] html fallback url:", candidateUrl)
      const pageRes = await fetch(candidateUrl, {
        headers: htmlHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      })

      if (!pageRes.ok) {
        console.log("[ig-transcript] html fallback status:", candidateUrl, pageRes.status)
        continue
      }

      const html = await pageRes.text()
      const extracted = extractVideoFromHtml(html)
      console.log("[ig-transcript] html fallback markers:", candidateUrl, {
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
      if (extracted?.username && process.env.RAPIDAPI_KEY) {
        console.log("[ig-transcript] got username from HTML:", extracted.username, "— retrying RapidAPI")
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
            console.log("[ig-transcript] RapidAPI retry result — items:", items.length, "videoUrl:", !!videoUrl)
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
          console.log("[ig-transcript] RapidAPI retry error:", err)
        }
      }
    } catch (err) {
      console.log("[ig-transcript] html fallback error:", candidateUrl, err)
    }
  }

  return empty
}

// ─── Main export: full Instagram transcript pipeline ─────────────────────────

export async function getInstagramTranscript(
  postUrl: string,
  cdnVideoUrl?: string | null
): Promise<{ transcript: string | null; caption: string | null; duration: string | null; username: string | null }> {
  // Fast path: if the caller already has a CDN video URL (e.g. from RapidAPI scraping),
  // use the full AssemblyAI pipeline directly (download → upload → transcribe).
  if (cdnVideoUrl) {
    const transcript = await assemblyAITranscript(cdnVideoUrl, 100_000)
    if (transcript) return { transcript, caption: null, duration: null, username: null }
    // If direct CDN transcription fails, fall through to the full pipeline below.
  }

  // Full pipeline: extract shortcode + username → RapidAPI → HTML fallbacks → AssemblyAI
  const shortCode = postUrl.match(/\/(p|reel|reels|tv)\/([^/?#]+)/)?.[2] ?? null

  let username: string | null = null
  const urlUsernameMatch = postUrl.match(/instagram\.com\/([^/?#]+)\/(p|reel|reels|tv)\//)
  if (urlUsernameMatch?.[1] && !["p", "reel", "reels", "tv"].includes(urlUsernameMatch[1])) {
    username = urlUsernameMatch[1]
  }

  // Fallback: oEmbed to get username
  if (!username) {
    const oEmbedUrls = [
      `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(postUrl)}`,
      `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`,
    ]
    for (const oEmbedUrl of oEmbedUrls) {
      try {
        console.log("[ig-transcript] oEmbed attempt:", oEmbedUrl)
        const oEmbedRes = await fetch(oEmbedUrl, { signal: AbortSignal.timeout(8_000) })
        console.log("[ig-transcript] oEmbed status:", oEmbedRes.status)
        if (oEmbedRes.ok) {
          const oEmbed = await oEmbedRes.json()
          username = oEmbed.author_name ?? null
          console.log("[ig-transcript] oEmbed author_name:", username)
          if (username) break
        }
      } catch (err) {
        console.log("[ig-transcript] oEmbed error:", oEmbedUrl, err)
      }
    }
  }

  console.log("[ig-transcript] shortCode:", shortCode, "username:", username)

  if (!shortCode) {
    return { transcript: null, caption: null, duration: null, username }
  }

  if (!username) {
    console.log("[ig-transcript] no username found — skipping RapidAPI, going straight to HTML fallbacks")
  }

  const lookupKey = username ?? postUrl
  console.log("[ig-transcript] lookupKey:", lookupKey, "shortCode:", shortCode)
  const result = await rapidApiGetVideoUrl(lookupKey, shortCode, postUrl)
  const { videoUrl, caption, duration } = result
  if (!username && result.username) username = result.username
  console.log("[ig-transcript] videoUrl found:", !!videoUrl, "username:", username)

  if (!videoUrl) {
    return { transcript: null, caption, duration, username }
  }

  const transcript = await assemblyAITranscript(videoUrl, 100_000)
  return { transcript, caption, duration, username }
}
