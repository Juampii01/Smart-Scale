import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function verifyUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? ""
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!jwt) return { user: null, error: "Unauthorized" }
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return { user: null, error: "Unauthorized" }
  return { user, error: null }
}

// GET /api/competitor-research?client_id=xxx
export async function GET(req: NextRequest) {
  try {
    const { user, error: authErr } = await verifyUser(req)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get("client_id")
    if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("competitor_posts")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ posts: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal server error" }, { status: 500 })
  }
}

// POST /api/competitor-research
export async function POST(req: NextRequest) {
  try {
    const { user, error: authErr } = await verifyUser(req)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()

    // Check role
    const { data: prof } = await supabase
      .from("profiles")
      .select("role, client_id")
      .eq("id", user.id)
      .maybeSingle()

    const role = (prof as any)?.role as string | undefined
    const isAdmin = (role ?? "").toLowerCase() === "admin"

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const clientId = typeof body.client_id === "string" ? body.client_id : (prof as any)?.client_id
    if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 })

    // Non-admin can only insert for their own client
    if (!isAdmin && (prof as any)?.client_id !== clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const row = {
      client_id:   clientId,
      creator:     typeof body.creator === "string" ? body.creator.trim() : "",
      post_url:    typeof body.post_url === "string" ? body.post_url.trim() : null,
      description: typeof body.description === "string" ? body.description.trim() : null,
      views:       body.views != null ? Number(body.views) : null,
      duration:    typeof body.duration === "string" ? body.duration.trim() : null,
      likes:       body.likes != null ? Number(body.likes) : null,
      comments:    body.comments != null ? Number(body.comments) : null,
      transcript:  typeof body.transcript === "string" ? body.transcript.trim() : null,
      analysis:    typeof body.analysis === "string" ? body.analysis.trim() : null,
    }

    if (!row.creator) return NextResponse.json({ error: "creator is required" }, { status: 400 })

    const { data: inserted, error: insertErr } = await supabase
      .from("competitor_posts")
      .insert(row)
      .select()
      .single()

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    return NextResponse.json({ post: inserted }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/competitor-research  { id, transcript }
export async function PATCH(req: NextRequest) {
  try {
    const { user, error: authErr } = await verifyUser(req)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    let body: Record<string, unknown>
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const id = typeof body.id === "string" ? body.id : null
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (typeof body.transcript === "string") updates.transcript = body.transcript.trim()
    if (typeof body.analysis   === "string") updates.analysis   = body.analysis.trim()

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: updated, error: updateErr } = await supabase
      .from("competitor_posts")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ post: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal server error" }, { status: 500 })
  }
}
