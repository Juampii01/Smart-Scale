/**
 * Extrae el método/criterio con el que Ann responde preguntas en Slack, a
 * partir del historial ya sincronizado en omni_slack_messages (ver
 * app/api/admin/omni/slack/sync/route.ts). No guarda nada automáticamente —
 * devuelve {text, title} para precargar el formulario de "nueva entrada" en
 * /admin/ann-knowledge, mismo patrón que extract/route.ts (PDF/DOCX), así el
 * admin revisa antes de guardar en el Cerebro.
 *
 * Se puede volver a correr cuando se acumulen más mensajes — no es un
 * proceso de una sola vez.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function getJwt(req: NextRequest) {
  return (req.headers.get("authorization") ?? "").replace("Bearer ", "")
}

const ANN_NAMES = ["ann sahakyan", "ann"]

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(getJwt(req))
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { body = {} }
  const channelName = String(body?.channel_name ?? "preguntas-feedback").trim()

  const sb = createServiceClient()

  const { data: channel, error: channelErr } = await sb
    .from("omni_slack_channels")
    .select("id, name")
    .eq("name", channelName)
    .maybeSingle()
  if (channelErr) return NextResponse.json({ error: channelErr.message }, { status: 500 })
  if (!channel) return NextResponse.json({ error: `Canal "${channelName}" no encontrado — ¿ya se sincronizó?` }, { status: 404 })

  const { data: messages, error: msgErr } = await sb
    .from("omni_slack_messages")
    .select("user_name, body, posted_at")
    .eq("channel_id", (channel as any).id)
    .order("posted_at", { ascending: true })
  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 })
  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: `El canal "${channelName}" no tiene mensajes sincronizados.` }, { status: 404 })
  }

  const annMessageCount = messages.filter((m: any) => ANN_NAMES.includes(String(m.user_name ?? "").toLowerCase())).length
  if (annMessageCount === 0) {
    return NextResponse.json({ error: `Ninguno de los ${messages.length} mensajes de "${channelName}" está firmado por Ann — revisá el nombre exacto en Slack.` }, { status: 404 })
  }

  const transcript = messages
    .map((m: any) => `[${new Date(m.posted_at).toLocaleDateString("es-AR")}] ${m.user_name ?? "?"}: ${m.body ?? ""}`)
    .join("\n")

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 })

  const anthropic = new Anthropic({ apiKey })
  const response = await anthropic.messages.create({
    model: process.env.ANAI_MODEL ?? "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content:
        `Este es el historial completo del canal de Slack #${channelName} de Smart Scale — ` +
        `el equipo y los clientes hacen preguntas ahí y Ann Sahakyan (fundadora) responde. ` +
        `Se identifica por el nombre "Ann Sahakyan" en cada mensaje.\n\n` +
        `Tu tarea: leer TODOS los intercambios donde alguien le pregunta algo a Ann y ella responde, ` +
        `y sintetizar el MÉTODO y CRITERIO con el que ella responde — no transcribas las respuestas ` +
        `literales, extraé los patrones reusables: qué tono usa, cómo estructura una respuesta, qué ` +
        `pasos sigue antes de dar una solución (¿pide contexto primero? ¿da el principio general antes ` +
        `del caso puntual?), qué tipo de preguntas resuelve ella misma vs. cuándo deriva a otra persona, ` +
        `qué frases o marcos conceptuales repite, y cualquier patrón consistente que un asistente de IA ` +
        `necesitaría imitar para responder "como Ann" ante una pregunta nueva y parecida.\n\n` +
        `Agrupá el resultado en secciones claras con subtítulos (ej. "Tono y estilo", "Estructura de una ` +
        `respuesta típica", "Criterios para decidir la solución", "Frases/marcos recurrentes", "Cuándo ` +
        `deriva en vez de responder"). Si un patrón aparece solo una o dos veces, no lo incluyas como si ` +
        `fuera una regla — priorizá lo que se repite. Escribí en español, directo, sin relleno.\n\n` +
        `--- TRANSCRIPT ---\n${transcript}`,
    }],
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")

  return NextResponse.json({
    text: text.trim(),
    title: `Método de respuesta de Ann (Slack #${channelName})`,
    source_messages: messages.length,
    ann_messages: annMessageCount,
  })
}
