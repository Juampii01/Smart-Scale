/**
 * Herramientas (tool use) que Ann AI puede llamar para consultar datos reales.
 *
 * SEGURIDAD — scope por rol:
 *  - Interno (admin/developer/team/setter): puede consultar cualquier cliente
 *    (pasa client_id). Tiene list_clients.
 *  - Cliente: queda BLOQUEADO a su propio client_id. El backend fuerza su
 *    ownClientId en cada tool, ignorando cualquier client_id que el modelo
 *    intente pasar. No tiene list_clients. Jamás puede ver datos de otro.
 *
 * Como el service client bypassea RLS, el aislamiento se hace acá en código:
 * para clientes, clientId = scope.ownClientId SIEMPRE.
 */

import type { createServiceClient } from "@/lib/supabase-service"

type SB = ReturnType<typeof createServiceClient>

export interface ToolScope {
  isInternal: boolean
  ownClientId: string | null
}

// ─── Definiciones (schema que ve Claude) — dependen del rol ───────────────────

export function getToolDefinitions(isInternal: boolean) {
  // Para clientes no exponemos client_id: el backend inyecta el suyo.
  const clientIdProp = isInternal
    ? { client_id: { type: "string" as const, description: "UUID del cliente a consultar" } }
    : {}
  const req = isInternal ? ["client_id"] : []

  const tools: any[] = [
    {
      name: "get_monthly_metrics",
      description:
        "Devuelve los reportes mensuales: revenue, MRR, cash collected, ad spend, llamadas (agendadas/atendidas/calificadas), aplicaciones, nuevos clientes, offer docs, métricas de contenido (Instagram, YouTube, email) y reflexiones. Fuente principal para analizar la performance del negocio.",
      input_schema: {
        type: "object" as const,
        properties: { ...clientIdProp, months: { type: "number", description: "Cuántos meses recientes traer (default 6)" } },
        required: req,
      },
    },
    {
      name: "get_monday_wins",
      description:
        "Devuelve los reportes semanales (Monday Wins): logros, el foco de la semana ('una sola cosa') y el bloqueo principal. Útil para entender en qué se está trabajando y hacer accountability.",
      input_schema: {
        type: "object" as const,
        properties: { ...clientIdProp, limit: { type: "number", description: "Cuántos registros traer (default 8)" } },
        required: req,
      },
    },
    {
      name: "get_cha_ching",
      description:
        "Devuelve las ventas cerradas (Cha-Ching): valor del trato, cash collected y fecha. Útil para ver el ritmo de cierres y el cash real entrando.",
      input_schema: {
        type: "object" as const,
        properties: { ...clientIdProp, limit: { type: "number", description: "Cuántos registros traer (default 10)" } },
        required: req,
      },
    },
  ]

  // search_knowledge: disponible para todos los roles
  tools.push({
    name: "search_knowledge",
    description:
      "Busca en la base de conocimiento de Ann (metodología, marcos, frameworks, estrategias) por palabra clave o pilar. Usalo cuando necesitás contexto metodológico para responder: qué dice Ann sobre contenido, oferta, prospección, etc. Devuelve los fragmentos más relevantes.",
    input_schema: {
      type: "object" as const,
      properties: {
        query:  { type: "string", description: "Término a buscar en título y contenido (ej: 'oferta', 'contenido corto', 'cierre')" },
        pillar: { type: "string", description: "Filtrar por pilar: F, E, T, I, general (opcional)" },
        limit:  { type: "number", description: "Cuántos resultados traer (default 3, máx 5)" },
      },
      required: ["query"],
    },
  })

  // list_clients solo para interno.
  if (isInternal) {
    tools.unshift({
      name: "list_clients",
      description:
        "Lista todos los clientes del programa con su id y nombre. Usalo cuando el usuario menciona un cliente por nombre y necesitás resolver su id, o para el panorama general.",
      input_schema: { type: "object" as const, properties: {}, required: [] },
    })
  }

  return tools
}

