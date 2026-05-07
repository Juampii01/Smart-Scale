/**
 * Generación de SOPs con Claude.
 *
 * Recibe una descripción en lenguaje natural ("los jueves se hace una llamada
 * que se graba y se sube a Skool y se avisa por Slack") y devuelve un SOP
 * estructurado en JSON: title, description, frequency, tags, steps, templates.
 *
 * Templates de Skool/Slack siguen el formato exacto que usa Smart Scale (Ann),
 * con emojis ➡️ y bullet points como en los posts originales.
 *
 * Solo admin.
 */

import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const SYSTEM_PROMPT = `Sos un asistente que genera SOPs (Standard Operating Procedures) operativos para Smart Scale, un programa de coaching liderado por Ann Sahakyan.

A partir de una descripción en lenguaje natural de un proceso, devolvés un SOP estructurado en JSON estricto. Sin texto adicional, sin markdown fences, sin explicaciones — solo el JSON.

Formato de output:

{
  "title": "Título corto y claro del SOP",
  "description": "1-2 oraciones que expliquen qué hace y para qué sirve",
  "frequency": "Cuándo se ejecuta (ej. 'Semanal - Jueves', 'Cada nuevo cliente', 'Ad hoc')",
  "tags": ["tag1", "tag2"],
  "steps": [
    { "order": 1, "label": "Paso accionable, en imperativo" },
    { "order": 2, "label": "..." }
  ],
  "templates": [
    {
      "channel": "skool",
      "label": "Aviso post-grabación",
      "body": "..."
    },
    {
      "channel": "slack",
      "label": "Aviso al equipo",
      "body": "..."
    }
  ]
}

Reglas:
- title: máximo 60 caracteres, sin emojis, descriptivo
- description: 1-2 oraciones máximo
- frequency: en español, free text
- tags: 2-4 etiquetas en minúscula, una palabra cada una (ej. "live", "skool", "onboarding")
- steps: cada paso es 1 línea, en imperativo ("Subir grabación a Vadoo", "Enviar mensaje en Skool con link"). Mínimo 2 pasos. Sin sub-bullets.
- templates: incluir al menos 1 template por cada canal mencionado en la descripción. Si la descripción menciona Skool y Slack, generá los 2.

Formato de templates Skool (REPLICAR EXACTAMENTE este estilo):

Título corto del post 🚀

Buenas noches team

[Texto de contexto - 1-2 oraciones]

Les dejo [lo que sea] junto con [lo que sea]:

➡️ [Recurso 1]: LINK AQUI
➡️ [Recurso 2]: LINK AQUI
➡️ [Item 3]: descripción corta

Notas: cada bullet empieza con ➡️ (emoji exacto). El título lleva 1 emoji al final (🚀, 📞, ✅, etc. según contexto). Tono cercano, español rioplatense (vos), sin "Hola"/"Saludos" formales.

Formato de templates Slack:

[Mensaje breve, directo, 2-4 líneas máximo]
[Link si aplica]

Tono: directo, sin saludos largos. Como un mensaje al equipo, no a clientes.

Si el proceso involucra otros canales (Email, WhatsApp), generá templates con channel = "email" o "whatsapp" usando un tono similar al canal correspondiente.`

interface GeneratedSOP {
  title:       string
  description: string
  frequency:   string
  tags:        string[]
  steps:       { order: number; label: string }[]
  templates:   { channel: string; label: string; body: string }[]
}

function validateGeneratedSOP(obj: any): obj is GeneratedSOP {
  if (!obj || typeof obj !== "object") return false
  if (typeof obj.title !== "string" || !obj.title.trim()) return false
  if (typeof obj.description !== "string") return false
  if (typeof obj.frequency !== "string") return false
  if (!Array.isArray(obj.tags)) return false
  if (!Array.isArray(obj.steps) || obj.steps.length === 0) return false
  if (!Array.isArray(obj.templates)) return false
  return true
}

export async function POST(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const description = String(body?.description ?? "").trim()
    if (!description) return NextResponse.json({ error: "description required" }, { status: 400 })
    if (description.length > 4000) return NextResponse.json({ error: "description too long (max 4000)" }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 })
    }

    const anthropic = new Anthropic({ apiKey })

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        { role: "user", content: `Generá un SOP a partir de esta descripción:\n\n${description}` },
      ],
    })

    const textBlock = msg.content.find(b => b.type === "text")
    const raw = textBlock?.type === "text" ? textBlock.text.trim() : ""

    // El modelo a veces envuelve en ```json — limpiamos defensivamente.
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim()

    let parsed: any
    try { parsed = JSON.parse(cleaned) }
    catch {
      return NextResponse.json(
        { error: "El modelo devolvió un JSON inválido. Probá de nuevo o reformulá la descripción.", raw },
        { status: 502 }
      )
    }

    if (!validateGeneratedSOP(parsed)) {
      return NextResponse.json(
        { error: "El SOP generado no tiene la forma esperada. Probá reformular la descripción.", raw: parsed },
        { status: 502 }
      )
    }

    // Normalizar order en steps (el modelo a veces no enumera bien)
    parsed.steps = parsed.steps.map((s: any, idx: number) => ({
      order: idx + 1,
      label: String(s.label ?? "").trim(),
    })).filter((s: any) => s.label)

    return NextResponse.json({ sop: parsed })
  } catch (err: any) {
    console.error("[sops/generate] error:", err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
