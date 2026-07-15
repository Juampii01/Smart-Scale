// Análisis de UNA conversación de Instagram, a demanda — a diferencia de
// prospecting-risk-analysis.ts (que procesa un lote y solo devuelve las que
// están en riesgo), acá el usuario ya eligió qué conversación puntual mirar,
// así que SIEMPRE hay que devolver un veredicto, incluyendo "sano" si va
// bien. Mismo criterio: la IA decide aplicando los principios de Ann, no
// una regla fija.

import { createServiceClient } from "@/lib/supabase-service"
import { buildOmniSystemPrompt } from "@/lib/omni/system-prompt"
import { buildProspectingContextBlock } from "@/lib/omni/prospecting-context"
import Anthropic from "@anthropic-ai/sdk"

const MAX_MESSAGES = 60

export interface ConversationAnalysis {
  estado:    "sano" | "en_riesgo" | "irremontable"
  situacion: string
  principio: string
  evidencia: string
  accion:    string
  severidad: "alta" | "media" | "baja"
}

export class ConversationAnalysisError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function analyzeOneConversation(
  sb: ReturnType<typeof createServiceClient>,
  conversationId: string,
): Promise<ConversationAnalysis> {
  if (!conversationId) throw new ConversationAnalysisError("conversation_id es obligatorio", 400)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new ConversationAnalysisError("Falta ANTHROPIC_API_KEY en el servidor", 503)

  let systemPrompt: string
  try {
    systemPrompt = await buildOmniSystemPrompt(sb, "ann")
  } catch (e) {
    throw new ConversationAnalysisError(e instanceof Error ? e.message : "Error armando el contexto de Ann AI", 500)
  }

  const prospectingBlock = await buildProspectingContextBlock(sb)
  const fullSystemPrompt = prospectingBlock ? `${systemPrompt}\n\n---\n\n${prospectingBlock}` : systemPrompt

  const { data: conversation, error: convError } = await sb
    .from("omni_conversations")
    .select("id, participant_username, last_message_from")
    .eq("id", conversationId)
    .maybeSingle()

  if (convError) throw new ConversationAnalysisError(convError.message, 500)
  if (!conversation) throw new ConversationAnalysisError("No existe esa conversación", 404)

  const username = (conversation as any).participant_username as string | null

  const { data: lead } = username
    ? await sb.from("leads").select("rating, niche, notes, purchased").eq("instagram", username).maybeSingle()
    : { data: null }

  const { data: messages, error: msgError } = await sb
    .from("omni_messages")
    .select("sender, body, sent_at")
    .eq("conversation_id", conversationId)
    .not("body", "is", null)
    .order("sent_at", { ascending: false })
    .limit(MAX_MESSAGES)

  if (msgError) throw new ConversationAnalysisError(msgError.message, 500)
  if (!messages || messages.length === 0) {
    throw new ConversationAnalysisError("Esta conversación no tiene mensajes sincronizados", 400)
  }

  const lines = [...messages].reverse().map((m: any) => {
    const date = m.sent_at ? new Date(m.sent_at).toISOString().slice(0, 10) : "fecha desconocida"
    return `[${date}] ${m.sender === "ann" ? "Ann" : username ?? "el prospecto"}: ${String(m.body ?? "").slice(0, 300)}`
  })
  const leadInfo = lead
    ? `(lead: rating ${(lead as any).rating ?? "sin rating"}, nicho ${(lead as any).niche ?? "sin nicho"}${(lead as any).purchased ? ", YA ES CLIENTE" : ""}${(lead as any).notes ? `, notas: ${(lead as any).notes}` : ""})`
    : "(sin lead asociado en el CRM)"

  const today = new Date().toISOString().slice(0, 10)

  const prompt = `Hoy es ${today}. Te paso UNA conversación puntual de Instagram DM que el usuario eligió revisar ${leadInfo}, con la fecha real de cada mensaje entre corchetes:

@${username ?? "desconocido"}
${lines.join("\n")}

Si mencionás hace cuánto no responde el prospecto o cuánto silencio hubo, calculalo con la fecha del último mensaje de arriba contra la fecha de hoy (${today}) — nunca estimes ni inventes un intervalo.

Evaluá esta conversación puntual contra los principios de Ann que tenés arriba (capa 1) y decidí su estado:
- "sano": va bien, no hay nada que corregir hoy.
- "en_riesgo": incumple algún principio pero todavía es recuperable con una acción concreta.
- "irremontable": ya no hay acción razonable que la recupere (rechazo explícito, bloqueo, o silencio tan largo que insistir empeoraría la relación).

Devolvé SOLO un objeto JSON (no un array) con:
- "estado": "sano" | "en_riesgo" | "irremontable"
- "situacion": qué está pasando, 1-2 frases, sin opinión todavía
- "principio": el principio de Ann en juego (si es "sano", indicá cuál se está cumpliendo bien; nunca vacío)
- "evidencia": una cita textual corta del mensaje real
- "accion": qué hacer distinto y concreto (si es "sano", qué mantener haciendo; si es "irremontable", qué aprender para el próximo caso similar)
- "severidad": "alta" | "media" | "baja" (si es "sano", usá "baja")

Sin markdown, sin texto adicional, solo el JSON.`

  const anthropic = new Anthropic({ apiKey })

  let msg
  try {
    msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: fullSystemPrompt,
      messages: [{ role: "user", content: prompt }],
    })
  } catch (e) {
    throw new ConversationAnalysisError(`Error llamando a Claude: ${e instanceof Error ? e.message : "unknown"}`, 502)
  }

  const raw = msg.content.find(b => b.type === "text")
  const text = raw?.type === "text" ? raw.text.trim() : "{}"
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim()

  let result: ConversationAnalysis
  try {
    result = JSON.parse(cleaned)
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("La respuesta no fue un objeto")
  } catch (e) {
    console.error("[omni/conversation-analysis] parse error:", e instanceof Error ? e.message : e, cleaned.slice(0, 300))
    throw new ConversationAnalysisError("Claude devolvió una respuesta que no se pudo interpretar", 502)
  }

  const { error: upsertError } = await sb.from("omni_conversation_analyses").upsert({
    conversation_id: conversationId,
    estado:          result.estado,
    situacion:       result.situacion,
    principio:       result.principio,
    evidencia:       result.evidencia,
    accion:          result.accion,
    severidad:       result.severidad,
    analyzed_at:     new Date().toISOString(),
  }, { onConflict: "conversation_id" })

  if (upsertError) throw new ConversationAnalysisError(upsertError.message, 500)

  return result
}
