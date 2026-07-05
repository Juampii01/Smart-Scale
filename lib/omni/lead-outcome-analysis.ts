// Análisis de calidad de leads vs. cómo terminaron cerrando — cruza señales
// de entrada del lead (rating, fuente, nicho, notas) con los términos del
// cierre (pago único vs. cuotas, monto, duración) para detectar patrones.
// Mismo patrón que community-analysis.ts (un prompt, sin tool-calling), la
// usan tanto el cron diario como (eventualmente) un endpoint a demanda.
//
// Nota: reusa el shape de SlackFinding para no duplicar el componente de UI
// (FindingsSection) — acá "canales" lleva nombres de clientes/leads
// involucrados, no canales de Slack.

import { createServiceClient } from "@/lib/supabase-service"
import Anthropic from "@anthropic-ai/sdk"
import type { SlackFinding } from "@/lib/omni/community-analysis"

const LOOKBACK_DAYS = 60

export interface LeadOutcomeAnalysisResult {
  findings:      SlackFinding[]
  leadsAnalyzed: number
}

export class LeadOutcomeAnalysisError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function runLeadOutcomeAnalysis(
  sb: ReturnType<typeof createServiceClient>,
): Promise<LeadOutcomeAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new LeadOutcomeAnalysisError("Falta ANTHROPIC_API_KEY en el servidor", 503)

  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString()

  const { data: leads, error: leadsErr } = await sb
    .from("leads")
    .select("id, name, rating, source, lead_type, niche, tag, notes, purchased, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })

  if (leadsErr) throw new LeadOutcomeAnalysisError(leadsErr.message, 500)

  const { data: clients, error: clientsErr } = await sb
    .from("crm_clients")
    .select("id, name, lead_id, is_monthly_subscription, num_installments, program_duration, total_amount, forma_pago, created_at")
    .gte("created_at", sinceIso)
    .not("lead_id", "is", null)
    .order("created_at", { ascending: false })

  if (clientsErr) throw new LeadOutcomeAnalysisError(clientsErr.message, 500)

  if (!leads || leads.length === 0) {
    throw new LeadOutcomeAnalysisError("No hay leads cargados en los últimos 60 días.", 400)
  }

  const linkedClients = clients ?? []
  const clientIds = linkedClients.map(c => c.id)

  const { data: installments } = clientIds.length > 0
    ? await sb.from("crm_installments").select("client_id, amount, paid_at, due_date").in("client_id", clientIds)
    : { data: [] }

  const installmentsByClient = new Map<string, any[]>()
  for (const i of installments ?? []) {
    const list = installmentsByClient.get((i as any).client_id) ?? []
    list.push(i)
    installmentsByClient.set((i as any).client_id, list)
  }

  const leadsById = new Map((leads ?? []).map(l => [l.id, l]))

  const closedSummaries = linkedClients.map(c => {
    const lead = c.lead_id ? leadsById.get(c.lead_id) : null
    const insts = installmentsByClient.get(c.id) ?? []
    const paidCount = insts.filter((i: any) => i.paid_at).length
    return {
      cliente: c.name,
      lead_rating: lead?.rating ?? null,
      lead_source: lead?.source ?? null,
      lead_niche: lead?.niche ?? null,
      lead_tag: lead?.tag ?? null,
      lead_notes: lead?.notes ?? null,
      pago: c.is_monthly_subscription ? "suscripción mensual" : c.num_installments <= 1 ? "pago único" : `${c.num_installments} cuotas`,
      monto_total: c.total_amount,
      duracion_meses: c.program_duration,
      forma_pago: c.forma_pago,
      cuotas_pagadas: `${paidCount}/${insts.length}`,
    }
  })

  const leadsSummary = (leads ?? []).map(l => ({
    nombre: l.name,
    rating: l.rating,
    fuente: l.source,
    tipo: l.lead_type,
    nicho: l.niche,
    tag: l.tag,
    notas: l.notes,
    compro: l.purchased,
  }))

  const prompt = `Sos un analista que ayuda a Ann, dueña de un programa de coaching online, a entender qué tan calificados están llegando sus leads y si hay patrones entre cómo entra alguien y cómo termina cerrando (o no cerrando).

LEADS de los últimos ${LOOKBACK_DAYS} días (${leadsSummary.length}):
${JSON.stringify(leadsSummary, null, 1)}

CLIENTES CERRADOS de los últimos ${LOOKBACK_DAYS} días con lead de origen conocido (${closedSummaries.length}):
${JSON.stringify(closedSummaries, null, 1)}

Analizá esta información y buscá patrones reales — no inventes nada que no esté sustentado en los datos. Ejemplos del tipo de patrón que buscamos (no busques exactamente esto, es solo ilustrativo):
- Leads con rating bajo o de cierta fuente que igual cerraron, y en qué términos (pago único vs. cuotas puede ser señal de menor compromiso, pero no es una regla fija — evaluá caso por caso).
- Fuentes o nichos con mayor tasa de cierre en términos favorables (cuotas, montos mayores) vs. cierres "débiles".
- Cualquier señal de que la calificación del lead (rating, notas) no se está correspondiendo con la calidad real del cierre.

Presentalo SIEMPRE como hipótesis a revisar por Ann, nunca como hecho confirmado — con pocos casos, correlación no es causalidad. Si los datos no alcanzan para un patrón real, está bien devolver pocos hallazgos o ninguno.

Para cada hallazgo real que encuentres, devolvé:
- "titulo": título corto (4-8 palabras)
- "descripcion": 2-3 oraciones explicando el patrón, en español, tono directo y ejecutivo, dejando claro que es una hipótesis a revisar
- "canales": array con los nombres de los clientes/leads involucrados en el hallazgo
- "evidencia": un dato concreto corto que sustenta el hallazgo (ej: "3 de 4 pagos únicos vinieron de la misma fuente")
- "severidad": "alta" | "media" | "baja"

Respondé SOLO con un JSON array de hallazgos. Si no hay nada relevante, devolvé un array vacío []. Sin markdown, sin texto adicional.`

  const anthropic = new Anthropic({ apiKey })

  let msg
  try {
    msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    })
  } catch (e) {
    throw new LeadOutcomeAnalysisError(
      `Error llamando a Claude: ${e instanceof Error ? e.message : "unknown"}`, 502,
    )
  }

  const raw = msg.content.find(b => b.type === "text")
  const text = raw?.type === "text" ? raw.text.trim() : "[]"
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim()

  let findings: SlackFinding[]
  try {
    findings = JSON.parse(cleaned)
    if (!Array.isArray(findings)) throw new Error("La respuesta no fue un array")
  } catch (e) {
    console.error("[omni/lead-outcome-analysis] parse error:", e instanceof Error ? e.message : e, cleaned.slice(0, 300))
    throw new LeadOutcomeAnalysisError("Claude devolvió una respuesta que no se pudo interpretar", 502)
  }

  return { findings, leadsAnalyzed: leadsSummary.length }
}
