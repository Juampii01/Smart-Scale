/**
 * Prospección — workspace setter-only.
 *
 * - Lectura: setter (sus propios items) + admin (todos, audit)
 * - Escritura: setter (sus propios) + admin
 * - team: 0 acceso
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SELECT_FIELDS = "id, setter_id, title, content, item_type, tags, status, created_at, updated_at"

// ─── Auth helper ──────────────────────────────────────────────────────────────

interface AuthCtx {
  userId: string
  role:   "admin" | "setter"
}

/** Solo admin/setter pueden tocar este endpoint. team y cliente reciben 403. */
async function requireProspeccionAccess(jwt: string | null): Promise<AuthCtx | null> {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = String((profile as any)?.role ?? "").toLowerCase()
  if (role !== "admin" && role !== "setter") return null
  return { userId: user.id, role: role as "admin" | "setter" }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await requireProspeccionAccess(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    let query = supabase
      .from("prospeccion_items")
      .select(SELECT_FIELDS)
      .order("created_at", { ascending: false })

    // Setter ve solo lo suyo. Admin puede pasar ?setter_id=... para filtrar (audit).
    if (ctx.role === "setter") {
      query = query.eq("setter_id", ctx.userId)
    } else {
      const { searchParams } = new URL(req.url)
      const filterSetter = searchParams.get("setter_id")
      if (filterSetter) query = query.eq("setter_id", filterSetter)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await requireProspeccionAccess(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { title, content, item_type, tags, status, setter_id } = body
    if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 })

    // Setter solo crea como propietario. Admin puede pasar setter_id explícito.
    const ownerId = (ctx.role === "admin" && typeof setter_id === "string" && setter_id)
      ? setter_id
      : ctx.userId

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("prospeccion_items")
      .insert({
        setter_id: ownerId,
        title:     title.trim(),
        content:   content?.trim() || null,
        item_type: item_type?.trim() || "nota",
        tags:      Array.isArray(tags) ? tags.filter((t: any) => typeof t === "string" && t.trim()) : [],
        status:    status?.trim() || "activo",
      })
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await requireProspeccionAccess(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()

    // Setter solo puede editar lo suyo. Verificamos antes de aplicar.
    if (ctx.role === "setter") {
      const { data: existing } = await supabase
        .from("prospeccion_items")
        .select("setter_id")
        .eq("id", id)
        .maybeSingle()
      if (!existing || (existing as any).setter_id !== ctx.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const allowed: Record<string, any> = {}
    if (typeof rest.title     === "string") allowed.title     = rest.title.trim()
    if (typeof rest.content   === "string") allowed.content   = rest.content.trim() || null
    if (typeof rest.item_type === "string") allowed.item_type = rest.item_type.trim() || "nota"
    if (Array.isArray(rest.tags))           allowed.tags      = rest.tags.filter((t: any) => typeof t === "string" && t.trim())
    if (typeof rest.status    === "string") allowed.status    = rest.status.trim() || "activo"

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("prospeccion_items")
      .update(allowed)
      .eq("id", id)
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ item: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await requireProspeccionAccess(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()

    if (ctx.role === "setter") {
      const { data: existing } = await supabase
        .from("prospeccion_items")
        .select("setter_id")
        .eq("id", body.id)
        .maybeSingle()
      if (!existing || (existing as any).setter_id !== ctx.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const { error } = await supabase.from("prospeccion_items").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
