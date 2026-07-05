/**
 * Cron diario del piloto Omni — corre dos análisis cada mañana:
 *  1. Comunidad (Slack): sentiment, quejas, fricción — ya existía.
 *  2. Leads vs. cierres: cruza calidad de leads con cómo terminaron cerrando
 *     (pago único vs. cuotas, monto) — nuevo.
 * Ambos quedan guardados en omni_daily_briefings (type='community'|'leads',
 * un briefing de cada tipo por día) para que se vean en la UI, no solo como
 * push efímero, y avisa a Juampi por push.
 *
 * Auth: Vercel Cron envía `Authorization: Bearer ${CRON_SECRET}` automáticamente
 * (mismo patrón que /api/cron/billing-alerts). También se puede invocar a mano
 * con el mismo header para testear.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { sendPushToNames } from "@/lib/push"
import { runCommunityAnalysis, CommunityAnalysisError } from "@/lib/omni/community-analysis"
import { runLeadOutcomeAnalysis, LeadOutcomeAnalysisError } from "@/lib/omni/lead-outcome-analysis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 90

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = req.headers.get("authorization") ?? ""
  return auth === `Bearer ${expected}`
}

async function runCommunityBriefing(sb: ReturnType<typeof createServiceClient>, today: string) {
  let result
  try {
    result = await runCommunityAnalysis(sb)
  } catch (e) {
    // Sin mensajes sincronizados todavía (piloto recién arrancando) no es un
    // error real del cron — simplemente no hay nada que reportar hoy.
    if (e instanceof CommunityAnalysisError && e.status === 400) {
      return { ok: true, skipped: true, reason: e.message }
    }
    const message = e instanceof Error ? e.message : "unknown"
    console.error("[cron/omni-daily-briefing] análisis de comunidad error:", message)
    return { ok: false, error: message }
  }

  const { error: upsertError } = await sb.from("omni_daily_briefings").upsert({
    date:              today,
    type:              "community",
    findings:          result.findings,
    messages_analyzed: result.messagesAnalyzed,
  }, { onConflict: "date,type" })

  if (upsertError) {
    console.error("[cron/omni-daily-briefing] upsert error (community):", upsertError.message)
    return { ok: false, error: upsertError.message }
  }

  const highCount = result.findings.filter(f => f.severidad === "alta").length
  const title = "☀️ Briefing diario de Omni — Comunidad"
  const body = result.findings.length === 0
    ? "No se encontraron patrones nuevos en la comunidad hoy."
    : `${result.findings.length} hallazgos (${highCount} de severidad alta) en ${result.messagesAnalyzed} mensajes.`

  await sendPushToNames(sb, ["Juampi"], { title, body, url: "/admin/omni" }).catch(() => {})

  return { ok: true, findings: result.findings.length, messagesAnalyzed: result.messagesAnalyzed }
}

async function runLeadsBriefing(sb: ReturnType<typeof createServiceClient>, today: string) {
  let result
  try {
    result = await runLeadOutcomeAnalysis(sb)
  } catch (e) {
    // Sin leads cargados en la ventana de análisis no es un error real.
    if (e instanceof LeadOutcomeAnalysisError && e.status === 400) {
      return { ok: true, skipped: true, reason: e.message }
    }
    const message = e instanceof Error ? e.message : "unknown"
    console.error("[cron/omni-daily-briefing] análisis de leads error:", message)
    return { ok: false, error: message }
  }

  const { error: upsertError } = await sb.from("omni_daily_briefings").upsert({
    date:              today,
    type:              "leads",
    findings:          result.findings,
    messages_analyzed: result.leadsAnalyzed,
  }, { onConflict: "date,type" })

  if (upsertError) {
    console.error("[cron/omni-daily-briefing] upsert error (leads):", upsertError.message)
    return { ok: false, error: upsertError.message }
  }

  const highCount = result.findings.filter(f => f.severidad === "alta").length
  const title = "📈 Briefing diario de Omni — Leads y cierres"
  const body = result.findings.length === 0
    ? "Sin patrones nuevos entre leads y cierres hoy."
    : `${result.findings.length} hallazgos (${highCount} de severidad alta) en ${result.leadsAnalyzed} leads.`

  await sendPushToNames(sb, ["Juampi"], { title, body, url: "/admin/omni" }).catch(() => {})

  return { ok: true, findings: result.findings.length, leadsAnalyzed: result.leadsAnalyzed }
}

async function runOmniDailyBriefing() {
  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // Independientes — que uno falle o no tenga datos no bloquea al otro.
  const [community, leads] = await Promise.all([
    runCommunityBriefing(sb, today),
    runLeadsBriefing(sb, today),
  ])

  return { ok: community.ok && leads.ok, community, leads }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const result = await runOmniDailyBriefing()
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const result = await runOmniDailyBriefing()
  return NextResponse.json(result)
}
