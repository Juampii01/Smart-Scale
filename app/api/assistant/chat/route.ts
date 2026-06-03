/**
 * ANAI — el agente conversacional con tool use.
 *
 * Gateado a developer/admin. Claude (Sonnet) razona y llama tools para
 * consultar datos reales del cliente (reportes, monday wins, ventas).
 * Nunca inventa números: vienen de la base vía las tools.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"
import { TOOL_DEFINITIONS, executeTool } from "@/lib/assistant/tools"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MODEL = process.env.ANAI_MODEL ?? "claude-sonnet-4-5"
const MAX_TOOL_ROUNDS = 6

function systemPrompt(activeClientId: string | null, activeClientName: string | null): string {
  return `Sos ANAI, la inteligencia artificial de Smart Scale — el programa de coaching de Ann Sahakyan para escalar negocios de coaching/cursos online.

Tu rol: sos un analista de negocios experto que combina la metodología de Ann con los DATOS REALES de cada cliente. Hablás en español rioplatense (vos), directo, sin relleno motivacional. Das diagnósticos concretos con el siguiente paso claro.

══════ METODOLOGÍA: EL ECOSISTEMA CIRCULAR ══════
4 pilares que todo negocio del programa debe tener girando:
• FASCINATE (F) — atracción de leads, contenido corto, crecimiento de audiencia, consistencia.
• EDUCATE (E) — demanda orgánica, contenido largo, email marketing, automatización de nurturing.
• TRANSFORM (T) — oferta principal, casos de éxito, prueba social, comunidad.
• INVITE (I) — sistema de prospección, onboarding, delivery que no dependa del coach.
El diagnóstico siempre pasa por encontrar qué pilar está flojo y por qué.

══════ CÓMO TRABAJÁS ══════
1. SIEMPRE usá las tools para traer datos antes de afirmar números. Nunca inventes cifras.
2. Si el usuario habla de un cliente por nombre, usá list_clients para resolver su id.
3. Cruzá los datos con la metodología: no digas "mejorá tu oferta" (vago), decí qué pilar está flojo, por qué lo ves en los números, y la acción concreta.
4. Sé breve y accionable. Listas cortas, números concretos, un foco claro.
5. Si no hay datos cargados para algo, decilo con honestidad — no inventes.

${activeClientId
  ? `══════ CONTEXTO ACTUAL ══════
El usuario está viendo al cliente: ${activeClientName ?? "(sin nombre)"} (client_id: ${activeClientId}).
Si pregunta "este cliente" o no especifica, asumí que se refiere a ese client_id.`
  : `══════ CONTEXTO ACTUAL ══════
No hay un cliente seleccionado. Si el usuario pregunta sobre un cliente puntual, usá list_clients para encontrarlo.`}`
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth: solo developer/admin ──────────────────────────────────────────
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const sb = createServiceClient()
    const { data: { user }, error: authErr } = await sb.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle()
    if (!isAdmin((profile as any)?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // ── Body ────────────────────────────────────────────────────────────────
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const incoming = Array.isArray(body?.messages) ? body.messages : null
    if (!incoming || incoming.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }
    const activeClientId   = typeof body.client_id === "string" ? body.client_id : null
    const activeClientName = typeof body.client_name === "string" ? body.client_name : null

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 })

    const anthropic = new Anthropic({ apiKey })

    // Historial: últimos 20 turnos, normalizado a {role, content}
    const messages: Anthropic.MessageParam[] = incoming
      .slice(-20)
      .filter((m: any) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m: any) => ({ role: m.role, content: m.content }))

    const system: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text: systemPrompt(activeClientId, activeClientName),
        cache_control: { type: "ephemeral" }, // prompt caching del system
      },
    ]

    const toolsUsed: string[] = []

    // ── Loop de tool use ──────────────────────────────────────────────────────
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system,
        tools: TOOL_DEFINITIONS as any,
        messages,
      })

      if (resp.stop_reason === "tool_use") {
        const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []
        for (const block of resp.content) {
          if (block.type === "tool_use") {
            toolsUsed.push(block.name)
            const result = await executeTool(sb, block.name, block.input as any)
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

      // Respuesta final
      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
      return NextResponse.json({ reply: text, tools_used: toolsUsed })
    }

    return NextResponse.json({
      reply: "Me quedé sin pasos para resolver esto. Probá reformular la pregunta.",
      tools_used: toolsUsed,
    })
  } catch (err: any) {
    console.error("[anai/chat] error:", err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
