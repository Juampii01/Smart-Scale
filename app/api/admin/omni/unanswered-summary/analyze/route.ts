/**
 * POST /api/admin/omni/unanswered-summary/analyze
 *
 * Corre el resumen de conversaciones sin responder a demanda (botón "Hacer
 * resumen"). Misma lógica que el cron nocturno, guarda en el mismo lugar
 * (omni_daily_briefings, type='unanswered') para que quede consistente sin
 * importar quién lo disparó.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"
import { getUnansweredSummary } from "@/lib/omni/unanswered-summary"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()

  let summary
  try {
    summary = await getUnansweredSummary(sb)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al calcular el resumen" }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const totalUnanswered = summary.instagram.length + summary.slack.length

  const { error: upsertError } = await sb.from("omni_daily_briefings").upsert({
    date:              today,
    type:              "unanswered",
    findings:          summary,
    messages_analyzed: totalUnanswered,
  }, { onConflict: "date,type" })

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })

  return NextResponse.json({ date: today, findings: summary, messages_analyzed: totalUnanswered })
}
