/**
 * Cron diario de recordatorios a clientes (corre a la mañana, hora Miami).
 *  - 🏆 Monday Win: los lunes, a quien no cargó su win de la semana.
 *  - 📊 Reporte Mensual: fin de mes (últimos 3 días) y primeros 3 días del mes,
 *       a quien no cargó el reporte del mes correspondiente.
 *  - 👋 Inactividad: clientes con 7+ días sin loguearse, throttleado a 1 email
 *       por semana por cliente (profiles.last_inactivity_email_sent_at).
 *
 * Push + email para Monday Win y Reporte Mensual; solo email para inactividad
 * (no tiene sentido un push si el problema es justamente que no abre la app).
 *
 * Auth: Vercel Cron envía Authorization: Bearer ${CRON_SECRET}.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { sendPushToUsers } from "@/lib/push"
import { sendMondayWinReminderEmail, sendMonthlyReportReminderEmail, sendInactivityReminderEmail } from "@/lib/email"
import { getClientActivitySnapshot, miamiNow } from "@/lib/client-activity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const INACTIVITY_THRESHOLD_DAYS = 7

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sb = createServiceClient()
  const { year, month, day, weekday, lastDay } = miamiNow()
  const sent: Record<string, number> = {}

  const activity = await getClientActivitySnapshot(sb)
  if (activity.length === 0) return NextResponse.json({ ok: true, note: "sin clientes" })

  // ── 🏆 Monday Win (lunes) ────────────────────────────────────────────────
  if (weekday === "Mon") {
    const faltan = activity.filter(c => !c.mondayWinSubmitted)
    if (faltan.length) {
      await sendPushToUsers(sb, faltan.map(c => c.userId), {
        title: "🏆 Cargá tu Monday Win",
        body:  "Arrancá la semana registrando tus logros y tu foco. Te toma 2 minutos.",
        url:   "/monday-win",
      })
      await Promise.all(
        faltan
          .filter(c => c.email)
          .map(c => sendMondayWinReminderEmail({ name: c.name, email: c.email! }).catch(() => {}))
      )
      sent.monday_win = faltan.length
    }
  }

  // ── 📊 Reporte Mensual (fin de mes o primeros días) ──────────────────────
  const finDeMes  = day >= lastDay - 2          // últimos 3 días
  const inicioMes = day <= 3                     // primeros 3 días
  if (finDeMes || inicioMes) {
    const faltan = activity.filter(c => !c.monthlyReportSubmitted)
    if (faltan.length) {
      const cuando = inicioMes ? "del mes pasado" : "de este mes"
      await sendPushToUsers(sb, faltan.map(c => c.userId), {
        title: "📊 Te falta el Reporte Mensual",
        body:  `Todavía no cargaste el reporte ${cuando}. Cargalo para que Ann AI te dé el diagnóstico.`,
        url:   "/report-input",
      })
      await Promise.all(
        faltan
          .filter(c => c.email)
          .map(c => sendMonthlyReportReminderEmail({ name: c.name, email: c.email! }).catch(() => {}))
      )
      sent.monthly_report = faltan.length
    }
  }

  // ── 👋 Inactividad (7+ días sin loguearse, throttle 1/semana) ────────────
  const now = Date.now()
  const inactivos = activity.filter(c => {
    if (c.daysSinceLogin == null || c.daysSinceLogin < INACTIVITY_THRESHOLD_DAYS) return false
    if (!c.lastInactivityEmailSentAt) return true
    const daysSinceLastEmail = (now - new Date(c.lastInactivityEmailSentAt).getTime()) / 86_400_000
    return daysSinceLastEmail >= INACTIVITY_THRESHOLD_DAYS
  })
  if (inactivos.length) {
    const nowIso = new Date().toISOString()
    await Promise.all(
      inactivos
        .filter(c => c.email)
        .map(async c => {
          const result = await sendInactivityReminderEmail({ name: c.name, email: c.email!, daysSinceLogin: c.daysSinceLogin! }).catch(() => null)
          if (result?.ok) {
            await sb.from("profiles").update({ last_inactivity_email_sent_at: nowIso }).eq("id", c.userId)
          }
        })
    )
    sent.inactivity = inactivos.length
  }

  return NextResponse.json({ ok: true, date: `${year}-${month}-${day}`, weekday, sent })
}
