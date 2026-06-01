/**
 * Centro Operativo — pages tipo Notion. CRUD.
 *
 * Permisos por rol:
 *  - admin: todas las pages, todos los scopes
 *  - team:  scope = 'global' (no ve 'prospeccion')
 *  - setter: scope = 'prospeccion' (no ve 'global')
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SELECT_FIELDS = "id, parent_id, title, icon, content, sort_order, scope, created_by, created_at, updated_at"

interface AuthCtx {
  userId: string
  role:   "admin" | "team" | "setter"
}

async function requireCentroOpAccess(jwt: string | null): Promise<AuthCtx | null> {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = String((profile as any)?.role ?? "").toLowerCase()
  if (!isAdmin(role) && role !== "team" && role !== "setter") return null
  return { userId: user.id, role: role as AuthCtx["role"] }
}

/** Devuelve los scopes que el rol puede leer/escribir. */
function allowedScopes(role: AuthCtx["role"]): string[] {
  if (isAdmin(role))  return ["global", "prospeccion"]
  if (role === "team")   return ["global"]
  if (role === "setter") return ["prospeccion"]
  return []
}

// ─── GET /api/admin/centro-op-pages — list all visible pages ──────────────────

export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await requireCentroOpAccess(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const scopes = allowedScopes(ctx.role)
    const { data, error } = await supabase
      .from("centro_op_pages")
      .select(SELECT_FIELDS)
      .in("scope", scopes)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ pages: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── POST /api/admin/centro-op-pages — create new page ─────────────────────────

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await requireCentroOpAccess(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { title, icon, parent_id, content, scope } = body

    // Resolver scope efectivo
    const supabase = createServiceClient()
    let effectiveScope: string = "global"

    if (parent_id) {
      // Hereda del padre
      const { data: parent, error: parentErr } = await supabase
        .from("centro_op_pages")
        .select("scope")
        .eq("id", parent_id)
        .maybeSingle()
      if (parentErr || !parent) {
        return NextResponse.json({ error: "Parent page not found" }, { status: 400 })
      }
      effectiveScope = String((parent as any).scope ?? "global")
    } else if (typeof scope === "string" && (scope === "global" || scope === "prospeccion")) {
      effectiveScope = scope
    } else if (ctx.role === "setter") {
      // Setter sin parent → siempre crea en 'prospeccion'
      effectiveScope = "prospeccion"
    }

    // Validar que el rol puede crear en ese scope
    if (!allowedScopes(ctx.role).includes(effectiveScope)) {
      return NextResponse.json({ error: "Forbidden scope" }, { status: 403 })
    }

    // Sort: max sort_order + 1 entre siblings
    const { data: siblings } = await supabase
      .from("centro_op_pages")
      .select("sort_order")
      .eq("parent_id", parent_id ?? null)
      .order("sort_order", { ascending: false })
      .limit(1)
    const nextOrder = siblings && siblings.length > 0
      ? Number((siblings[0] as any).sort_order ?? 0) + 1
      : 0

    const { data, error } = await supabase
      .from("centro_op_pages")
      .insert({
        title:      typeof title === "string" && title.trim() ? title.trim() : "Sin título",
        icon:       typeof icon === "string" && icon.trim() ? icon.trim() : null,
        parent_id:  parent_id ?? null,
        content:    Array.isArray(content) ? content : [],
        sort_order: nextOrder,
        scope:      effectiveScope,
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

// ─── PATCH /api/admin/centro-op-pages — update page ────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await requireCentroOpAccess(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id, _cascade, ...rest } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()

    // Verificar que el rol tiene acceso a la page
    const { data: existing } = await supabase
      .from("centro_op_pages")
      .select("scope")
      .eq("id", id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!allowedScopes(ctx.role).includes(String((existing as any).scope))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const allowed: Record<string, any> = {}
    if (typeof rest.title === "string")    allowed.title = rest.title.trim() || "Sin título"
    if (typeof rest.icon === "string" || rest.icon === null) allowed.icon = rest.icon || null
    if (Array.isArray(rest.content))       allowed.content = rest.content
    if (Number.isFinite(rest.sort_order))  allowed.sort_order = Number(rest.sort_order)
    if (typeof rest.parent_id === "string" || rest.parent_id === null) allowed.parent_id = rest.parent_id

    // Cambio de scope (solo admin puede). Cascadea a todos los descendientes
    // si _cascade=true para mantener la familia en el mismo scope.
    if (
      typeof rest.scope === "string"
      && (rest.scope === "global" || rest.scope === "prospeccion")
      && isAdmin(ctx.role)
    ) {
      allowed.scope = rest.scope
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("centro_op_pages")
      .update(allowed)
      .eq("id", id)
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Cascade scope a descendientes
    if (allowed.scope && _cascade) {
      // BFS recursiva. Recogemos todos los descendientes y bulk-updateamos.
      const toUpdate: string[] = []
      let frontier: string[] = [id]
      const visited = new Set<string>([id])
      while (frontier.length > 0) {
        const { data: children } = await supabase
          .from("centro_op_pages")
          .select("id")
          .in("parent_id", frontier)
        const childIds = (children ?? []).map((r: any) => r.id).filter((cid: string) => !visited.has(cid))
        for (const cid of childIds) {
          visited.add(cid)
          toUpdate.push(cid)
        }
        frontier = childIds
      }
      if (toUpdate.length > 0) {
        await supabase
          .from("centro_op_pages")
          .update({ scope: allowed.scope })
          .in("id", toUpdate)
      }
    }

    return NextResponse.json({ page: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── DELETE /api/admin/centro-op-pages — delete page (cascade children) ────────

export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await requireCentroOpAccess(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()

    // Verificar acceso
    const { data: existing } = await supabase
      .from("centro_op_pages")
      .select("scope")
      .eq("id", body.id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!allowedScopes(ctx.role).includes(String((existing as any).scope))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error } = await supabase.from("centro_op_pages").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