// ─── Ejecutor ─────────────────────────────────────────────────────────────────

export async function executeTool(
  sb: SB,
  name: string,
  input: Record<string, any>,
  scope: ToolScope,
): Promise<unknown> {
  // SEGURIDAD: para clientes, el clientId SIEMPRE es el suyo (ignora input).
  const clientId = scope.isInternal ? (input.client_id ?? null) : scope.ownClientId

  switch (name) {
    case "list_clients": {
      if (!scope.isInternal) return { error: "No disponible." }
      const { data, error } = await sb
        .from("clients")
        .select("id, nombre, name")
        .order("created_at", { ascending: false })
        .limit(200)
      if (error) return { error: error.message }
      return (data ?? []).map((c: any) => ({ client_id: c.id, nombre: c.nombre || c.name || "(sin nombre)" }))
    }

    case "get_monthly_metrics": {
      if (!clientId) return { mensaje: "No hay un cliente para consultar." }
      const months = Math.min(24, Math.max(1, Number(input.months) || 6))
      const { data, error } = await sb
        .from("monthly_reports")
        .select(
          "month, total_revenue, cash_collected, mrr, ad_spend, scheduled_calls, attended_calls, qualified_calls, aplications, new_clients, active_clients, offer_docs_sent, offer_docs_responded, cierres_por_offerdoc, short_followers, short_reach, short_posts, yt_subscribers, yt_views, yt_videos, email_subscribers, email_new_subscribers, biggest_win, next_focus, support_needed, nps_score",
        )
        .eq("client_id", clientId)
        .order("month", { ascending: false })
        .limit(months)
      if (error) return { error: error.message }
      if (!data || data.length === 0) return { mensaje: "No hay reportes mensuales cargados todavía." }
      return data
    }

    case "get_monday_wins": {
      if (!clientId) return { mensaje: "No hay un cliente para consultar." }
      const limit = Math.min(20, Math.max(1, Number(input.limit) || 8))
      const { data, error } = await sb
        .from("monday_wins")
        .select("fecha, logro_1, logro_2, logro_3, una_sola_cosa, bloqueo")
        .eq("client_id", clientId)
        .order("fecha", { ascending: false })
        .limit(limit)
      if (error) return { error: error.message }
      if (!data || data.length === 0) return { mensaje: "No hay Monday Wins cargados todavía." }
      return data
    }

    case "get_cha_ching": {
      if (!clientId) return { mensaje: "No hay un cliente para consultar." }
      const limit = Math.min(30, Math.max(1, Number(input.limit) || 10))
      const { data, error } = await sb
        .from("cha_ching")
        .select("fecha, valor_trato, cash_collected, proximo_nivel")
        .eq("client_id", clientId)
        .order("fecha", { ascending: false })
        .limit(limit)
      if (error) return { error: error.message }
      if (!data || data.length === 0) return { mensaje: "No hay ventas (Cha-Ching) registradas todavía." }
      return data
    }

    case "search_knowledge": {
      const query  = String(input.query ?? "").trim()
      const pillar = typeof input.pillar === "string" ? input.pillar.trim() : null
      const limit  = Math.min(5, Math.max(1, Number(input.limit) || 3))

      if (!query) return { mensaje: "Necesito un término de búsqueda." }

      let req = sb
        .from("ann_knowledge")
        .select("title, content, pillar")
        .eq("is_active", true)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order("sort_order", { ascending: true })
        .limit(limit)

      if (pillar) req = req.eq("pillar", pillar)

      const { data, error } = await req
      if (error) return { error: error.message }
      if (!data || data.length === 0) return { mensaje: `Sin resultados para "${query}" en el cerebro de Ann.` }
      return data.map((k: any) => ({ title: k.title, pillar: k.pillar, content: k.content }))
    }

    default:
      return { error: `Tool desconocida: ${name}` }
  }
}
