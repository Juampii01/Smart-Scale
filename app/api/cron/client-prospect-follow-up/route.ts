/**
 * Cron diario: revisa los prospectos propios de cada cliente (Paso 2 del
 * roadmap multi-tenant) cuya fecha de "próximo seguimiento"
 * (client_prospects.next_follow_up_at) llegó o ya pasó, y le manda un push
 * al cliente — una sola vez por fecha cargada.
 *
 * Mismo criterio de dedup que app/api/cron/lead-follow-up (el equivalente
 * interno): follow_up_alert_sent_at, que se resetea a null cada vez que se
 * carga una fecha nueva (ver PATCH en app/api/client/prospects/route.ts).
 * A diferencia de ese cron, acá no hay Zapier/Slack de por medio — el canal
 * es push notification al propio cliente (lib/push.ts).
 *
 * Auth: Vercel Cron envía `Authorization: Bearer ${CRON_SECRET}` (mismo
 * patrón que el resto de los crons). También se puede invocar a mano con
 * el mismo header para testear.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { logJobRun } from "@/lib/system-log"
import { sendPushToUsers } from "@/lib/push"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = req.headers.get("authorization") ?? ""
  return auth === `Bearer ${expected}`
}

async function runClientProspectFollowUp() {
  const supabase = createServiceClient()
  const todayStr = new Date().toISOString().slice(0, 10)

  const result = { prospectsScanned: 0, alertsSent: 0, errors: [] as string[] }

  const { data: prospects, error } = await supabase
    .from("client_prospects")
    .select("id, client_id, name, next_follow_up_at")
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", todayStr)
    .is("follow_up_alert_sent_at", null)
    .eq("purchased", false)
    .neq("status", "perdimos")

  if (error) {
    await logJobRun(supabase, "client-prospect-follow-up", "error", error.message)
    return { ...result, errors: [error.message] }
  }

  for (const prospect of prospects ?? []) {
    result.prospectsScanned++
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("client_id", prospect.client_id)
        .eq("role", "client")
      const userIds = (profiles ?? []).map((p: any) => p.id)

      // sendPushToUsers no devuelve éxito/fracaso (lib/push.ts atrapa los
      // errores por suscripción internamente, es fire-and-forget) — a
      // diferencia de zapierLeadFollowUpDue acá no hay una señal de "se
      // mandó bien" para condicionar el marcado. Se marca apenas se
      // intenta, mismo criterio que ya usa call-reminders (reserva antes
      // de enviar, no espera confirmación de entrega por dispositivo).
      if (userIds.length > 0) {
        await sendPushToUsers(supabase, userIds, {
          title: "⏰ Seguimiento pendiente",
          body:  `${prospect.name ?? "Un prospecto"} — tenías un seguimiento agendado para hoy`,
          url:   "/pipeline",
        })
      }
      await supabase
        .from("client_prospects")
        .update({ follow_up_alert_sent_at: new Date().toISOString() })
        .eq("id", prospect.id)
      result.alertsSent++
    } catch (err: any) {
      result.errors.push(`[${prospect.name ?? prospect.id}] ${err?.message ?? "unknown"}`)
    }
  }

  await logJobRun(
    supabase,
    "client-prospect-follow-up",
    result.errors.length > 0 ? "error" : "ok",
    JSON.stringify(result),
  )

  return result
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const result = await runClientProspectFollowUp()
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const result = await runClientProspectFollowUp()
  return NextResponse.json(result)
}
