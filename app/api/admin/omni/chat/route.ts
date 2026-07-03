/**
 * Chat conversacional de Omni — mismo patrón de agentic loop que
 * /api/admin/assistant (TOOLS + executeTool + rounds), pero aislado: tools
 * propias (lib/omni/chat-tools.ts), gateado por requireOmniOwner, memoria en
 * omni_conversations (un solo hilo persistente — Omni es de un solo usuario).
 *
 * GET  → devuelve el historial simple guardado (para hidratar la UI)
 * POST → { message: string } → corre el loop, guarda el turno, devuelve reply
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"
import { OMNI_CHAT_TOOLS, executeOmniChatTool } from "@/lib/omni/chat-tools"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

interface SimpleMessage { role: "user" | "assistant"; content: string }

async function getOrCreateConversation(sb: ReturnType<typeof createServiceClient>) {
  const { data: existing } = await sb
    .from("omni_conversations")
    .select("id, messages")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return { id: (existing as any).id, messages: ((existing as any).messages ?? []) as SimpleMessage[] }

  const { data: created, error } = await sb
    .from("omni_conversations")
    .insert({ messages: [] })
    .select("id")
    .single()
  if (error || !created) throw new Error(error?.message ?? "No se pudo crear la conversación")
  return { id: (created as any).id, messages: [] as SimpleMessage[] }
}

function buildSystemPrompt(): string {
  const todayStr = new Date().toISOString().slice(0, 10)
  return `Sos el asistente de Omni, el sistema de IA interno del piloto con Ann. Tenés acceso a los mensajes de la comunidad de Slack de Ann vía herramientas (tools).

Fecha actual: ${todayStr}.

Tu trabajo: responder preguntas de Juampi (el dueño del proyecto) sobre la comunidad — patrones, personas puntuales, objeciones, qué pasó en tal canal, etc. Cuando necesités datos reales, usá las herramientas — no inventes nada.

REGLAS:
1. Si te preguntan sobre algo que pasó en la comunidad (una persona, un tema, un evento), SIEMPRE usá search_slack_messages antes de responder — probá más de un término si hace falta (nombre, apodo, palabra clave del tema).
2. Si no sabés qué canales existen, usá list_slack_channels.
3. Respondé en español rioplatense, directo y conciso.
4. Si la búsqueda no encuentra nada, decilo — no inventes una respuesta.
5. Cuando cites un mensaje, aclarás en qué canal y quién lo dijo.`
}

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const { messages } = await getOrCreateConversation(sb)
  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const userMessage: string = (body?.message ?? "").trim()
  if (!userMessage) return NextResponse.json({ error: "message requerido" }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY en el servidor" }, { status: 503 })

  const sb = createServiceClient()

  let conversationId: string
  let simpleHistory: SimpleMessage[]
  try {
    const conv = await getOrCreateConversation(sb)
    conversationId = conv.id
    simpleHistory = conv.messages
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al cargar la conversación" }, { status: 500 })
  }

  const anthropic = new Anthropic({ apiKey })

  // Historial agéntico de esta sola llamada: contexto previo simple + la pregunta nueva.
  // El tool-calling interno (tool_use/tool_result) NUNCA se persiste — solo el
  // texto final de cada turno queda en omni_conversations.
  const history: Anthropic.MessageParam[] = [
    ...simpleHistory.slice(-20).map(m => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
    { role: "user", content: userMessage },
  ]

  let reply = ""
  let rounds = 0

  try {
    while (rounds < 4) {
      rounds++
      const response = await anthropic.messages.create({
        model:      "claude-sonnet-4-5",
        max_tokens: 1200,
        system:     buildSystemPrompt(),
        tools:      OMNI_CHAT_TOOLS,
        messages:   history,
      })

      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find(b => b.type === "text")
        reply = textBlock?.type === "text" ? textBlock.text : ""
        break
      }

      if (response.stop_reason === "tool_use") {
        history.push({ role: "assistant", content: response.content })

        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const block of response.content) {
          if (block.type !== "tool_use") continue
          const output = await executeOmniChatTool(sb, block.name, block.input as Record<string, any>)
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: output })
        }

        history.push({ role: "user", content: toolResults })
        continue
      }

      break
    }
  } catch (e) {
    console.error("[omni/chat] Anthropic error:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Error llamando a Claude" }, { status: 502 })
  }

  const updatedHistory: SimpleMessage[] = [
    ...simpleHistory,
    { role: "user", content: userMessage },
    { role: "assistant", content: reply },
  ]

  await sb.from("omni_conversations")
    .update({ messages: updatedHistory, updated_at: new Date().toISOString() })
    .eq("id", conversationId)

  return NextResponse.json({ reply })
}
