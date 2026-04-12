import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

// ─── Instagram scraping ───────────────────────────────────────────────────────

const RAPIDAPI_IG_HOST = "instagram-scraper-20253.p.rapidapi.com"

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

function mapRapidApiItems(items: any[], username: string) {
  return items.map((item: any) => {
    const shortCode = item.code ?? item.shortcode ?? null
    const isVideo   = item.media_type === 2 || !!item.video_url
    return {
      id:             item.pk ?? item.id ?? String(Math.random()),
      shortCode,
      caption:        item.caption?.text ?? item.caption ?? "",
      timestamp:      item.taken_at ? new Date(item.taken_at * 1000).toISOString() : null,
      likesCount:     item.like_count ?? 0,
      commentsCount:  item.comment_count ?? 0,
      videoPlayCount: item.play_count ?? item.view_count ?? null,
      videoDuration:  item.video_duration ?? null,
      displayUrl:     item.image_versions2?.candidates?.[0]?.url ?? item.thumbnail_url ?? null,
      url:            shortCode ? `https://www.instagram.com/p/${shortCode}/` : `https://www.instagram.com/${username}/`,
      ownerUsername:  username,
      type:           isVideo ? "Video" : "Image",
    }
  })
}

async function getInstagramPosts(url: string) {
  const username = url.match(/instagram\.com\/([^/?&]+)/)?.[1]
    ?? url.replace(/.*instagram\.com\/?/, "").replace(/\/$/, "")

  let rawItems: any[] = []

  // 1. Direct fetch (works in dev)
  try {
    const res = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      { headers: IG_HEADERS, signal: AbortSignal.timeout(12_000) }
    )
    if (res.ok) {
      const data  = await res.json()
      const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
      if (edges.length > 0) rawItems = mapIGEdges(edges, username)
    }
  } catch {}

  // 2. RapidAPI fallback (works in prod)
  if (!rawItems.length && process.env.RAPIDAPI_KEY) {
    try {
      const res = await fetch(
        `https://${RAPIDAPI_IG_HOST}/user-reels?username_or_id_or_url=${encodeURIComponent(username)}&url_embed_safe=false`,
        {
          headers: { "X-RapidAPI-Key": process.env.RAPIDAPI_KEY, "X-RapidAPI-Host": RAPIDAPI_IG_HOST },
          signal:  AbortSignal.timeout(30_000),
        }
      )
      if (res.ok) {
        const data  = await res.json()
        const items = data?.data?.items ?? data?.items ?? []
        if (Array.isArray(items) && items.length) rawItems = mapRapidApiItems(items, username)
      }
    } catch {}
  }

  if (!rawItems.length) throw new Error("No se encontraron posts en este perfil.")

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
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
