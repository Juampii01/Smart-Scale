// Análisis de riesgo por prospecto — a diferencia de community-analysis (que
// busca patrones agregados de la comunidad) o lead-outcome-analysis (que
// busca correlaciones entre calidad de lead y cómo cerró), este motor mira
// conversación por conversación de Instagram y le pide a la IA que aplique
// los principios de Ann para decidir cuáles están en riesgo — no una regla
// fija de "tantos días sin responder", el criterio lo pone el contexto
// cargado en buildOmniSystemPrompt.

import { createServiceClient } from "@/lib/supabase-service"
import { buildOmniSystemPrompt } from "@/lib/omni/system-prompt"
import Anthropic from "@anthropic-ai/sdk"

const LOOKBACK_DAYS       = 60
const MAX_MESSAGES_PER_CONVO = 40
const MAX_CONVERSATIONS    = 60

export interface ProspectRisk {
  prospecto: string
  estado:    "en_riesgo" | "irremontable"
  situacion: string
  principio: string
  evidencia: string
  accion:    string
  severidad: "alta" | "media" | "baja"
}

export interface ProspectingRiskResult {
  findings:          ProspectRisk[]
  conversationsAnalyzed: number
}

export class ProspectingRiskError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function runProspectingRiskAnalysis(
  sb: ReturnType<typeof createServiceClient>,
): Promise<ProspectingRiskResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new ProspectingRiskError("Falta ANTHROPIC_API_KEY en el servidor", 503)

  let systemPrompt: string
  try {
    systemPrompt = await buildOmniSystemPrompt(sb, "ann")
  } catch (e) {
    throw new ProspectingRiskError(e instanceof Error ? e.message : "Error armando el contexto de Omni", 500)
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString()

  const { data: conversations, error: convError } = await sb
    .from("omni_conversations")
    .select("id, participant_username, last_message_at, last_message_from")
    .gte("last_message_at", sinceIso)
    .order("last_message_at", { ascending: false })
    .limit(MAX_CONVERSATIONS)

  if (convError) throw new ProspectingRiskError(convError.message, 500)
  if (!conversations || conversations.length === 0) {
    throw new ProspectingRiskError("No hay conversaciones de Instagram sincronizadas todavía. Corré 'Sincronizar' primero.", 400)
  }

  // Cruzar con leads (por instagram) para traer rating/nicho, y con
  // crm_clients para excluir prospectos que ya son clientes cerrados —
  // el análisis de riesgo es solo sobre gente que todavía no compró.
  const usernames = conversations.map(c => (c as any).participant_username).filter(Boolean)
  const { data: leads } = usernames.length > 0
    ? await sb.from("leads").select("id, name, instagram, rating, niche, notes, purchased").in("instagram", usernames)
    : { data: [] }

  // Si hay leads duplicados con el mismo instagram (ej: doble alta desde
  // Airtable/ManyChat), preferimos quedarnos con la fila purchased=true —
  // si no, un duplicado sin comprar puede tapar la exclusión de "ya es
  // cliente" y el prospecto sigue apareciendo en riesgo aunque ya cerró.
  const leadsByUsername = new Map<string, any>()
  for (const l of (leads ?? []) as any[]) {
    const key = String(l.instagram ?? "").toLowerCase()
    if (!key) continue
    const existing = leadsByUsername.get(key)
    if (!existing || (!existing.purchased && l.purchased)) leadsByUsername.set(key, l)
  }
  const purchasedLeadIds = new Set((leads ?? []).filter((l: any) => l.purchased).map((l: any) => l.id))

  const activeConversations = conversations.filter(c => {
    const username = (c as any).participant_username
    const lead = username ? leadsByUsername.get(String(username).toLowerCase()) : null
    return !lead || !purchasedLeadIds.has(lead.id)
  })

  if (activeConversations.length === 0) {
    return { findings: [], conversationsAnalyzed: 0 }
  }

  // Fetch por-conversación (no un límite global compartido): si una sola
  // conversación tiene mucha actividad reciente, un límite global ordenado
  // por sent_at descendente puede acaparar el buffer y dejar a otra
  // conversación activa con transcript vacío.
  const conversationIds = activeConversations.map(c => (c as any).id)
  let messageResults: { id: string; messages: any[] }[]
  try {
    messageResults = await Promise.all(conversationIds.map(async (id: string) => {
      const { data, error } = await sb
        .from("omni_messages")
        .select("sender, body, sent_at")
        .eq("conversation_id", id)
        .not("body", "is", null)
        .order("sent_at", { ascending: false })
        .limit(MAX_MESSAGES_PER_CONVO)
      if (error) throw new Error(error.message)
      return { id, messages: [...(data ?? [])].reverse() }
    }))
  } catch (e) {
    throw new ProspectingRiskError(e instanceof Error ? e.message : "Error trayendo mensajes de las conversaciones", 500)
  }

  const messagesByConvo = new Map(messageResults.map(r => [r.id, r.messages]))

  const transcripts = activeConversations.map(c => {
    const username = (c as any).participant_username ?? "desconocido"
    const lead = username ? leadsByUsername.get(String(username).toLowerCase()) : null
    const msgs = messagesByConvo.get((c as any).id) ?? []
    const lines = msgs.map((m: any) => `${m.sender === "ann" ? "Ann" : username}: ${String(m.body ?? "").slice(0, 300)}`)
    const leadInfo = lead
      ? `(lead: rating ${lead.rating ?? "sin rating"}, nicho ${lead.niche ?? "sin nicho"}${lead.notes ? `, notas: ${lead.notes}` : ""})`
      : "(sin lead asociado en el CRM)"
    return `### @${username} ${leadInfo}\nÚltimo mensaje: ${(c as any).last_message_from === "lead" ? "del prospecto, sin responder" : "de Ann"}\n${lines.join("\n")}`
  }).join("\n\n---\n\n")

  const prompt = `Te paso las conversaciones de Instagram DM activas (no son clientes ya cerrados) de los últimos ${LOOKBACK_DAYS} días, una por una.

${transcripts}

Evaluá CADA conversación contra los principios de Ann que tenés arriba (capa 1) y decidí cuáles están en riesgo — es tu criterio, aplicando ESOS principios, no una regla genérica de "muchos días sin responder". Un prospecto puede estar en riesgo por incumplir cualquier principio: no calificar antes de ofrecer, no dar cierre a la conversación, prometer de más, tardar en responder, no seguir la estructura de prospección, etc.

Devolvé SOLO los que estén en riesgo — no evalúes ni devuelvas los que van bien. Además de detectar el riesgo, clasificá cada uno en "estado":
- "en_riesgo": todavía se puede salvar aplicando la acción recomendada — hay una ventana real de recuperación.
- "irremontable": ya no hay acción razonable que lo recupere hoy — el prospecto rechazó explícitamente, se molestó, bloqueó, o pasó tanto tiempo sin ninguna señal de vida que insistir empeoraría la relación. Usalo con criterio real, no por defecto — la mayoría de los riesgos son recuperables.

Para cada uno devolvé:
- "prospecto": el username (sin el @)
- "estado": "en_riesgo" | "irremontable"
- "situacion": qué está pasando, 1-2 frases, sin opinión todavía
- "principio": el principio específico de Ann que se está incumpliendo, en su propio vocabulario
- "evidencia": una cita textual corta del mensaje real que sustenta el riesgo
- "accion": qué hacer distinto, concreto y accionable para ESTE prospecto puntual (si es "irremontable", qué aprender de esto para el próximo prospecto similar, no un intento de recuperarlo)
- "severidad": "alta" | "media" | "baja"

Respondé SOLO con un JSON array. Si ninguna conversación está en riesgo, devolvé un array vacío []. Sin markdown, sin texto adicional.`

  const anthropic = new Anthropic({ apiKey })

  let msg
  try {
    msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    })
  } catch (e) {
    throw new ProspectingRiskError(
      `Error llamando a Claude: ${e instanceof Error ? e.message : "unknown"}`, 502,
    )
  }

  const raw = msg.content.find(b => b.type === "text")
  const text = raw?.type === "text" ? raw.text.trim() : "[]"
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim()

  let findings: ProspectRisk[]
  try {
    findings = JSON.parse(cleaned)
    if (!Array.isArray(findings)) throw new Error("La respuesta no fue un array")
  } catch (e) {
    console.error("[omni/prospecting-risk-analysis] parse error:", e instanceof Error ? e.message : e, cleaned.slice(0, 300))
    throw new ProspectingRiskError("Claude devolvió una respuesta que no se pudo interpretar", 502)
  }

  return { findings, conversationsAnalyzed: activeConversations.length }
}
