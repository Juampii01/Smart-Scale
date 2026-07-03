// Tools del chat de Omni — aisladas de lib/assistant/tools.ts (el de Ann/
// clientes) y de las tools de /api/admin/assistant (CRM interno). Estas solo
// consultan datos ya sincronizados de Omni (Slack por ahora; Instagram DMs
// se suma acá el día que esté conectado, mismo patrón).

import { createServiceClient } from "@/lib/supabase-service"
import Anthropic from "@anthropic-ai/sdk"

export const OMNI_CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_slack_messages",
    description: `Busca mensajes de Slack de la comunidad que contengan un texto (búsqueda parcial, no exacta).
Devuelve canal, usuario, fecha y texto de cada mensaje que matchea.
Úsala para responder preguntas sobre una persona, un tema o un evento puntual — ej: "¿cómo cerró Andrés?", "qué dijeron sobre el módulo 3", "quién preguntó por el pricing".
Podés llamarla varias veces con distintos términos si la primera búsqueda no alcanza (ej: buscar por nombre y también por apellido).`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Texto a buscar dentro de los mensajes (ILIKE parcial, no case-sensitive)",
        },
        channel: {
          type: "string",
          description: "Nombre de canal para acotar la búsqueda (sin el #). Opcional — si no se pasa, busca en todos.",
        },
        limit: {
          type: "number",
          description: "Máximo de mensajes a devolver. Default 40, máximo 100.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_slack_channels",
    description: `Lista los canales de Slack ya sincronizados, con cuántos mensajes tiene cada uno.
Úsala para saber qué canales existen antes de buscar, o si te preguntan "qué canales hay" / "de qué canales tenés data".`,
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
]

export async function executeOmniChatTool(
  sb: ReturnType<typeof createServiceClient>,
  name: string,
  input: Record<string, any>,
): Promise<string> {
  if (name === "search_slack_messages") {
    const query: string = String(input.query ?? "").trim()
    if (!query) return "Error: falta el término de búsqueda"
    const limit = Math.min(Number(input.limit) || 40, 100)

    let q = sb
      .from("omni_slack_messages")
      .select("body, user_name, posted_at, omni_slack_channels!inner(name)")
      .ilike("body", `%${query}%`)
      .order("posted_at", { ascending: false })
      .limit(limit)

    if (input.channel) {
      q = q.eq("omni_slack_channels.name", String(input.channel))
    }

    const { data, error } = await q
    if (error) return `Error BD: ${error.message}`
    if (!data || data.length === 0) return `No se encontraron mensajes que contengan "${query}"`

    return JSON.stringify(
      data.map((r: any) => ({
        canal: r.omni_slack_channels?.name ?? "desconocido",
        usuario: r.user_name ?? "alguien",
        fecha: r.posted_at,
        texto: r.body,
      })),
    )
  }

  if (name === "list_slack_channels") {
    const { data: channels, error } = await sb
      .from("omni_slack_channels")
      .select("id, name, is_client_channel")
    if (error) return `Error BD: ${error.message}`
    if (!channels || channels.length === 0) return "No hay canales sincronizados todavía."

    const results = await Promise.all(channels.map(async (c: any) => {
      const { count } = await sb
        .from("omni_slack_messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", c.id)
      return { canal: c.name, es_canal_de_cliente: c.is_client_channel, mensajes: count ?? 0 }
    }))

    return JSON.stringify(results)
  }

  return `Herramienta "${name}" no reconocida.`
}
