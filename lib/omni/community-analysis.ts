// Lógica compartida del análisis de comunidad (Slack) — la usan tanto el
// endpoint a demanda (/api/admin/omni/slack/analyze) como el cron diario
// (/api/cron/omni-daily-briefing). Un solo lugar para el prompt y el parseo.

import { createServiceClient } from "@/lib/supabase-service"
import { buildOmniSystemPrompt } from "@/lib/omni/system-prompt"
import Anthropic from "@anthropic-ai/sdk"

const MAX_MESSAGES   = 1500
const MAX_BODY_CHARS = 300

export interface SlackFinding {
  titulo:      string
  descripcion: string
  canales:     string[]
  evidencia:   string
  severidad:   "alta" | "media" | "baja"
}

export interface CommunityAnalysisResult {
  findings:         SlackFinding[]
  messagesAnalyzed: number
}

export class CommunityAnalysisError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function runCommunityAnalysis(
  sb: ReturnType<typeof createServiceClient>,
): Promise<CommunityAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new CommunityAnalysisError("Falta ANTHROPIC_API_KEY en el servidor", 503)

  let systemPrompt: string
  try {
    systemPrompt = await buildOmniSystemPrompt(sb, "ann")
  } catch (e) {
    throw new CommunityAnalysisError(e instanceof Error ? e.message : "Error armando el contexto de Omni", 500)
  }

  const { data: rows, error } = await sb
    .from("omni_slack_messages")
    .select("body, user_name, posted_at, omni_slack_channels(name)")
    .not("body", "is", null)
    .order("posted_at", { ascending: false })
    .limit(MAX_MESSAGES)

  if (error) throw new CommunityAnalysisError(error.message, 500)
  if (!rows || rows.length === 0) {
    throw new CommunityAnalysisError("No hay mensajes sincronizados todavía. Corré 'Sincronizar' primero.", 400)
  }

  // Agrupar por canal, orden cronológico (más viejo primero) dentro de cada uno.
  const byChannel = new Map<string, string[]>()
  for (const r of [...rows].reverse()) {
    const channelName = (r as any).omni_slack_channels?.name ?? "desconocido"
    const userName = (r as any).user_name ?? "alguien"
    const text = String((r as any).body ?? "").slice(0, MAX_BODY_CHARS)
    const list = byChannel.get(channelName) ?? []
    list.push(`${userName}: ${text}`)
    byChannel.set(channelName, list)
  }

  const transcript = Array.from(byChannel.entries())
    .map(([channel, lines]) => `#${channel}\n${lines.join("\n")}`)
    .join("\n\n---\n\n")

  const prompt = `Te paso el historial reciente de mensajes de los canales de Slack de la comunidad (compartidos + de clientes puntuales).

${transcript}

Analizá estos mensajes y encontrá patrones reales — no inventes nada que no esté sustentado en el texto. Buscá específicamente:
- Quejas o problemas que se repiten en más de un mensaje o canal.
- Preguntas que quedaron sin responder.
- Señales de frustración, confusión o riesgo de abandono.
- Fricciones operativas (procesos que no quedan claros, cosas que tardan, etc.)

Para cada hallazgo real que encuentres (está bien devolver pocos o ninguno si el material no da para más — no rellenes con cosas débiles), devolvé:
- "titulo": título corto (4-8 palabras)
- "descripcion": 2-3 oraciones explicando el patrón, en español, tono directo y ejecutivo
- "canales": array con los nombres de canal donde aparece (sin el #)
- "evidencia": una cita textual corta (una línea) de los mensajes que sustenta el hallazgo
- "severidad": "alta" | "media" | "baja"

Respondé SOLO con un JSON array de hallazgos. Si no hay nada relevante, devolvé un array vacío []. Sin markdown, sin texto adicional.`

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
    throw new CommunityAnalysisError(
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
    console.error("[omni/community-analysis] parse error:", e instanceof Error ? e.message : e, cleaned.slice(0, 300))
    throw new CommunityAnalysisError("Claude devolvió una respuesta que no se pudo interpretar", 502)
  }

  return { findings, messagesAnalyzed: rows.length }
}
