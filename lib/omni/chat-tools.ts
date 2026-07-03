// Tools del chat de Omni — aisladas de lib/assistant/tools.ts (el de Ann/
// clientes) y de las tools de /api/admin/assistant (CRM interno). Estas solo
// consultan datos ya sincronizados de Omni (Slack + Instagram DMs).

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
  {
    name: "search_instagram_messages",
    description: `Busca mensajes de los DMs de Instagram (ya sincronizados) que contengan un texto (búsqueda parcial, no exacta).
Devuelve con quién es la conversación, quién mandó cada mensaje (el dueño de la cuenta conectada o el lead/contacto), fecha y texto.
Úsala para responder preguntas sobre una conversación puntual — ej: "¿qué le dijo a Andrés?", "qué preguntó tal persona por DM", "cómo fue la charla con tal lead".
Podés llamarla varias veces con distintos términos si la primera búsqueda no alcanza.`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Texto a buscar dentro de los mensajes (ILIKE parcial, no case-sensitive)",
        },
        participant: {
          type: "string",
          description: "Username de Instagram del otro participante, para acotar a una sola conversación. Opcional.",
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
    name: "list_instagram_conversations",
    description: `Lista las conversaciones de Instagram ya sincronizadas: con quién, cuántos mensajes tiene cada una y cuándo fue el último mensaje.
Úsala para saber con quién hay conversaciones antes de buscar, o si preguntan "con quién hablé", "qué conversaciones hay".`,
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

  if (name === "search_instagram_messages") {
    const query: string = String(input.query ?? "").trim()
    if (!query) return "Error: falta el término de búsqueda"
    const limit = Math.min(Number(input.limit) || 40, 100)

    let q = sb
      .from("omni_messages")
      .select("body, sender, sent_at, omni_conversations!inner(participant_username)")
      .ilike("body", `%${query}%`)
      .order("sent_at", { ascending: false })
      .limit(limit)

    if (input.participant) {
      q = q.eq("omni_conversations.participant_username", String(input.participant))
    }

    const { data, error } = await q
    if (error) return `Error BD: ${error.message}`
    if (!data || data.length === 0) return `No se encontraron mensajes que contengan "${query}"`

    return JSON.stringify(
      data.map((r: any) => ({
        conversacion_con: r.omni_conversations?.participant_username ?? "desconocido",
        remitente: r.sender,
        fecha: r.sent_at,
        texto: r.body,
      })),
    )
  }

  if (name === "list_instagram_conversations") {
    const { data: conversations, error } = await sb
      .from("omni_conversations")
      .select("id, participant_username, last_message_at")
      .order("last_message_at", { ascending: false })
    if (error) return `Error BD: ${error.message}`
    if (!conversations || conversations.length === 0) return "No hay conversaciones de Instagram sincronizadas todavía."

    const results = await Promise.all(conversations.map(async (c: any) => {
      const { count } = await sb
        .from("omni_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
      return {
        conversacion_con: c.participant_username ?? "desconocido",
        ultimo_mensaje: c.last_message_at,
        mensajes: count ?? 0,
      }
    }))

    return JSON.stringify(results)
  }

  return `Herramienta "${name}" no reconocida.`
}
