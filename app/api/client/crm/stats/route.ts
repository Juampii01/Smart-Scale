import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { resolveSocialScope } from "@/lib/social/scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** /api/client/crm/stats — "Tu mes, hasta ahora" de la pantalla Hoy.
 *  Cuatro campos que después se llenan solos en el reporte mensual:
 *  llamadas agendadas, OfferDocs enviados, OfferDocs respondidos, cierres
 *  — cada uno con el total del mes en curso contra el total de los
 *  últimos 12 meses (mismo criterio que usa el propio prompt para
 *  justificar las etapas: "109 OfferDocs contra 57 llamadas"). */
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveSocialScope(req, req.nextUrl.searchParams.get("client_id"))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const supabase = createServiceClient()
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const twelveMoStart = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1)).toISOString()

    const [movMonth, mov12mo, callsMonth, calls12mo] = await Promise.all([
      supabase.from("client_crm_movements").select("to_stage").eq("client_id", scope.clientId).gte("created_at", monthStart),
      supabase.from("client_crm_movements").select("to_stage").eq("client_id", scope.clientId).gte("created_at", twelveMoStart),
      supabase.from("client_crm_prospects").select("id", { count: "exact", head: true }).eq("client_id", scope.clientId).gte("call_tagged_at", monthStart),
      supabase.from("client_crm_prospects").select("id", { count: "exact", head: true }).eq("client_id", scope.clientId).gte("call_tagged_at", twelveMoStart),
    ])

    const countStage = (rows: { to_stage: string }[] | null | undefined, stage: string) =>
      (rows ?? []).filter((r) => r.to_stage === stage).length

    return NextResponse.json({
      stats: {
        llamadas_agendadas:   { month: callsMonth.count ?? 0, trailing12mo: calls12mo.count ?? 0 },
        offerdocs_enviados:   { month: countStage(movMonth.data, "offerdoc_enviado"),    trailing12mo: countStage(mov12mo.data, "offerdoc_enviado") },
        offerdocs_respondidos:{ month: countStage(movMonth.data, "offerdoc_respondido"), trailing12mo: countStage(mov12mo.data, "offerdoc_respondido") },
        cierres:              { month: countStage(movMonth.data, "cerrado"),             trailing12mo: countStage(mov12mo.data, "cerrado") },
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
