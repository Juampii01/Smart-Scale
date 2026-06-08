/**
 * Ann AI — el agente conversacional con tool use.
 *
 * Disponible para TODOS los roles, con scope estricto:
 *  - Cliente: bloqueado a SU propio negocio (su client_id). No puede ver otros.
 *  - Interno (admin/developer/team/setter): puede analizar cualquier cliente
 *    (vía el cliente activo del header) y tiene list_clients.
 *
 * Claude razona y llama tools para consultar datos reales. Nunca inventa
 * números: vienen de la base. El aislamiento por cliente se fuerza en código
 * (ver lib/assistant/tools.ts → executeTool).
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isInternal } from "@/lib/auth/permissions"
import { getToolDefinitions, executeTool } from "@/lib/assistant/tools"
import { MAX_MESSAGES_PER_CONVERSATION } from "@/app/api/assistant/conversations/route"
import { log } from "@/lib/logger"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MODEL          = process.env.ANAI_MODEL ?? "claude-haiku-4-5-20251001"
const MAX_TOOL_ROUNDS = 3   // reducido de 6 — máx 3 herramientas por pregunta
const MAX_HISTORY     = 12  // últimos 12 mensajes de contexto
const MAX_TOKENS      = 900 // salida máxima por respuesta

// Sistema compacto — menos tokens de entrada, mismo resultado
function systemPromptInternal(clientId: string | null, clientName: string | null, businessProfile: string | null = null): string {
  const ctx = clientId
    ? `Cliente activo: ${clientName ?? "(sin nombre)"} (id: ${clientId}).`
    : "Sin cliente seleccionado — usá list_clients si te piden uno."

  const bizCtx = businessProfile ? `\nNegocio del cliente: ${businessProfile}` : ""

  return `Sos Ann AI, analista interna de Smart Scale (coaching escala negocios online).
Español rioplatense. Directo, sin relleno. Respuestas cortas: máx 120 palabras o 4 bullets. Un foco de acción.

Pilares: F=Fascinate (audiencia) · E=Educate (nurturing) · T=Transform (oferta/casos) · I=Invite (prospección).
Diagnóstico = pilar flojo + dato que lo prueba + acción concreta.

Reglas: usá tools para números (nunca inventes). Si necesitás metodología, usá search_knowledge con término puntual. ${ctx}${bizCtx}`
}

function systemPromptClient(
  clientName: string | null,
  businessProfile: string | null,
  lastReport: Record<string, any> | null,
): string {
  const biz = businessProfile ? `\nNegocio: ${businessProfile}` : ""

  const rep = lastReport
    ? `\nContexto reciente (${lastReport.month ?? ""}): revenue $${lastReport.total_revenue ?? "n/d"} · MRR $${lastReport.mrr ?? "n/d"}${lastReport.next_focus ? ` · foco: "${lastReport.next_focus}"` : ""}`
    : "\nEs nuevo en el programa — aún no tiene reportes cargados."

  return `Sos Ann AI, asistente personal de ${clientName ?? "el/la dueño/a"} en Smart Scale.
Español rioplatense, cálido pero directo. Respuestas cortas: máx 120 palabras o 4 bullets. Un foco de acción.${biz}${rep}

Pilares: F=Fascinate · E=Educate · T=Transform · I=Invite.
Reglas: usá tools para números reales. Si necesitás metodología usá search_knowledge. Solo hablás de SU negocio — nada de otros clientes ni sistema interno.`
}

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sb = createServiceClient()
    const { data: { user }, error: authErr } = await sb.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await sb
      .from("profiles").select("role, client_id").eq("id", user.id).maybeSingle()
    const role = (profile as any)?.role ?? null
    const ownClientId = (profile as any)?.client_id ?? null
    const internal = isInternal(role)

    // Cliente sin negocio vinculado: no puede usar el asistente todavía.
    if (!internal && !ownClientId) {
      return NextResponse.json({
        reply: "Todavía no tenés un negocio vinculado a tu cuenta. Avisале al equipo de Smart Scale para activarlo.",
        tools_used: [],
      })
    }

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const incoming = Array.isArray(body?.messages) ? body.messages : null
    if (!incoming || incoming.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    // Cliente activo de contexto: interno usa el del header; cliente usa el suyo.
    const activeClientId   = internal ? (typeof body.client_id === "string" ? body.client_id : null) : ownClientId
    const activeClientName = typeof body.client_name === "string" ? body.client_name : null

    // ── Conversación persistente ──────────────────────────────────────────────
    const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : null

    if (!conversationId) {
      return NextResponse.json({ error: "conversation_id requerido." }, { status: 400 })
    }

    // Verificar que la conversación pertenece al usuario y chequear límite
    {
      const { data: conv } = await sb
        .from("ann_conversations")
        .select("id, messages, title")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (!conv) {
        return NextResponse.json({ error: "Conversación no encontrada." }, { status: 404 })
      }

      const existingCount = Array.isArray(conv.messages) ? conv.messages.length : 0
      if (existingCount >= MAX_MESSAGES_PER_CONVERSATION) {
        return NextResponse.json(
          { error: `Límite de mensajes alcanzado (${MAX_MESSAGES_PER_CONVERSATION}). Iniciá una nueva conversación.`, limitReached: true },
          { status: 429 },
        )
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 })

    const anthropic = new Anthropic({ apiKey })

    // ── Contexto del cliente (solo para rol cliente) ──────────────────────────
    let businessProfile: string | null = null
    let lastReport: Record<string, any> | null = null

    if (!internal && ownClientId) {
      const [profileRes, reportRes] = await Promise.all([
        sb.from("clients")
          .select("business_profile")
          .eq("id", ownClientId)
          .maybeSingle(),
        sb.from("monthly_reports")
          .select("month, total_revenue, mrr, new_clients, next_focus, biggest_win, support_needed")
          .eq("client_id", ownClientId)
          .order("month", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      businessProfile = (profileRes as any)?.data?.business_profile ?? null
      lastReport      = (reportRes as any)?.data ?? null
    }

    // Para internos con cliente activo: traer business_profile
    let internalClientProfile: string | null = null
    if (internal && activeClientId) {
      const { data: cp } = await sb
        .from("clients")
        .select("business_profile")
        .eq("id", activeClientId)
        .maybeSingle()
      internalClientProfile = (cp as any)?.business_profile ?? null
    }

    const messages: Anthropic.MessageParam[] = incoming
      .slice(-MAX_HISTORY)
      .filter((m: any) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m: any) => ({ role: m.role, content: m.content }))

    const baseSystem = internal
      ? systemPromptInternal(activeClientId, activeClientName, internalClientProfile)
      : systemPromptClient(activeClientName, businessProfile, lastReport)

    const system: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: baseSystem,
        cache_control: { type: "ephemeral" },
      },
    ]

    const tools = getToolDefinitions(internal)
    const scope = { isInternal: internal, ownClientId }
    const toolsUsed: string[] = []

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: tools as any,
        messages,
      })

      if (resp.stop_reason === "tool_use") {
        const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []
        for (const block of resp.content) {
          if (block.type === "tool_use") {
            toolsUsed.push(block.name)
            const result = await executeTool(sb, block.name, block.input as any, scope)
            toolResultBlocks.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            })
          }
        }
        messages.push({ role: "assistant", content: resp.content })
        messages.push({ role: "user", content: toolResultBlocks })
        continue
      }

      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")

      // ── Guardar en DB si hay conversación activa ────────────────────────────
      if (conversationId) {
        // incoming ya tiene todos los mensajes incluyendo el nuevo del usuario;
        // agregamos la respuesta del asistente.
        const updatedMessages = [
          ...incoming
            .filter((m: any) => m.role === "user" || m.role === "assistant")
            .map((m: any) => ({ role: m.role, content: m.content })),
          { role: "assistant", content: text, tools: toolsUsed.length > 0 ? Array.from(new Set(toolsUsed)) : undefined },
        ]

        // Derivar título de la primera pregunta del usuario
        const firstUserMsg = updatedMessages.find((m: any) => m.role === "user")
        const derivedTitle = firstUserMsg
          ? String(firstUserMsg.content).slice(0, 60) + (firstUserMsg.content.length > 60 ? "…" : "")
          : null

        const updatePayload: Record<string, any> = {
          messages:   updatedMessages,
          updated_at: new Date().toISOString(),
        }
        if (derivedTitle) updatePayload.title = derivedTitle

        await sb
          .from("ann_conversations")
          .update(updatePayload)
          .eq("id", conversationId)
          .eq("user_id", user.id)
      }

      return NextResponse.json({ reply: text, tools_used: toolsUsed, conversation_id: conversationId })
    }

    return NextResponse.json({
      reply: "Me quedé sin pasos para resolver esto. Probá reformular la pregunta.",
      tools_used: toolsUsed,
    })
  } catch (err: any) {
    await log.error("ann-ai/chat", err?.message ?? "Error interno", { stack: err?.stack?.slice(0, 300) })
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
