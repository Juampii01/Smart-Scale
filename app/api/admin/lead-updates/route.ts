/**
 * "Situación del lead" — bitácora append-only por lead. Cada entrada es una
 * nota con fecha; no se editan ni se borran, solo se van agregando (timeline
 * en components/views/admin-leads-view.tsx, DetailDrawer).
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { resolveInternalScope } from "@/lib/auth/internal-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function requestedTenantId(req: NextRequest, body?: any): string | null {
  return req.nextUrl.searchParams.get("client_id") ?? body?.client_id ?? null
}

const SELECT_FIELDS = "id, lead_id, note, created_at"

/** GET ?lead_id=... — historial de un lead, del más nuevo al más viejo. */
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveInternalScope(req, requestedTenantId(req))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const leadId = req.nextUrl.searchParams.get("lead_id")
    if (!leadId) return NextResponse.json({ error: "lead_id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("lead_updates")
      .select(SELECT_FIELDS)
      .eq("lead_id", leadId)
      .eq("client_id", scope.tenantId)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ updates: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** POST { lead_id, note } — agrega una entrada nueva al historial y
 *  sincroniza leads.notes con el texto más reciente (lo sigue leyendo el
 *  análisis con IA de lib/omni/*). */
export async function POST(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const leadId = typeof body.lead_id === "string" ? body.lead_id : null
    const note = typeof body.note === "string" ? body.note.trim() : ""
    if (!leadId) return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
    if (!note)   return NextResponse.json({ error: "note is required" }, { status: 400 })

    const supabase = createServiceClient()

    // El lead tiene que ser del mismo tenant — evita colgar una nota en el
    // lead de otro tenant adivinando el id.
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .eq("client_id", scope.tenantId)
      .maybeSingle()
    if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 })

    const { data, error } = await supabase
      .from("lead_updates")
      .insert({ lead_id: leadId, client_id: scope.tenantId, note, created_by: scope.userId })
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from("leads").update({ notes: note, updated_at: new Date().toISOString() }).eq("id", leadId)

    return NextResponse.json({ update: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
