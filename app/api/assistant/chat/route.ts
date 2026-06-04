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
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MODEL = process.env.ANAI_MODEL ?? "claude-haiku-4-5-20251001"
const MAX_TOOL_ROUNDS = 6

const METHOD = `══════ METODOLOGÍA: EL ECOSISTEMA CIRCULAR ══════
4 pilares que todo negocio del programa debe tener girando:
• FASCINATE (F) — atracción de leads, contenido corto, crecimiento de audiencia, consistencia.
• EDUCATE (E) — demanda orgánica, contenido largo, email marketing, automatización de nurturing.
• TRANSFORM (T) — oferta principal, casos de éxito, prueba social, comunidad.
• INVITE (I) — sistema de prospección, onboarding, delivery que no dependa del coach.
El diagnóstico siempre pasa por encontrar qué pilar está flojo y por qué.`

function systemPromptInternal(activeClientId: string | null, activeClientName: string | null): string {
  return `Sos Ann AI, la inteligencia artificial de Smart Scale — el programa de coaching de Ann Sahakyan para escalar negocios de coaching/cursos online.

Tu rol acá: sos un analista de negocios para el EQUIPO INTERNO. Combinás la metodología de Ann con los datos reales de cada cliente. Hablás en español rioplatense (vos), directo, sin relleno motivacional. Das diagnósticos concretos con el siguiente paso claro.

${METHOD}

══════ CÓMO TRABAJÁS ══════
1. SIEMPRE usá las tools para traer datos antes de afirmar números. Nunca inventes cifras.
2. Si el usuario habla de un cliente por nombre, usá list_clients para resolver su id.
3. Cuando necesités marcos, frameworks o estrategias específicas de Ann, usá search_knowledge con un término concreto (ej: "oferta", "contenido corto", "cierre", "prospección"). No cargues todo: buscá solo lo relevante para la pregunta.
4. Cruzá los datos con la metodología: no digas "mejorá la oferta" (vago), decí qué pilar está flojo, por qué lo ves en los números, y la acción concreta.
5. Sé breve y accionable. Números concretos, un foco claro.
6. Si no hay datos cargados para algo, decilo con honestidad.

${activeClientId
  ? `══════ CONTEXTO ══════
El usuario está viendo al cliente: ${activeClientName ?? "(sin nombre)"} (client_id: ${activeClientId}). Si pregunta "este cliente" o no especifica, usá ese client_id.`
  : `══════ CONTEXTO ══════
No hay un cliente seleccionado. Si el usuario pregunta por uno puntual, usá list_clients para encontrarlo.`}`
}

function systemPromptClient(
  clientName: string | null,
  businessProfile: string | null,
  lastReport: Record<string, any> | null,
): string {
  const businessCtx = businessProfile
    ? `\n\n══════ TU NEGOCIO ══════\n${businessProfile}`
    : ""

  let reportCtx = ""
  if (lastReport) {
    const lines: string[] = []
    if (lastReport.month) lines.push(`Último reporte: ${lastReport.month}`)
    if (lastReport.total_revenue != null) lines.push(`Revenue: $${lastReport.total_revenue}`)
    if (lastReport.mrr != null) lines.push(`MRR: $${lastReport.mrr}`)
    if (lastReport.new_clients != null) lines.push(`Nuevos clientes: ${lastReport.new_clients}`)
    if (lastReport.next_focus) lines.push(`Foco declarado: "${lastReport.next_focus}"`)
    if (lastReport.biggest_win) lines.push(`Mayor logro: "${lastReport.biggest_win}"`)
    if (lastReport.support_needed) lines.push(`Necesita apoyo en: "${lastReport.support_needed}"`)
    if (lines.length > 0) {
      reportCtx = `\n\n══════ CONTEXTO RECIENTE ══════\n${lines.join("\n")}`
    }
  }

  return `Sos Ann AI, el asistente de inteligencia artificial del programa Smart Scale de Ann Sahakyan. Estás hablando DIRECTAMENTE con ${clientName ?? "el dueño/a"} sobre SU PROPIO negocio.

Hablás en español rioplatense (vos), cálido pero directo, sin relleno motivacional vacío. Sos su coach personal de datos: lo ayudás a entender sus números y a saber en qué enfocarse, usando la metodología de Ann.${businessCtx}${reportCtx}

${METHOD}

══════ CÓMO TRABAJÁS ══════
1. Usá el contexto de arriba para hablar de SU negocio específico desde el primer mensaje — no genérico.
2. SIEMPRE usá las tools para traer SUS datos antes de afirmar números. Nunca inventes cifras.
3. Referite a su negocio por nombre/nicho cuando lo conozcas. Es su asistente personal.
4. Cuando necesités marcos o estrategias de Ann, usá search_knowledge con un término concreto. Solo buscá lo relevante para lo que te pregunta.
5. Cruzá sus datos con la metodología: identificá qué pilar tiene flojo, por qué se ve en sus números, y la acción concreta para esta semana/mes.
6. Sé breve y accionable. Un foco claro.
7. Si todavía no cargó datos de algo, invitalo amablemente a cargarlos (reporte mensual, monday win, cha-ching) para que puedas ayudarlo mejor.
8. NUNCA menciones a otros clientes, ni el sistema interno, ni datos que no sean de él. Solo su negocio.`
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

    if (conversationId) {
      // Verificar que la conversación pertenece al usuario y chequear límite
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

    const messages: Anthropic.MessageParam[] = incoming
      .slice(-20)
      .filter((m: any) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m: any) => ({ role: m.role, content: m.content }))

    const baseSystem = internal
      ? systemPromptInternal(activeClientId, activeClientName)
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
        max_tokens: 1500,
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
    console.error("[ann-ai/chat] error:", err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
