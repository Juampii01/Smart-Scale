import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

// ─── Instagram scraping ───────────────────────────────────────────────────────

const IG_HEADERS: Record<string, string> = {
  "User-Agent":       "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept":           "application/json, text/plain, */*",
  "Accept-Language":  "es,en;q=0.9",
  "X-IG-App-ID":      "936619743392459",
  "X-Requested-With": "XMLHttpRequest",
}

function mapIGEdges(edges: any[], username: string) {
  return edges.map((e: any) => {
    const n = e.node
    return {
      id:             n.id,
      shortCode:      n.shortcode,
      caption:        n.edge_media_to_caption?.edges?.[0]?.node?.text ?? "",
      timestamp:      n.taken_at_timestamp ? new Date(n.taken_at_timestamp * 1000).toISOString() : null,
      likesCount:     n.edge_media_preview_like?.count ?? 0,
      commentsCount:  n.edge_media_to_comment?.count  ?? 0,
      videoPlayCount: n.video_view_count ?? null,
      videoDuration:  n.video_duration   ?? null,
      displayUrl:     n.display_url      ?? null,
      url:            `https://www.instagram.com/p/${n.shortcode}/`,
      ownerUsername:  username,
      type:           n.is_video ? "Video" : "Image",
    }
  })
}

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
      console.log("[video-feed][apify] attempt:", attempt.actor, attempt.input)

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt.input),
        signal: AbortSignal.timeout(60_000),
      })

      const raw = await res.text()
      console.log("[video-feed][apify] status:", attempt.actor, res.status)

      if (!res.ok) {
        console.log("[video-feed][apify] body:", raw.slice(0, 500))
        continue
      }

      let data: any = null
      try {
        data = JSON.parse(raw)
      } catch {
        console.log("[video-feed][apify] invalid JSON:", attempt.actor, raw.slice(0, 300))
        continue
      }

      const items = Array.isArray(data)
        ? data
        : data?.items ?? data?.results ?? []

      if (Array.isArray(items) && items.length > 0) {
        console.log("[video-feed][apify] items:", attempt.actor, items.length)
        return items
      }
    } catch (e) {
      console.log("[video-feed][apify] exception:", attempt.actor, String(e))
    }
  }

  return []
}

async function getInstagramPosts(url: string) {
  const username = url.match(/instagram\.com\/([^/?&]+)/)?.[1]
    ?? url.replace(/.*instagram\.com\/?/, "").replace(/\/$/, "")

  let rawItems: any[] = []

  // 1. Direct fetch
  try {
    const res = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      { headers: IG_HEADERS, signal: AbortSignal.timeout(12_000) }
    )

    console.log("[video-feed] direct IG status:", res.status)

    if (res.ok) {
      const data = await res.json()
      const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
      console.log("[video-feed] direct IG edges:", edges.length)
      if (edges.length > 0) rawItems = mapIGEdges(edges, username)
    }
  } catch (e) {
    console.log("[video-feed] direct IG error:", String(e))
  }

  // 2. Apify fallback
  if (!rawItems.length) {
    const apifyItems = await apifyInstagramProfileFetch(username)
    if (apifyItems.length) {
      rawItems = apifyItems.map((item: any) => {
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

        const isVideo =
          item.type === "Video" ||
          item.mediaType === "Video" ||
          item.media_type === 2 ||
          !!(item.videoUrl ?? item.video ?? item.video_url ?? item.downloadedVideo)

        return {
          id:             item.id ?? shortCode ?? String(Math.random()),
          shortCode,
          caption:        item.caption ?? item.text ?? item.title ?? item.description ?? item.captionText ?? "",
          timestamp:      isoTimestamp,
          likesCount:     item.likesCount ?? item.likes ?? item.likeCount ?? 0,
          commentsCount:  item.commentsCount ?? item.comments ?? item.commentCount ?? 0,
          videoPlayCount: item.videoPlayCount ?? item.videoViewCount ?? item.views ?? item.playCount ?? 0,
          videoDuration:  item.videoDuration ?? item.duration ?? item.video_duration ?? null,
          displayUrl:     item.displayUrl ?? item.thumbnailUrl ?? item.imageUrl ?? item.display_url ?? null,
          url:            item.url ?? (shortCode ? `https://www.instagram.com/p/${shortCode}/` : `https://www.instagram.com/${username}/`),
          ownerUsername:  item.ownerUsername ?? item.username ?? item.authorUsername ?? username,
          type:           isVideo ? "Video" : "Image",
        }
      })
      console.log("[video-feed] apify mapped items:", rawItems.length)
    }
  }

  if (!rawItems.length) {
    console.log("[video-feed] no posts found for profile:", username)
    throw new Error("No se encontraron posts en este perfil.")
  }

  const posts = rawItems.map((item: any) => ({
    post_id:      item.id ?? item.shortCode ?? String(Math.random()),
    type:         item.type ?? (item.isVideo ? "Video" : "Image"),
    title:        (item.caption ?? "").slice(0, 120) || "Sin descripción",
    caption:      (item.caption ?? "").slice(0, 300),
    thumbnail:    item.displayUrl ?? item.thumbnailUrl ?? null,
    post_url:     item.url
      ?? (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : null)
      ?? `https://www.instagram.com/${username}/`,
    views:        Math.max(0, item.videoPlayCount ?? item.videoViewCount ?? item.likesCount ?? 0),
    likes:        item.likesCount    ?? 0,
    comments:     item.commentsCount ?? 0,
    duration:     item.videoDuration
      ? `${Math.floor(item.videoDuration / 60)}:${String(Math.round(item.videoDuration % 60)).padStart(2, "0")}`
      : null,
    published_at: item.timestamp ?? null,
    analysis:     null as string | null,
  }))

  return {
    posts,
    profileName:   username,
    profileUrl:    `https://www.instagram.com/${username}/`,
    profileAvatar: null as string | null,
  }
}

