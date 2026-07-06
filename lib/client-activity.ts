/**
 * Snapshot de actividad de clientes — último login + estado de Monday Win /
 * reporte mensual del período actual. Fuente única usada tanto por el cron
 * de recordatorios (app/api/cron/reminders) como por el panel de admin
 * (/admin/actividad-clientes), para no duplicar las queries de "quién falta".
 */
import { createServiceClient } from "@/lib/supabase-service"

type SB = ReturnType<typeof createServiceClient>

export interface ClientActivity {
  clientId:                  string
  userId:                    string
  name:                      string
  email:                     string | null
  lastSignInAt:              string | null
  daysSinceLogin:            number | null
  mondayWinSubmitted:        boolean
  monthlyReportSubmitted:    boolean
  lastInactivityEmailSentAt: string | null
}

/** Partes de fecha en hora de Miami (America/New_York). */
export function miamiNow() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]))
  const year  = Number(parts.year)
  const month = Number(parts.month)        // 1-12
  const day   = Number(parts.day)          // 1-31
  const weekday = parts.weekday            // "Mon", "Tue", ...
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { year, month, day, weekday, lastDay }
}

const WEEKDAY_OFFSET: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

/** Fecha ISO (YYYY-MM-DD) del lunes de la semana en curso, en hora de Miami. */
function mostRecentMonday(year: number, month: number, day: number, weekday: string): string {
  const d = new Date(Date.UTC(year, month - 1, day, 12))
  d.setUTCDate(d.getUTCDate() - (WEEKDAY_OFFSET[weekday] ?? 0))
  return d.toISOString().slice(0, 10)
}

export async function getClientActivitySnapshot(sb: SB): Promise<ClientActivity[]> {
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, client_id, name, last_inactivity_email_sent_at")
    .eq("role", "client")
    .not("client_id", "is", null)

  const rows = (profiles ?? []) as { id: string; client_id: string; name: string | null; last_inactivity_email_sent_at: string | null }[]
  if (rows.length === 0) return []

  // Último login + email — vía Admin API. Con el tamaño actual de la base
  // (decenas de clientes) una sola página alcanza sin necesidad de paginar.
  const { data: usersPage } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const usersById = new Map((usersPage?.users ?? []).map(u => [u.id, u]))

  const { year, month, day, weekday } = miamiNow()

  const monday = mostRecentMonday(year, month, day, weekday)
  const { data: wins } = await sb.from("monday_wins").select("client_id").gte("fecha", monday)
  const wonSet = new Set((wins ?? []).map((w: any) => w.client_id))

  const monthKey = `${year}-${String(month).padStart(2, "0")}`
  const { data: reports } = await sb.from("monthly_reports").select("client_id, month")
  const reportedSet = new Set(
    (reports ?? [])
      .filter((r: any) => String(r.month).slice(0, 7) === monthKey)
      .map((r: any) => r.client_id)
  )

  return rows.filter(p => {
    // Excluir clientes offboardeados (login baneado) — ya no tiene sentido
    // pedirles que carguen el Monday Win o el reporte, ni avisarles que hace
    // rato no entran: no van a poder volver a entrar nunca.
    const bannedUntil = (usersById.get(p.id) as any)?.banned_until
    return !bannedUntil || new Date(bannedUntil) <= new Date()
  }).map(p => {
    const authUser = usersById.get(p.id)
    const lastSignInAt = authUser?.last_sign_in_at ?? null
    const daysSinceLogin = lastSignInAt
      ? Math.floor((Date.now() - new Date(lastSignInAt).getTime()) / 86_400_000)
      : null

    return {
      clientId:                  p.client_id,
      userId:                    p.id,
      name:                      p.name ?? "—",
      email:                     authUser?.email ?? null,
      lastSignInAt,
      daysSinceLogin,
      mondayWinSubmitted:        wonSet.has(p.client_id),
      monthlyReportSubmitted:    reportedSet.has(p.client_id),
      lastInactivityEmailSentAt: p.last_inactivity_email_sent_at,
    }
  })
}
