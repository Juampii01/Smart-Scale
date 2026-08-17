/**
 * Historial de notas de un lead — "Algo acerca del lead" pasó de ser un
 * textarea que sobreescribía todo a un log de entradas que se van
 * acumulando (quién la escribió, cuándo). `leads.notes` sigue existiendo
 * como espejo liviano de la nota más reciente (lo usan el CSV export y la
 * creación de leads) — el historial completo vive en `lead_notes`.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { resolveInternalScope } from "@/lib/auth/internal-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function requestedTenantId(req: NextRequest, body?: any): string | null {
  return req.nextUrl.searchParams.get("client_id") ?? body?.client_id ?? null
}

/** GET ?lead_id=X — notas de un lead, más nuevas primero. */
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveInternalScope(req, requestedTenantId(req))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const leadId = req.nextUrl.searchParams.get("lead_id")
    if (!leadId) return NextResponse.json({ error: "lead_id is required" }, { status: 400 })

    const supabase = createServiceClient()
    // El join contra leads.client_id evita que alguien lea notas de un lead
    // de otro tenant pasando cualquier lead_id a mano.
    const { data, error } = await supabase
      .from("lead_notes")
      .select("id, author, body, created_at, leads!inner(client_id)")
      .eq("lead_id", leadId)
      .eq("leads.client_id", scope.tenantId)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const notes = (data ?? []).map((n: any) => ({ id: n.id, author: n.author, body: n.body, created_at: n.created_at }))
    return NextResponse.json({ notes })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** POST { lead_id, body } — agrega una nota nueva al historial. */
export async function POST(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const leadId = String(body.lead_id ?? "")
    const noteBody = String(body.body ?? "").trim()
    if (!leadId) return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
    if (!noteBody) return NextResponse.json({ error: "body is required" }, { status: 400 })

    const supabase = createServiceClient()

    // Confirma que el lead es del tenant del caller antes de escribir nada.
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .eq("client_id", scope.tenantId)
      .maybeSingle()
    if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 })
    if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 })

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", scope.userId).maybeSingle()
    const author = (profile as any)?.name ?? null

    const { data: note, error: noteErr } = await supabase
      .from("lead_notes")
      .insert({ lead_id: leadId, author, body: noteBody })
      .select("id, author, body, created_at")
      .single()
    if (noteErr) return NextResponse.json({ error: noteErr.message }, { status: 500 })

    // Espejo liviano — no bloquea la respuesta si falla.
    await supabase.from("leads").update({ notes: noteBody, updated_at: new Date().toISOString() }).eq("id", leadId)

    return NextResponse.json({ note })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
