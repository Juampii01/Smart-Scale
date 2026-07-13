// Análisis de UN canal de Slack, a demanda — mismo patrón que
// lib/omni/conversation-analysis.ts (Instagram): el usuario ya eligió qué
// canal puntual mirar, así que SIEMPRE hay que devolver un veredicto,
// incluyendo "sano" si va bien. No usa "irremontable": un canal de
// comunidad no se "pierde" como un prospecto, se puede intervenir siempre.

import { createServiceClient } from "@/lib/supabase-service"
import { buildOmniSystemPrompt } from "@/lib/omni/system-prompt"
import Anthropic from "@anthropic-ai/sdk"

const MAX_MESSAGES   = 200
const MAX_BODY_CHARS = 300

export interface ChannelAnalysis {
  estado:    "sano" | "en_riesgo"
  situacion: string
  principio: string
  evidencia: string
  accion:    string
  severidad: "alta" | "media" | "baja"
}

export class ChannelAnalysisError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function analyzeOneChannel(
  sb: ReturnType<typeof createServiceClient>,
  channelId: string,
): Promise<ChannelAnalysis> {
  if (!channelId) throw new ChannelAnalysisError("channel_id es obligatorio", 400)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new ChannelAnalysisError("Falta ANTHROPIC_API_KEY en el servidor", 503)

  let systemPrompt: string
  try {
    systemPrompt = await buildOmniSystemPrompt(sb, "ann")
  } catch (e) {
    throw new ChannelAnalysisError(e instanceof Error ? e.message : "Error armando el contexto de Ann AI", 500)
  }

  const { data: channel, error: channelError } = await sb
    .from("omni_slack_channels")
    .select("id, name, is_client_channel")
    .eq("id", channelId)
    .maybeSingle()

  if (channelError) throw new ChannelAnalysisError(channelError.message, 500)
  if (!channel) throw new ChannelAnalysisError("No existe ese canal", 404)

  const { data: messages, error: msgError } = await sb
    .from("omni_slack_messages")
    .select("user_name, body, posted_at")
    .eq("channel_id", channelId)
    .not("body", "is", null)
    .order("posted_at", { ascending: false })
    .limit(MAX_MESSAGES)

  if (msgError) throw new ChannelAnalysisError(msgError.message, 500)
  if (!messages || messages.length === 0) {
    throw new ChannelAnalysisError("Este canal no tiene mensajes sincronizados", 400)
  }

  const lines = [...messages].reverse().map((m: any) => `${m.user_name ?? "alguien"}: ${String(m.body ?? "").slice(0, MAX_BODY_CHARS)}`)
  const channelName = (channel as any).name as string
  const channelType = (channel as any).is_client_channel ? "canal 1:1 de un cliente puntual" : "canal compartido de la comunidad"

  const prompt = `Te paso el historial reciente de UN canal puntual de Slack que el usuario eligió revisar (#${channelName}, ${channelType}):

${lines.join("\n")}

Evaluá este canal puntual contra los principios de Ann que tenés arriba (capa 1) y decidí su estado:
- "sano": va bien, no hay nada que corregir hoy.
- "en_riesgo": hay quejas repetidas, preguntas sin responder, señales de frustración/confusión, o fricción operativa que conviene atender.

Devolvé SOLO un objeto JSON (no un array) con:
- "estado": "sano" | "en_riesgo"
- "situacion": qué está pasando, 1-2 frases, sin opinión todavía
- "principio": el principio de Ann en juego (si es "sano", indicá cuál se está cumpliendo bien; nunca vacío)
- "evidencia": una cita textual corta de un mensaje real
- "accion": qué hacer distinto y concreto (si es "sano", qué mantener haciendo)
- "severidad": "alta" | "media" | "baja" (si es "sano", usá "baja")

Sin markdown, sin texto adicional, solo el JSON.`

  const anthropic = new Anthropic({ apiKey })

  let msg
  try {
    msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    })
  } catch (e) {
    throw new ChannelAnalysisError(`Error llamando a Claude: ${e instanceof Error ? e.message : "unknown"}`, 502)
  }

  const raw = msg.content.find(b => b.type === "text")
  const text = raw?.type === "text" ? raw.text.trim() : "{}"
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim()

  let result: ChannelAnalysis
  try {
    result = JSON.parse(cleaned)
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("La respuesta no fue un objeto")
  } catch (e) {
    console.error("[omni/channel-analysis] parse error:", e instanceof Error ? e.message : e, cleaned.slice(0, 300))
    throw new ChannelAnalysisError("Claude devolvió una respuesta que no se pudo interpretar", 502)
  }

  const { error: upsertError } = await sb.from("omni_channel_analyses").upsert({
    channel_id:  channelId,
    estado:      result.estado,
    situacion:   result.situacion,
    principio:   result.principio,
    evidencia:   result.evidencia,
    accion:      result.accion,
    severidad:   result.severidad,
    analyzed_at: new Date().toISOString(),
  }, { onConflict: "channel_id" })

  if (upsertError) throw new ChannelAnalysisError(upsertError.message, 500)

  return result
}
