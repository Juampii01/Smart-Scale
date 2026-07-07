/**
 * POST /api/admin/omni/prospecting/analyze
 *
 * Corre el análisis de riesgo de prospección a demanda (botón "Actualizar"
 * en /admin/omni), en vez de esperar al cron diario. Guarda el resultado en
 * el mismo lugar que el cron (omni_daily_briefings, type='prospecting') para
 * que quede consistente sin importar quién lo disparó.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"
import { runProspectingRiskAnalysis, ProspectingRiskError } from "@/lib/omni/prospecting-risk-analysis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()

  let result
  try {
    result = await runProspectingRiskAnalysis(sb)
  } catch (e) {
    const status = e instanceof ProspectingRiskError ? e.status : 500
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al analizar" }, { status })
  }

  const today = new Date().toISOString().slice(0, 10)
  const { error: upsertError } = await sb.from("omni_daily_briefings").upsert({
    date:              today,
    type:              "prospecting",
    findings:          result.findings,
    messages_analyzed: result.conversationsAnalyzed,
  }, { onConflict: "date,type" })

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  return NextResponse.json({
    date:              today,
    findings:          result.findings,
    messages_analyzed: result.conversationsAnalyzed,
  })
}
