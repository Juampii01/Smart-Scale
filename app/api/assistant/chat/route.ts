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
import { rateLimit } from "@/lib/rate-limit"
import { isInternal } from "@/lib/auth/permissions"
import { getToolDefinitions, executeTool, buildKnowledgeIndexBlock } from "@/lib/assistant/tools"
import { MAX_MESSAGES_PER_CONVERSATION } from "@/app/api/assistant/conversations/route"
import { buildOmniSystemPrompt } from "@/lib/omni/system-prompt"
import { log } from "@/lib/logger"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MODEL          = process.env.ANAI_MODEL ?? "claude-sonnet-4-5"
const MAX_TOOL_ROUNDS = 3   // reducido de 6 — máx 3 herramientas por pregunta
const MAX_HISTORY     = 12  // últimos 12 mensajes de contexto
const MAX_TOKENS      = 900 // salida máxima por respuesta

// Fallback defensivo — solo se usa si buildOmniSystemPrompt("ann") falla (fila
// omni_client_profiles borrada/incompleta). El chat, a diferencia de un job
// batch, no se puede caer por esto.
const FALLBACK_CORE_INTERNAL = `Sos Ann AI, analista interna de Smart Scale (coaching escala negocios online).
Español rioplatense. Directo, sin relleno.

Pilares: F=Fascinate (audiencia) · E=Educate (nurturing) · T=Transform (oferta/casos) · I=Invite (prospección).
Diagnóstico = pilar flojo + dato que lo prueba + acción concreta.`

const FALLBACK_CORE_CLIENT = `Sos Ann AI, asistente personal de negocios en Smart Scale.
Español rioplatense, cálido pero directo.

Pilares: F=Fascinate · E=Educate · T=Transform · I=Invite.`

// Coda de "modo chat": annCore trae el criterio real de Ann (mismo que usan
// los motores de análisis), pero está escrito para generar un feedback
// estructurado de 4 pasos — acá aclaramos que en una charla en vivo no hay
// que forzar ese formato en cada mensaje.
function chatCoda(details: string): string {
  return `

---

## Modo chat

Estás en una conversación en vivo, no generando un reporte. NO sigas la "Estructura obligatoria de todo feedback" de arriba para saludos, preguntas simples o intercambios casuales — conversá natural y directo. Cuando sí das feedback sustancial sobre el negocio, mantené el criterio de las 3 capas (principio → evidencia → acción) pero de forma breve, como en una charla, no como un informe con encabezados. Respuestas cortas: máx 120 palabras o 4 bullets, un foco de acción por respuesta.

${details}`
}

function systemPromptInternal(annCore: string, clientId: string | null, clientName: string | null, businessProfile: string | null = null): string {
  const ctx = clientId
    ? `Cliente activo: ${clientName ?? "(sin nombre)"} (id: ${clientId}).`
    : "Sin cliente seleccionado — usá list_clients si te piden uno."

  const bizCtx = businessProfile ? `\nNegocio del cliente: ${businessProfile}` : ""

  return annCore + chatCoda(`Reglas: usá tools para números (nunca inventes). Si necesitás metodología, usá search_knowledge con término puntual. ${ctx}${bizCtx}`)
}

const BUSINESS_PROFILE_INTAKE = `
El perfil de negocio de este cliente todavía está vacío. Antes de dar cualquier feedback sustancial sobre su negocio, hacé 2-3 preguntas breves y conversacionales (de a una por mensaje, no todas juntas) para entender: a qué se dedica, qué vende/ofrece, y quién es su cliente ideal. Si ya te dio esa info en mensajes anteriores de esta misma conversación, no se la vuelvas a pedir. En cuanto tengas lo suficiente, sintetizalo en un párrafo de 2-4 líneas y llamá a la tool save_business_profile con ese resumen — no se lo vuelvas a preguntar después de guardarlo.`

function systemPromptClient(
  annCore: string,
  clientName: string | null,
  businessProfile: string | null,
  lastReport: Record<string, any> | null,
): string {
  const who = `Estás charlando con ${clientName ?? "el/la dueño/a de este negocio"}.`
  const biz = businessProfile ? `\nNegocio: ${businessProfile}` : ""

  const rep = lastReport
    ? `\nContexto reciente (${lastReport.month ?? ""}): revenue $${lastReport.total_revenue ?? "n/d"} · MRR $${lastReport.mrr ?? "n/d"}${lastReport.next_focus ? ` · foco: "${lastReport.next_focus}"` : ""}`
    : "\nEs nuevo en el programa — aún no tiene reportes cargados."

  const intake = businessProfile ? "" : BUSINESS_PROFILE_INTAKE

  return annCore + chatCoda(`${who}${biz}${rep}\nReglas: usá tools para números reales. Si necesitás metodología usá search_knowledge. Solo hablás de SU negocio — nada de otros clientes ni sistema interno.${intake}`)
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { bucket: "anai", limit: 20, windowMs: 60_000 })
  if (limited) return limited
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

    const scope = { isInternal: internal, ownClientId }

    // ── Criterio de Ann: el mismo prompt de 3 capas que usan los motores de análisis ──
    const [annCoreResult, knowledgeIndex] = await Promise.all([
      buildOmniSystemPrompt(sb, "ann").catch(async (e: any) => {
        await log.error("ann-ai/chat", "buildOmniSystemPrompt falló, uso fallback", { message: e?.message })
        return null
      }),
      buildKnowledgeIndexBlock(sb),
    ])
    const annCore = annCoreResult ?? (internal ? FALLBACK_CORE_INTERNAL : FALLBACK_CORE_CLIENT)

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
    const lastUserText = typeof lastUserMessage?.content === "string" ? lastUserMessage.content.trim() : ""

    let proactiveKnowledge = ""
    if (lastUserText) {
      const proactive = await executeTool(sb, "search_knowledge", { query: lastUserText, limit: 2 }, scope)
      if (Array.isArray(proactive) && proactive.length > 0) {
        const blocks = proactive.map((k: any) => `[${k.pillar}] ${k.title}:\n${k.content}`).join("\n\n")
        proactiveKnowledge = `Contexto ya recuperado del Cerebro de Ann para este mensaje (no hace falta volver a buscar esto, salvo que necesites otro tema):\n${blocks}`
      }
    }

    const baseSystem = internal
      ? systemPromptInternal(annCore, activeClientId, activeClientName, internalClientProfile)
      : systemPromptClient(annCore, activeClientName, businessProfile, lastReport)

    const system: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: knowledgeIndex ? `${baseSystem}\n\n${knowledgeIndex}` : baseSystem,
        cache_control: { type: "ephemeral" },
      },
      ...(proactiveKnowledge ? [{ type: "text" as const, text: proactiveKnowledge }] : []),
    ]

    const tools = getToolDefinitions(internal)
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
