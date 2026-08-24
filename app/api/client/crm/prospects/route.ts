import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { resolveSocialScope } from "@/lib/social/scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * /api/client/crm/prospects — Pipeline del CRM interno del cliente.
 *
 * GET: el cliente ve el suyo; staff interno puede pasar ?client_id para
 * ver el de cualquiera (view-as, SOLO LECTURA — ver más abajo).
 *
 * POST/PATCH: acá es donde este endpoint se aparta de resolveSocialScope —
 * el CRM es la única superficie de la app donde staff interno NO tiene
 * bypass de escritura, ni siquiera view-as. `scope.role !== "client"` corta
 * server-side, antes de tocar la tabla — la RLS de client_crm_prospects
 * (is_crm_owner_client, sin is_internal_staff) es el segundo cinturón,
 * pero acá también se valida explícito, mismo criterio que el resto de la
 * app (RLS nunca es el único gate).
 */

const SELECT_FIELDS =
  "id, client_id, name, handle, estimated_value, stage, call_tag, source, notes, archived_at, last_movement_at, created_at, updated_at"

const STAGES = ["conversacion", "calificado", "offerdoc_enviado", "offerdoc_respondido", "cerrado"]

export async function GET(req: NextRequest) {
  try {
    const scope = await resolveSocialScope(req, req.nextUrl.searchParams.get("client_id"))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const archived = req.nextUrl.searchParams.get("archived") === "true"

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("client_crm_prospects")
      .select(SELECT_FIELDS)
      .eq("client_id", scope.clientId)
      .is("archived_at", archived ? undefined : null)
      .order("last_movement_at", { ascending: false })
      .limit(500)

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

    const { name, handle, estimated_value, source, notes, stage } = body
    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 })
    const initialStage = STAGES.includes(stage) ? stage : "conversacion"

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("client_crm_prospects")
      .insert({
        client_id: scope.clientId,
        name: name.trim(),
        handle: handle || null,
        estimated_value: estimated_value ?? null,
        source: source || null,
        notes: notes || null,
        stage: initialStage,
      })
      .select(SELECT_FIELDS)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from("client_crm_movements").insert({
      prospect_id: data.id, client_id: scope.clientId, from_stage: null, to_stage: initialStage, created_by: scope.userId,
    })

    return NextResponse.json({ prospect: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const scope = await resolveSocialScope(req, body.client_id)
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    if (scope.role !== "client") {
      return NextResponse.json({ error: "El equipo de Smart Scale ve el CRM en solo lectura." }, { status: 403 })
    }

    const { id, stage, archive } = body
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const supabase = createServiceClient()
    const { data: current, error: curErr } = await supabase
      .from("client_crm_prospects")
      .select("id, client_id, stage")
      .eq("id", id)
      .eq("client_id", scope.clientId)
      .maybeSingle()
    if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 })
    if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const field of ["name", "handle", "estimated_value", "source", "notes", "call_tag"] as const) {
      if (field in body) updates[field] = body[field]
    }
    if (archive === true) updates.archived_at = new Date().toISOString()
    if (archive === false) updates.archived_at = null

    const stageChanged = typeof stage === "string" && STAGES.includes(stage) && stage !== current.stage
    if (stageChanged) {
      updates.stage = stage
      updates.last_movement_at = new Date().toISOString()
    }

    const { data: updated, error: updErr } = await supabase
      .from("client_crm_prospects")
      .update(updates)
      .eq("id", id)
      .eq("client_id", scope.clientId)
      .select(SELECT_FIELDS)
      .single()
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    if (stageChanged) {
      await supabase.from("client_crm_movements").insert({
        prospect_id: id, client_id: scope.clientId, from_stage: current.stage, to_stage: stage, created_by: scope.userId,
      })
    }

    return NextResponse.json({ prospect: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
