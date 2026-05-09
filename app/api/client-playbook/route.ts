/**
 * Client Playbook — pages multi-doc por cliente.
 *
 * Permisos:
 *  - admin / team: pueden ver/editar las páginas de cualquier cliente.
 *  - client: solo las páginas de SU client_id.
 *
 * El "client_id" target del request:
 *  - admin/team lo manda explícito (?client_id=...)
 *  - client implícito → su propio profile.client_id (cualquier client_id en
 *                       el query param se ignora)
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SELECT_FIELDS = "id, client_id, parent_id, title, icon, content, sort_order, is_seed, created_by, created_at, updated_at"

interface AuthCtx {
  userId:    string
  role:      "admin" | "team" | "client"
  clientId:  string | null  // del profile (puede ser null para admin/team)
}

async function authenticate(jwt: string | null): Promise<AuthCtx | null> {
  if (!jwt) return null
  const sb = createServiceClient()
  const { data: { user }, error } = await sb.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await sb
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .maybeSingle()
  const role = String((profile as any)?.role ?? "").toLowerCase()
  if (role !== "admin" && role !== "team" && role !== "client") return null
  return {
    userId:   user.id,
    role:     role as AuthCtx["role"],
    clientId: (profile as any)?.client_id ?? null,
  }
}

/** Resuelve el client_id efectivo del request según el rol. */
function resolveTargetClientId(ctx: AuthCtx, requested: string | null): string | null {
  if (ctx.role === "client") return ctx.clientId
  if (!requested) return null
  return requested
}

// ─── GET ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await authenticate(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const requested = req.nextUrl.searchParams.get("client_id")
    const targetClientId = resolveTargetClientId(ctx, requested)
    if (!targetClientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 })

    const sb = createServiceClient()
    const { data, error } = await sb
      .from("client_playbook_pages")
      .select(SELECT_FIELDS)
      .eq("client_id", targetClientId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ pages: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── POST — create page ───────────────────────────────────────────────────
//
// Body: { client_id, title, icon?, parent_id?, content?, is_seed? }
// Soporta bulk seed: { client_id, seeds: [{ title, icon, content }, ...] }

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await authenticate(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const targetClientId = resolveTargetClientId(ctx, body.client_id ?? null)
    if (!targetClientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 })

    const sb = createServiceClient()

    // ── Bulk seed (solo admin/team) ─────────────────────────────────────────
    if (Array.isArray(body.seeds)) {
      if (ctx.role === "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

      const rows = body.seeds.map((s: any, i: number) => ({
        client_id:  targetClientId,
        parent_id:  null,
        title:      typeof s.title === "string" && s.title.trim() ? s.title.trim() : "Sin título",
        icon:       typeof s.icon === "string" && s.icon.trim() ? s.icon.trim() : null,
        content:    Array.isArray(s.content) ? s.content : [],
        sort_order: i,
        is_seed:    true,
        created_by: ctx.userId,
      }))

      const { data, error } = await sb
        .from("client_playbook_pages")
        .insert(rows)
        .select(SELECT_FIELDS)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ pages: data ?? [] })
    }

    // ── Single create ───────────────────────────────────────────────────────
    const { title, icon, parent_id, content } = body

    // sort_order = max + 1 entre siblings del mismo client
    const { data: siblings } = await sb
      .from("client_playbook_pages")
      .select("sort_order")
      .eq("client_id", targetClientId)
      .eq("parent_id", parent_id ?? null)
      .order("sort_order", { ascending: false })
      .limit(1)
    const nextOrder = siblings && siblings.length > 0
      ? Number((siblings[0] as any).sort_order ?? 0) + 1
      : 0

    const { data, error } = await sb
      .from("client_playbook_pages")
      .insert({
        client_id:  targetClientId,
        parent_id:  parent_id ?? null,
        title:      typeof title === "string" && title.trim() ? title.trim() : "Sin título",
        icon:       typeof icon === "string" && icon.trim() ? icon.trim() : null,
        content:    Array.isArray(content) ? content : [],
        sort_order: nextOrder,
        is_seed:    false,
        created_by: ctx.userId,
      })
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ page: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── PATCH — update page ───────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await authenticate(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const sb = createServiceClient()

    // Verificar acceso a la page (cliente solo puede tocar las suyas)
    const { data: existing } = await sb
      .from("client_playbook_pages")
      .select("client_id")
      .eq("id", id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (ctx.role === "client" && (existing as any).client_id !== ctx.clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const allowed: Record<string, any> = {}
    if (typeof body.title === "string")   allowed.title = body.title.trim() || "Sin título"
    if (typeof body.icon === "string" || body.icon === null) allowed.icon = body.icon || null
    if (Array.isArray(body.content))      allowed.content = body.content
    if (Number.isFinite(body.sort_order)) allowed.sort_order = Number(body.sort_order)
    if (typeof body.parent_id === "string" || body.parent_id === null) allowed.parent_id = body.parent_id

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data, error } = await sb
      .from("client_playbook_pages")
      .update(allowed)
      .eq("id", id)
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ page: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── DELETE — only admin/team ──────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await authenticate(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (ctx.role === "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const sb = createServiceClient()
    const { error } = await sb.from("client_playbook_pages").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
