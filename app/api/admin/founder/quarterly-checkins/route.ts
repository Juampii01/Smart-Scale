import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Check-in trimestral de dinero por cliente (sector Founder).
 * Base mínima: el equipo lo carga a mano después de hablar con el cliente —
 * todavía no es un flujo automatizado ni client-facing (eso quedó pendiente
 * de definir con Ann). Un registro por (client_id, quarter_label).
 */

/** GET — lista todos los check-ins, opcionalmente filtrado por client_id */
export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const clientId = req.nextUrl.searchParams.get("client_id")
  const sb = createServiceClient()

  let query = sb
    .from("client_quarterly_checkins")
    .select("id, client_id, quarter_label, best_month_cash, revenue_bracket, next_quarter_goal_cash, new_clients_needed, notes, created_at, updated_at")
    .order("quarter_label", { ascending: false })

  if (clientId) query = query.eq("client_id", clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Clientes para el selector del form — solo los activos en el CRM. La fila
  // de client_quarterly_checkins referencia clients(id), así que además hay
  // que cruzar contra el portal (mismo UUID entre crm_clients y clients,
  // como en admin/clients/route.ts) — algunos clientes activos en el CRM
  // todavía no tienen cuenta de portal y por ahora no van a poder elegirse acá.
  const [{ data: allClients }, { data: activeCrmClients }] = await Promise.all([
    sb.from("clients").select("id, name, nombre"),
    sb.from("crm_clients").select("id").eq("status", "activo"),
  ])
  const activeIds = new Set((activeCrmClients ?? []).map((c: any) => c.id))
  const nameById = new Map((allClients ?? []).map((c: any) => [c.id, c.nombre || c.name]))

  const checkins = (data ?? []).map((r: any) => ({ ...r, client_name: nameById.get(r.client_id) ?? "—" }))
  const clients = (allClients ?? [])
    .filter((c: any) => activeIds.has(c.id))
    .map((c: any) => ({ id: c.id, name: c.nombre || c.name || "(sin nombre)" }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name))
  return NextResponse.json({ checkins, clients })
}

/** POST — crea o actualiza el check-in de un cliente para un trimestre (upsert) */
export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { client_id, quarter_label } = body ?? {}
  if (!client_id || !quarter_label) {
    return NextResponse.json({ error: "client_id y quarter_label son requeridos" }, { status: 400 })
  }

  const toNum = (v: any) => (v === "" || v == null ? null : Number(v))
  const toInt = (v: any) => (v === "" || v == null ? null : Math.floor(Number(v)))

  const sb = createServiceClient()
  const { data, error } = await sb
    .from("client_quarterly_checkins")
    .upsert({
      client_id,
      quarter_label,
      best_month_cash:        toNum(body.best_month_cash),
      revenue_bracket:        toNum(body.revenue_bracket),
      next_quarter_goal_cash: toNum(body.next_quarter_goal_cash),
      new_clients_needed:     toInt(body.new_clients_needed),
      notes:                  body.notes || null,
      created_by:             user.id,
      updated_at:             new Date().toISOString(),
    }, { onConflict: "client_id,quarter_label" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ checkin: data })
}
