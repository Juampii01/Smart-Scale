/**
 * GET/PUT /api/admin/omni/prospecting/context
 *
 * Contexto de prospección propio de Steffano (workflow inbound/outbound +
 * notas generales) — tabla singleton (context_id fijo "prospeccion"),
 * editable por cualquiera con acceso a Ann AI. Se usa en
 * lib/omni/prospecting-context.ts para ajustar el feedback del análisis
 * individual de conversaciones (lib/omni/conversation-analysis.ts).
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CONTEXT_ID = "prospeccion"

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const { data, error } = await sb
    .from("omni_prospecting_context")
    .select("workflow_inbound, workflow_outbound, notas_generales, updated_at")
    .eq("context_id", CONTEXT_ID)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    context: data ?? { workflow_inbound: "", workflow_outbound: "", notas_generales: "", updated_at: null },
  })
}

export async function PUT(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const sb = createServiceClient()
  const { error } = await sb
    .from("omni_prospecting_context")
    .upsert({
      context_id:        CONTEXT_ID,
      workflow_inbound:  String(body.workflow_inbound ?? "").trim(),
      workflow_outbound: String(body.workflow_outbound ?? "").trim(),
      notas_generales:   String(body.notas_generales ?? "").trim(),
      updated_by:        user.id,
      updated_at:        new Date().toISOString(),
    }, { onConflict: "context_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
