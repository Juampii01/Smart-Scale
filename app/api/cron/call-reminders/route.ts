/**
 * Cron de recordatorios de LLAMADAS (corre cada 5 minutos — requiere Vercel Pro).
 * Dos avisos por llamada del día:
 *   - 🌅 matutino: a partir de las 9:00 (Miami) avisa que hay llamada hoy.
 *   - ⏰ 5 minutos antes: avisa para entrar, con el link de Zoom.
 *
 * Evita duplicados con la tabla call_reminders_sent (UNIQUE event/fecha/tipo).
 * Auth: Vercel Cron envía Authorization: Bearer ${CRON_SECRET}.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { sendPushToUsers } from "@/lib/push"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MORNING_HOUR = 9       // hora (Miami) del aviso matutino
const LEAD_MIN = 6           // ventana del aviso "5 min antes" (1..6 min)
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`
}

/** Fecha/hora actual en Miami. */
function miamiNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", weekday: "long",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  )
  const date = `${parts.year}-${parts.month}-${parts.day}`
  const hour = Number(parts.hour === "24" ? "0" : parts.hour)
  const min  = Number(parts.minute)
  // weekday en español a partir del Date en Miami
  const d = new Date(`${date}T12:00:00`)
  const weekdayEs = DIAS[d.getUTCDay()]
  return { date, hour, min, weekdayEs, minutesOfDay: hour * 60 + min }
}

/** "3:00 PM" → minutos del día (15*60). null si no parsea. */
function parseTime(t: string): number | null {
  const m = String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!m) return null
  let h = Number(m[1]); const mm = Number(m[2]); const ap = m[3]?.toUpperCase()
  if (ap === "PM" && h < 12) h += 12
  if (ap === "AM" && h === 12) h = 0
  return h * 60 + mm
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sb = createServiceClient()
  const now = miamiNow()

  // Llamadas activas
  const { data: events } = await sb
    .from("calendar_events")
    .select("id, title, day_of_week, time, recurrence, next_date, zoom_url, status")
    .eq("status", "active")
  if (!events || events.length === 0) return NextResponse.json({ ok: true, note: "sin llamadas activas" })

  // ¿Cuáles son HOY?
  const todayCalls = events.filter((e: any) => {
    if (e.recurrence === "weekly") {
      return String(e.day_of_week ?? "").trim().toLowerCase() === now.weekdayEs
    }
    // biweekly / monthly → por next_date (el admin lo mantiene)
    return e.next_date && String(e.next_date).slice(0, 10) === now.date
  })
  if (todayCalls.length === 0) return NextResponse.json({ ok: true, date: now.date, note: "sin llamadas hoy" })

  // Clientes a notificar (todos los activos con cuenta)
  const { data: profiles } = await sb
    .from("profiles").select("id").eq("role", "client").not("client_id", "is", null)
  const userIds = (profiles ?? []).map((p: any) => p.id)
  if (userIds.length === 0) return NextResponse.json({ ok: true, note: "sin clientes" })

  const sent: string[] = []

  for (const e of todayCalls) {
    const startMin = parseTime(e.time)
    if (startMin == null) continue
    const minutesUntil = startMin - now.minutesOfDay
    const hhmm = e.time

    // ⏰ 5 minutos antes
    if (minutesUntil >= 1 && minutesUntil <= LEAD_MIN) {
      if (await claim(sb, e.id, now.date, "5min")) {
        await sendPushToUsers(sb, userIds, {
          title: `⏰ ${e.title} empieza en breve`,
          body:  "Entrá ahora a la llamada 👇",
          url:   e.zoom_url || "/calendar",
        })
        sent.push(`5min:${e.title}`)
      }
    }

    // 🌅 matutino (desde las 9, si la llamada todavía no pasó)
    if (now.hour >= MORNING_HOUR && minutesUntil > LEAD_MIN) {
      if (await claim(sb, e.id, now.date, "morning")) {
        await sendPushToUsers(sb, userIds, {
          title: `📞 Hoy: ${e.title}`,
          body:  `Hoy a las ${hhmm} (Miami). Te esperamos en la llamada.`,
          url:   e.zoom_url || "/calendar",
        })
        sent.push(`morning:${e.title}`)
      }
    }
  }

  return NextResponse.json({ ok: true, date: now.date, weekday: now.weekdayEs, sent })
}

/** Reserva atómica del aviso: true si lo tomamos (no enviado antes). */
async function claim(sb: ReturnType<typeof createServiceClient>, eventId: string, date: string, kind: string): Promise<boolean> {
  const { error } = await sb
    .from("call_reminders_sent")
    .insert({ event_id: eventId, call_date: date, kind })
  return !error // si hay conflicto UNIQUE → ya se envió → false
}