// ─── Engagement score: (views + comments) / 2 ────────────────────────────────

function engScore(post: any): number {
  return (post.views + post.comments) / 2
}

// ─── AI Analysis — Haiku (lowest cost) ───────────────────────────────────────

async function analyzeNewPosts(profileName: string, posts: any[]): Promise<(string | null)[]> {
  if (!posts.length) return []

  // Analyze top 15 by score max — keeps token cost minimal
  const ranked = [...posts].sort((a, b) => engScore(b) - engScore(a)).slice(0, 15)
  const idxMap = new Map(ranked.map((p, i) => [p.post_id, i]))

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const list = ranked.map((p, i) =>
      `${i + 1}. "${p.title.slice(0, 80)}" — ${p.views.toLocaleString()} views, ${p.comments.toLocaleString()} comentarios`
    ).join("\n")

    const msg = await anthropic.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 1200,
      messages: [{
        role:    "user",
        content: `Experto en contenido. Analizá ${ranked.length} posts de "${profileName}". Por cada uno: 2 oraciones en español sobre por qué funcionó y qué patrón usa.\n\n${list}\n\nRespondé SOLO con JSON array de ${ranked.length} strings. Sin markdown.`,
      }],
    })

    const text   = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]"
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return posts.map(() => null)

    return posts.map(p => {
      const idx = idxMap.get(p.post_id)
      return idx !== undefined ? (parsed[idx] ?? null) : null
    })
  } catch {
    return posts.map(() => null)
  }
}

// ─── GET: leer desde Supabase — sin tocar Instagram ──────────────────────────

export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("video_feed_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ account: data ?? null })
  } catch (err: any) {
    console.log("[video-feed][GET] error:", err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── POST: conectar (1ra vez) o refrescar (incremental) ──────────────────────

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { channel_url } = await req.json()
    if (!channel_url?.trim()) return NextResponse.json({ error: "channel_url requerido" }, { status: 400 })

    // 1. Load existing stored posts
    const { data: existing } = await supabase
      .from("video_feed_accounts")
      .select("posts, channel_avatar")
      .eq("user_id", user.id)
      .maybeSingle()

    const existingPosts: any[] = existing?.posts ?? []
    const existingIds          = new Set(existingPosts.map((p: any) => p.post_id))

    // 2. 30-day window
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // 3. Fetch latest from Instagram
    const ig = await getInstagramPosts(channel_url.trim())

    // 4. Only keep posts within last 30 days
    const withinWindow = ig.posts.filter(p => p.published_at && p.published_at >= thirtyDaysAgo)

    // 5. Isolate truly new posts (not yet stored)
    const newPosts = withinWindow.filter(p => !existingIds.has(p.post_id))

    // 6. Analyze ONLY new posts — existing analyses are preserved
    if (newPosts.length > 0) {
      const analyses = await analyzeNewPosts(ig.profileName, newPosts)
      newPosts.forEach((p, i) => { p.analysis = analyses[i] })
    }

    // 7. Merge: new + existing still within 30-day window
    const existingWithin30 = existingPosts.filter((p: any) =>
      p.published_at && p.published_at >= thirtyDaysAgo
    )
    const merged = [...newPosts, ...existingWithin30]

    // 8. Sort by engagement score
    merged.sort((a, b) => engScore(b) - engScore(a))

    // 9. Save to Supabase
    await supabase
      .from("video_feed_accounts")
      .upsert(
        {
          user_id:        user.id,
          platform:       "instagram",
          channel_url:    ig.profileUrl,
          channel_name:   ig.profileName,
          channel_avatar: ig.profileAvatar ?? existing?.channel_avatar ?? null,
          posts:          merged,
          updated_at:     new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    return NextResponse.json({
      channelName:   ig.profileName,
      channelAvatar: ig.profileAvatar ?? existing?.channel_avatar ?? null,
      channelUrl:    ig.profileUrl,
      platform:      "instagram",
      posts:         merged,
      newPostsCount: newPosts.length,
    })
  } catch (err: any) {
    console.log("[video-feed][POST] error:", err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── DELETE: desconectar ──────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await supabase.from("video_feed_accounts").delete().eq("user_id", user.id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.log("[video-feed][DELETE] error:", err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
