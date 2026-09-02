import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET — sección "Destrabes" de /admin/posi: historial de posi_unlock_events
 *  más el diagnóstico de configuración incompleta (niveles sin curso de
 *  Skool, clientes activos sin skool_email). No hay API de lectura de
 *  Skool — esto es lo único con lo que se puede auditar el destrabe, así
 *  que también sirve para que el primer aviso de que algo está mal no sea
 *  un cliente quejándose. Admin-only: acá se ve skool_email por fila. */
export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = createServiceClient()

  const [eventsRes, levelsRes, activeClientProfilesRes] = await Promise.all([
    supabase
      .from("posi_unlock_events")
      .select(
        "id, client_id, submission_id, approved_level_id, unlock_level_id, skool_course_name, skool_email, status, reason, auto_approved, created_at, updated_at, clients(name, nombre)"
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("posi_levels")
      .select("id, level_number, title, skool_course_name")
      .order("level_number", { ascending: true }),
    supabase.from("profiles").select("client_id").eq("role", "client").eq("active", true),
  ])

  if (eventsRes.error) return NextResponse.json({ error: eventsRes.error.message }, { status: 500 })
  if (levelsRes.error) return NextResponse.json({ error: levelsRes.error.message }, { status: 500 })
  if (activeClientProfilesRes.error) return NextResponse.json({ error: activeClientProfilesRes.error.message }, { status: 500 })

  const levels = levelsRes.data ?? []
  const levelsById = new Map(levels.map((l: any) => [l.id, l]))

  const events = (eventsRes.data ?? []).map((e: any) => ({
    ...e,
    client_name: e.clients?.nombre || e.clients?.name || "—",
    clients: undefined,
    approved_level: levelsById.get(e.approved_level_id) ?? null,
    unlock_level: e.unlock_level_id ? (levelsById.get(e.unlock_level_id) ?? null) : null,
  }))

  // ── Niveles sin curso configurado ────────────────────────────────────────
  // Cualquier nivel salvo el primero es potencialmente el "nivel siguiente"
  // de otro — si le falta skool_course_name, nadie que apruebe el anterior
  // va a recibir el destrabe.
  const minLevelNumber = levels.length ? Math.min(...levels.map((l: any) => l.level_number)) : null
  const missingCourseLevels = levels
    .filter((l: any) => l.level_number !== minLevelNumber && !l.skool_course_name)
    .map((l: any) => ({ id: l.id, level_number: l.level_number, title: l.title }))

  // ── Clientes activos sin skool_email ─────────────────────────────────────
  const activeClientIds = Array.from(
    new Set((activeClientProfilesRes.data ?? []).map((p: any) => p.client_id).filter(Boolean))
  )
  let clientsWithoutEmail: { id: string; name: string }[] = []
  if (activeClientIds.length) {
    const { data: clientsData, error: clientsErr } = await supabase
      .from("clients")
      .select("id, name, nombre, skool_email")
      .in("id", activeClientIds)
    if (clientsErr) return NextResponse.json({ error: clientsErr.message }, { status: 500 })
    clientsWithoutEmail = (clientsData ?? [])
      .filter((c: any) => !c.skool_email)
      .map((c: any) => ({ id: c.id, name: c.nombre || c.name || "—" }))
  }

  return NextResponse.json({
    events,
    diagnostics: { missingCourseLevels, clientsWithoutEmail },
  })
}
