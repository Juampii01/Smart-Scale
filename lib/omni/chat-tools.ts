// Tools del chat de Omni — aisladas de lib/assistant/tools.ts (el de Ann/
// clientes) y de las tools de /api/admin/assistant (CRM interno). Estas solo
// consultan datos ya sincronizados de Omni (Slack + Instagram DMs).

import { createServiceClient } from "@/lib/supabase-service"
import Anthropic from "@anthropic-ai/sdk"

export const OMNI_CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_slack_messages",
    description: `Busca o trae mensajes de Slack de la comunidad. Dos modos:
1. Con "query": busca mensajes que contengan ese texto (ILIKE parcial). Úsala para preguntas sobre una persona, tema o evento puntual — ej: "¿cómo cerró Andrés?", "qué dijeron sobre el módulo 3".
2. Sin "query" pero con "channel": trae los mensajes más recientes de ESE canal completo, sin filtrar por texto. Úsala cuando piden "resumime el canal X" o "qué pasó en X" sin un término específico.
Necesitás pasar al menos uno de los dos (query o channel). Podés llamarla varias veces con distintos términos si la primera búsqueda no alcanza.`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Texto a buscar dentro de los mensajes (ILIKE parcial, no case-sensitive). Opcional si pasás channel.",
        },
        channel: {
          type: "string",
          description: "Nombre de canal para acotar la búsqueda o traer toda su conversación reciente (sin el #). Opcional si pasás query.",
        },
        limit: {
          type: "number",
          description: "Máximo de mensajes a devolver. Default 40, máximo 100.",
        },
      },
      required: [],
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
    description: `Busca o trae mensajes de los DMs de Instagram ya sincronizados. Dos modos:
1. Con "query": busca mensajes que contengan ese texto (ILIKE parcial). Úsala para preguntas puntuales — ej: "qué preguntó tal persona por DM".
2. Sin "query" pero con "participant": trae los mensajes más recientes de TODA la conversación con esa persona, sin filtrar por texto. Úsala cuando piden "analizá mi conversación con X" o "qué pasó con X" sin un término específico — es el caso más común en DMs 1 a 1.
Necesitás pasar al menos uno de los dos (query o participant). Devuelve con quién es la conversación, quién mandó cada mensaje (el dueño de la cuenta o el lead/contacto), fecha y texto.`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Texto a buscar dentro de los mensajes (ILIKE parcial, no case-sensitive). Opcional si pasás participant.",
        },
        participant: {
          type: "string",
          description: "Username de Instagram del otro participante — trae toda su conversación reciente si no hay query. Opcional si pasás query.",
        },
        limit: {
          type: "number",
          description: "Máximo de mensajes a devolver. Default 40, máximo 100.",
        },
      },
      required: [],
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
  {
    name: "search_leads",
    description: `Busca leads por nombre/instagram, o trae los más recientes. Para cada lead devuelve además, si ya se convirtió en cliente, cómo cerró (pago único/cuotas, monto, cuotas pagadas) — útil para preguntas del tipo "¿qué leads de baja calificación cerraron?" o "¿cómo cerró tal persona?".
Sin "query": trae los leads más recientes (default 20). Con "query": filtra por nombre o instagram.`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Nombre o instagram a buscar (parcial, no case-sensitive). Opcional — sin esto trae los más recientes.",
        },
        limit: {
          type: "number",
          description: "Máximo de leads a devolver. Default 20, máximo 50.",
        },
      },
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
    const channel: string = String(input.channel ?? "").trim()
    if (!query && !channel) return "Error: pasá al menos 'query' o 'channel'"
    const limit = Math.min(Number(input.limit) || 40, 100)

    let q = sb
      .from("omni_slack_messages")
      .select("body, user_name, posted_at, omni_slack_channels!inner(name)")
      .order("posted_at", { ascending: false })
      .limit(limit)

    if (query) q = q.ilike("body", `%${query}%`)
    if (channel) q = q.eq("omni_slack_channels.name", channel)

    const { data, error } = await q
    if (error) return `Error BD: ${error.message}`
    if (!data || data.length === 0) {
      return query ? `No se encontraron mensajes que contengan "${query}"` : `No hay mensajes en el canal "${channel}"`
    }

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
    const participant: string = String(input.participant ?? "").trim()
    if (!query && !participant) return "Error: pasá al menos 'query' o 'participant'"
    const limit = Math.min(Number(input.limit) || 40, 100)

    let q = sb
      .from("omni_messages")
      .select("body, sender, sent_at, omni_conversations!inner(participant_username)")
      .order("sent_at", { ascending: false })
      .limit(limit)

    if (query) q = q.ilike("body", `%${query}%`)
    if (participant) q = q.eq("omni_conversations.participant_username", participant)

    const { data, error } = await q
    if (error) return `Error BD: ${error.message}`
    if (!data || data.length === 0) {
      return query ? `No se encontraron mensajes que contengan "${query}"` : `No hay mensajes en la conversación con "${participant}"`
    }

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

  if (name === "search_leads") {
    const query: string = String(input.query ?? "").trim()
    const limit = Math.min(Number(input.limit) || 20, 50)

    let q = sb
      .from("leads")
      .select("id, name, rating, source, lead_type, niche, tag, notes, purchased, instagram, created_at")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (query) q = q.or(`name.ilike.%${query}%,instagram.ilike.%${query}%`)

    const { data: leads, error } = await q
    if (error) return `Error BD: ${error.message}`
    if (!leads || leads.length === 0) return query ? `No se encontraron leads que coincidan con "${query}"` : "No hay leads cargados."

    const leadIds = leads.map((l: any) => l.id)
    const { data: clients } = await sb
      .from("crm_clients")
      .select("id, name, lead_id, is_monthly_subscription, num_installments, total_amount")
      .in("lead_id", leadIds)

    const clientsByLeadId = new Map((clients ?? []).map((c: any) => [c.lead_id, c]))

    return JSON.stringify(
      leads.map((l: any) => {
        const client = clientsByLeadId.get(l.id)
        return {
          nombre: l.name,
          instagram: l.instagram,
          rating: l.rating,
          fuente: l.source,
          tipo: l.lead_type,
          nicho: l.niche,
          tag: l.tag,
          notas: l.notes,
          compro: l.purchased,
          cierre: client
            ? {
                pago: client.is_monthly_subscription ? "suscripción mensual" : client.num_installments <= 1 ? "pago único" : `${client.num_installments} cuotas`,
                monto_total: client.total_amount,
              }
            : null,
        }
      }),
    )
  }

  return `Herramienta "${name}" no reconocida.`
}
