/**
 * Prospección — workspace setter-only, dentro del sector interno del tenant.
 *
 * - Lectura: setter (sus propios items del tenant) + admin (todos los del
 *   tenant, audit) + platform owner (cualquier tenant, "Ver Clientes")
 * - Escritura: setter (sus propios, dentro de su tenant) + admin
 * - team: 0 acceso
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"
import { resolveInternalScope } from "@/lib/auth/internal-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SELECT_FIELDS = "id, client_id, setter_id, title, content, item_type, tags, status, created_at, updated_at"

function requestedTenantId(req: NextRequest, body?: any): string | null {
  return req.nextUrl.searchParams.get("client_id") ?? body?.client_id ?? null
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const scope = await resolveInternalScope(req, requestedTenantId(req))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    if (!isAdmin(scope.role) && scope.role !== "setter") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = createServiceClient()
    let query = supabase
      .from("prospeccion_items")
      .select(SELECT_FIELDS)
      .eq("client_id", scope.tenantId)
      .order("created_at", { ascending: false })

    // Setter ve solo lo suyo. Admin puede pasar ?setter_id=... para filtrar (audit).
    if (scope.role === "setter") {
      query = query.eq("setter_id", scope.userId)
    } else {
      const filterSetter = req.nextUrl.searchParams.get("setter_id")
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
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    if (!isAdmin(scope.role) && scope.role !== "setter") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { title, content, item_type, tags, status, setter_id } = body
    if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 })

    // Setter solo crea como propietario. Admin puede pasar setter_id explícito.
    const ownerId = (isAdmin(scope.role) && typeof setter_id === "string" && setter_id)
      ? setter_id
      : scope.userId

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("prospeccion_items")
      .insert({
        client_id: scope.tenantId,
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
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    if (!isAdmin(scope.role) && scope.role !== "setter") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()

    // Setter solo puede editar lo suyo, dentro de su tenant. Verificamos antes de aplicar.
    if (scope.role === "setter") {
      const { data: existing } = await supabase
        .from("prospeccion_items")
        .select("setter_id, client_id")
        .eq("id", id)
        .maybeSingle()
      if (!existing || (existing as any).setter_id !== scope.userId || (existing as any).client_id !== scope.tenantId) {
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
      .eq("client_id", scope.tenantId)
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
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    if (!isAdmin(scope.role) && scope.role !== "setter") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = createServiceClient()

    if (scope.role === "setter") {
      const { data: existing } = await supabase
        .from("prospeccion_items")
        .select("setter_id, client_id")
        .eq("id", body.id)
        .maybeSingle()
      if (!existing || (existing as any).setter_id !== scope.userId || (existing as any).client_id !== scope.tenantId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const { error } = await supabase.from("prospeccion_items").delete().eq("id", body.id).eq("client_id", scope.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
