/**
 * Herramientas (tool use) que ANAI puede llamar para consultar datos reales.
 *
 * Cada tool es una función server-side que consulta Supabase con el service
 * client. ANAI (gateado a developer/admin) puede ver cualquier cliente.
 *
 * El patrón es: Claude decide qué tool llamar → ejecutamos la query →
 * devolvemos JSON → Claude razona con datos frescos (sin inventar números).
 */

import type { createServiceClient } from "@/lib/supabase-service"

type SB = ReturnType<typeof createServiceClient>

// ─── Definiciones (schema que ve Claude) ──────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: "list_clients",
    description:
      "Lista todos los clientes del programa con su id y nombre. Usalo cuando el usuario menciona un cliente por nombre y necesitás resolver su id, o para tener el panorama general de quiénes hay.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_monthly_metrics",
    description:
      "Devuelve los reportes mensuales de un cliente: revenue, MRR, cash collected, ad spend, llamadas (agendadas/atendidas/calificadas), aplicaciones, nuevos clientes, offer docs, métricas de contenido (Instagram, YouTube, email) y reflexiones. Es la fuente principal para analizar la performance del negocio.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_id: { type: "string", description: "UUID del cliente" },
        months: { type: "number", description: "Cuántos meses recientes traer (default 6)" },
      },
      required: ["client_id"],
    },
  },
  {
    name: "get_monday_wins",
    description:
      "Devuelve los reportes semanales (Monday Wins) de un cliente: sus logros, su foco de la semana ('una sola cosa') y su bloqueo principal. Útil para entender en qué está trabajando y hacer accountability sobre lo que dijo que iba a hacer.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_id: { type: "string", description: "UUID del cliente" },
        limit: { type: "number", description: "Cuántos registros traer (default 8)" },
      },
      required: ["client_id"],
    },
  },
  {
    name: "get_cha_ching",
    description:
      "Devuelve las ventas cerradas (Cha-Ching) de un cliente: valor del trato, cash collected y fecha. Útil para ver el ritmo de cierres y el cash real entrando.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_id: { type: "string", description: "UUID del cliente" },
        limit: { type: "number", description: "Cuántos registros traer (default 10)" },
      },
      required: ["client_id"],
    },
  },
] as const

// ─── Ejecutor ─────────────────────────────────────────────────────────────────

export async function executeTool(
  sb: SB,
  name: string,
  input: Record<string, any>,
): Promise<unknown> {
  switch (name) {
    case "list_clients": {
      const { data, error } = await sb
        .from("clients")
        .select("id, nombre, name")
        .order("created_at", { ascending: false })
        .limit(200)
      if (error) return { error: error.message }
      return (data ?? []).map((c: any) => ({
        client_id: c.id,
        nombre: c.nombre || c.name || "(sin nombre)",
      }))
    }

    case "get_monthly_metrics": {
      const months = Math.min(24, Math.max(1, Number(input.months) || 6))
      const { data, error } = await sb
        .from("monthly_reports")
        .select(
          "month, total_revenue, cash_collected, mrr, ad_spend, scheduled_calls, attended_calls, qualified_calls, aplications, new_clients, active_clients, offer_docs_sent, offer_docs_responded, cierres_por_offerdoc, short_followers, short_reach, short_posts, yt_subscribers, yt_views, yt_videos, email_subscribers, email_new_subscribers, biggest_win, next_focus, support_needed, nps_score",
        )
        .eq("client_id", input.client_id)
        .order("month", { ascending: false })
        .limit(months)
      if (error) return { error: error.message }
      if (!data || data.length === 0) return { mensaje: "Este cliente no tiene reportes mensuales cargados todavía." }
      return data
    }

    case "get_monday_wins": {
      const limit = Math.min(20, Math.max(1, Number(input.limit) || 8))
      const { data, error } = await sb
        .from("monday_wins")
        .select("fecha, logro_1, logro_2, logro_3, una_sola_cosa, bloqueo")
        .eq("client_id", input.client_id)
        .order("fecha", { ascending: false })
        .limit(limit)
      if (error) return { error: error.message }
      if (!data || data.length === 0) return { mensaje: "Este cliente no tiene Monday Wins cargados todavía." }
      return data
    }

    case "get_cha_ching": {
      const limit = Math.min(30, Math.max(1, Number(input.limit) || 10))
      const { data, error } = await sb
        .from("cha_ching")
        .select("fecha, valor_trato, cash_collected, proximo_nivel")
        .eq("client_id", input.client_id)
        .order("fecha", { ascending: false })
        .limit(limit)
      if (error) return { error: error.message }
      if (!data || data.length === 0) return { mensaje: "Este cliente no tiene ventas (Cha-Ching) registradas todavía." }
      return data
    }

    default:
      return { error: `Tool desconocida: ${name}` }
  }
}
