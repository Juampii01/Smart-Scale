/**
 * POST /api/admin/omni/slack/analyze
 *
 * Lee los mensajes ya sincronizados (omni_slack_messages) y le pide a Claude
 * que encuentre patrones reales: quejas repetidas, preguntas sin responder,
 * señales de fricción/abandono. Se corre a demanda (botón "Analizar") — no
 * persiste el resultado todavía, es la primera pasada del piloto.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 90

const MAX_MESSAGES  = 1500
const MAX_BODY_CHARS = 300

interface SlackFinding {
  titulo:      string
  descripcion: string
  canales:     string[]
  evidencia:   string
  severidad:   "alta" | "media" | "baja"
}

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY en el servidor" }, { status: 503 })

  const sb = createServiceClient()

  const { data: rows, error } = await sb
    .from("omni_slack_messages")
    .select("body, user_name, posted_at, omni_slack_channels(name)")
    .not("body", "is", null)
    .order("posted_at", { ascending: false })
    .limit(MAX_MESSAGES)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "No hay mensajes sincronizados todavía. Corré 'Sincronizar' primero." }, { status: 400 })
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

  const prompt = `Sos un analista que ayuda a Ann, dueña de una comunidad de coaching online, a entender qué está pasando en su comunidad de Slack. Te paso el historial reciente de mensajes de sus canales (compartidos + de clientes puntuales).

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
      messages: [{ role: "user", content: prompt }],
    })
  } catch (e) {
    console.error("[omni/slack/analyze] Anthropic error:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Error llamando a Claude" }, { status: 502 })
  }

  const raw = msg.content.find(b => b.type === "text")
  const text = raw?.type === "text" ? raw.text.trim() : "[]"
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim()

  let findings: SlackFinding[]
  try {
    findings = JSON.parse(cleaned)
    if (!Array.isArray(findings)) throw new Error("La respuesta no fue un array")
  } catch (e) {
    console.error("[omni/slack/analyze] parse error:", e instanceof Error ? e.message : e, cleaned.slice(0, 300))
    return NextResponse.json({ error: "Claude devolvió una respuesta que no se pudo interpretar" }, { status: 502 })
  }

  return NextResponse.json({ findings, messagesAnalyzed: rows.length })
}
