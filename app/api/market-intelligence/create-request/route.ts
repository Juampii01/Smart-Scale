import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function enrichYouTubeChannel(url: string) {
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
  if (!YOUTUBE_API_KEY) throw new Error("Missing YOUTUBE_API_KEY")

  // Extract channel handle or ID
  const handleMatch = url.match(/@([^\/]+)/)
  const channelMatch = url.match(/channel\/([^\/]+)/)

  let channelId = ""

  if (channelMatch) {
    channelId = channelMatch[1]
  } else if (handleMatch) {
    const handle = handleMatch[1]
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handle}&key=${YOUTUBE_API_KEY}`
    )
    const searchData = await searchRes.json()
    channelId = searchData.items?.[0]?.snippet?.channelId
  }

  if (!channelId) throw new Error("Could not resolve channelId")
  const channel_url = `https://www.youtube.com/channel/${channelId}`

  // Get channel info
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`
  )
  const channelData = await channelRes.json()
  const channel = channelData.items?.[0]

  // Get last 10 videos
  const videosRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet&order=date&maxResults=10&type=video`
  )
  const videosData = await videosRes.json()

  const videoIdsArr: string[] =
    videosData.items?.map((v: any) => v?.id?.videoId).filter(Boolean) || []
  const videoIds = videoIdsArr.join(",")

  let statsData: any = { items: [] }
  if (videoIdsArr.length > 0) {
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    )
    statsData = await statsRes.json()
  }

  const channel_name = channel?.snippet?.title || ""

  const videos =
    statsData.items?.map((v: any, index: number) => {
      const snippet = videosData.items?.[index]?.snippet
      const thumb =
        snippet?.thumbnails?.maxres?.url ||
        snippet?.thumbnails?.high?.url ||
        snippet?.thumbnails?.medium?.url ||
        snippet?.thumbnails?.default?.url ||
        null

      return {
        creator: channel_name,
        video_id: v.id,
        title: snippet?.title || v?.snippet?.title || "",
        video_url: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnail_url: thumb,
        views: Number(v?.statistics?.viewCount || 0),
        duration: v?.contentDetails?.duration || null,
        // Transcript requires captions/OAuth or a dedicated transcript provider.
        // We keep a placeholder so the worker/UI can handle it consistently.
        transcript: null,
      }
    }) || []

  const avgViews =
    videos.length > 0
      ? Math.round(
          videos.reduce((acc: number, v: any) => acc + v.views, 0) /
            videos.length
        )
      : 0

  return {
    channel_id: channelId,
    channel_url,
    name: channel?.snippet?.title || "",
    bio: channel?.snippet?.description || "",
    avg_views: avgViews,
    videos,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { platform, timeframe_days, competitors, access_token, client_id } =
      body

    if (!access_token)
      return NextResponse.json(
        { error: "No access_token provided" },
        { status: 401 }
      )

    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    )
      return NextResponse.json(
        { error: "Missing Supabase environment variables" },
        { status: 500 }
      )

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    )

    const payload = JSON.parse(
      Buffer.from(access_token.split(".")[1], "base64").toString("utf8")
    )

    const user_id = payload.sub

    if (platform !== "youtube")
      return NextResponse.json(
        { error: "Only YouTube supported for now" },
        { status: 400 }
      )

    if (![30, 60, 90].includes(timeframe_days))
      return NextResponse.json(
        { error: "Invalid timeframe" },
        { status: 400 }
      )

    if (!Array.isArray(competitors) || competitors.length < 1)
      return NextResponse.json(
        { error: "Invalid competitors" },
        { status: 400 }
      )

    const enrichedCompetitors = await Promise.all(
      competitors.map((url: string) => enrichYouTubeChannel(url))
    )

    const { data, error } = await supabase
      .from("research_requests")
      .insert({
        user_id,
        platform,
        timeframe_days,
        competitors: enrichedCompetitors,
        status: "pending",
        ...(client_id ? { client_id } : {}),
      })
      .select("id")
      .single()

    if (error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )

    await supabase.functions.invoke("research-worker", {
      body: { request_id: data.id },
    })

    return NextResponse.json({ request_id: data.id })
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", detail: error.message },
      { status: 500 }
    )
  }
}
