/**
 * Cron diario de recordatorios push a clientes (corre a la mañana, hora Miami).
 *  - 🏆 Monday Win: los lunes, a quien no cargó su win de la semana.
 *  - 📊 Reporte Mensual: fin de mes (últimos 3 días) y primeros 3 días del mes,
 *       a quien no cargó el reporte del mes correspondiente.
 *
 * Auth: Vercel Cron envía Authorization: Bearer ${CRON_SECRET}.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { sendPushToUsers } from "@/lib/push"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`
}

/** Partes de fecha en hora de Miami (America/New_York). */
function miamiNow() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]))
  const year  = Number(parts.year)
  const month = Number(parts.month)        // 1-12
  const day   = Number(parts.day)          // 1-31
  const weekday = parts.weekday            // "Mon", "Tue", ...
  // Último día del mes
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { year, month, day, weekday, lastDay }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sb = createServiceClient()
  const { year, month, day, weekday, lastDay } = miamiNow()
  const sent: Record<string, number> = {}

  // Clientes activos con cuenta (client_id + user_id para push)
  const { data: profiles } = await sb
    .from("profiles").select("id, client_id").eq("role", "client").not("client_id", "is", null)
  const clients = (profiles ?? []) as { id: string; client_id: string }[]
  if (clients.length === 0) return NextResponse.json({ ok: true, note: "sin clientes" })

  // ── 🏆 Monday Win (lunes) ────────────────────────────────────────────────
  if (weekday === "Mon") {
    // Inicio de la semana = hoy (lunes) a las 00:00
    const monday = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const { data: wins } = await sb
      .from("monday_wins").select("client_id").gte("fecha", monday)
    const cargaron = new Set((wins ?? []).map((w: any) => w.client_id))
    const faltan = clients.filter(c => !cargaron.has(c.client_id)).map(c => c.id)
    if (faltan.length) {
      await sendPushToUsers(sb, faltan, {
        title: "🏆 Cargá tu Monday Win",
        body:  "Arrancá la semana registrando tus logros y tu foco. Te toma 2 minutos.",
        url:   "/monday-win",
      })
      sent.monday_win = faltan.length
    }
  }

  // ── 📊 Reporte Mensual (fin de mes o primeros días) ──────────────────────
  const finDeMes   = day >= lastDay - 2          // últimos 3 días
  const inicioMes  = day <= 3                     // primeros 3 días
  if (finDeMes || inicioMes) {
    // Si es inicio de mes, recordamos el reporte del MES ANTERIOR; si es fin, el del mes en curso.
    const targetY = inicioMes ? (month === 1 ? year - 1 : year) : year
    const targetM = inicioMes ? (month === 1 ? 12 : month - 1) : month
    const monthKey = `${targetY}-${String(targetM).padStart(2, "0")}`

    const { data: reports } = await sb
      .from("monthly_reports").select("client_id, month")
    const cargaron = new Set(
      (reports ?? [])
        .filter((r: any) => String(r.month).slice(0, 7) === monthKey)
        .map((r: any) => r.client_id)
    )
    const faltan = clients.filter(c => !cargaron.has(c.client_id)).map(c => c.id)
    if (faltan.length) {
      const cuando = inicioMes ? "del mes pasado" : "de este mes"
      await sendPushToUsers(sb, faltan, {
        title: "📊 Te falta el Reporte Mensual",
        body:  `Todavía no cargaste el reporte ${cuando}. Cargalo para que Ann AI te dé el diagnóstico.`,
        url:   "/report-input",
      })
      sent.monthly_report = faltan.length
    }
  }

  return NextResponse.json({ ok: true, date: `${year}-${month}-${day}`, weekday, sent })
}
