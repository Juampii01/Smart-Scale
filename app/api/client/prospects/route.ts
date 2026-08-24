import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { resolveSocialScope } from "@/lib/social/scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * /api/client/prospects — Pipeline del CRM interno del cliente (mismo
 * motor de columnas que el pipeline interno, app/api/admin/leads).
 *
 * GET: resolveSocialScope — un cliente solo ve el suyo, staff interno
 * puede pasar ?client_id para ver cualquiera (view-as).
 *
 * POST/PATCH/DELETE: acá el gate es MÁS estricto que resolveSocialScope
 * solo — el CRM interno es la única superficie donde staff NO tiene
 * bypass de escritura, ni con ?client_id (ver prompt-crm.md → Permisos:
 * "el equipo entra en solo lectura, sin excepciones"). Mismo criterio que
 * /api/client/crm/prospects. La RLS de client_prospects (migración
 * 20260824000003) es el segundo cinturón — acá con service_role hace
 * falta el chequeo explícito, RLS nunca es el único gate.
 */

const SELECT_FIELDS =
  "id, client_id, name, email, tag, source, lead_type, status, instagram, rating, niche, notes, purchased, custom_fields, next_follow_up_at, deal_value, created_at"

export async function GET(req: NextRequest) {
  try {
    const scope = await resolveSocialScope(req, req.nextUrl.searchParams.get("client_id"))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("client_prospects")
      .select(SELECT_FIELDS)
      .eq("client_id", scope.clientId)
      .order("created_at", { ascending: false })
      .limit(1000)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ prospects: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const scope = await resolveSocialScope(req, body.client_id)
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    if (scope.role !== "client") {
      return NextResponse.json({ error: "El equipo de Smart Scale ve el CRM en solo lectura." }, { status: 403 })
    }

    const { name, instagram, tag, email, source, lead_type, niche, notes, rating } = body
    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("client_prospects")
      .insert({
        client_id: scope.clientId,
        name:      name.trim(),
        instagram: instagram || null,
        tag:       tag       || null,
        email:     email     || null,
        source:    source    || null,
        lead_type: lead_type || null,
        niche:     niche     || null,
        notes:     notes     || null,
        rating:    rating ? Number(rating) : null,
        status:    "nuevo",
      })
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ prospect: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id, client_id: requestedClientId, ...updates } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const scope = await resolveSocialScope(req, requestedClientId)
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    if (scope.role !== "client") {
      return NextResponse.json({ error: "El equipo de Smart Scale ve el CRM en solo lectura." }, { status: 403 })
    }

    const PATCHABLE = ["status", "source", "lead_type", "niche", "notes", "rating", "instagram", "email", "tag", "name", "purchased", "custom_fields", "next_follow_up_at", "deal_value"]
    const allowed: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of PATCHABLE) {
      if (updates[key] !== undefined) allowed[key] = updates[key]
    }
    if (updates.next_follow_up_at !== undefined) allowed.follow_up_alert_sent_at = null

    const supabase = createServiceClient()
    // client_id en el WHERE (no solo id) es el gate real: previene que un
    // cliente edite una fila de otro adivinando el id, sin depender de RLS
    // (acá se usa service_role, que la bypassea).
    const { error, count } = await supabase
      .from("client_prospects")
      .update(allowed, { count: "exact" })
      .eq("id", id)
      .eq("client_id", scope.clientId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!count) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const scope = await resolveSocialScope(req, body.client_id)
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    if (scope.role !== "client") {
      return NextResponse.json({ error: "El equipo de Smart Scale ve el CRM en solo lectura." }, { status: 403 })
    }

    const supabase = createServiceClient()
    const { error, count } = await supabase
      .from("client_prospects")
      .delete({ count: "exact" })
      .eq("id", body.id)
      .eq("client_id", scope.clientId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!count) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
