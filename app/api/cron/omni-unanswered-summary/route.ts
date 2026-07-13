/**
 * Cron nocturno de Omni — resumen de conversaciones sin responder, todas las
 * noches a las 19:00 hora de Miami (horario de verano). Vercel Cron usa UTC
 * fijo sin ajuste de horario de verano, así que en horario de invierno esto
 * corre a las 18:00 en vez de 19:00 — mismo criterio que el resto de los
 * crons de este repo (billing-alerts, reminders), que tampoco ajustan DST.
 *
 * No usa IA (lib/omni/unanswered-summary.ts es puro cálculo). Guarda el
 * resultado en omni_daily_briefings (type='unanswered') y avisa por push a
 * Juampi y Ann.
 *
 * Auth: mismo patrón que /api/cron/billing-alerts — `Authorization: Bearer
 * ${CRON_SECRET}`.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { sendPushToNames } from "@/lib/push"
import { getUnansweredSummary } from "@/lib/omni/unanswered-summary"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = req.headers.get("authorization") ?? ""
  return auth === `Bearer ${expected}`
}

async function runUnansweredSummary() {
  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const summary = await getUnansweredSummary(sb)
  const totalUnanswered = summary.instagram.length + summary.slack.length

  const { error: upsertError } = await sb.from("omni_daily_briefings").upsert({
    date:              today,
    type:              "unanswered",
    findings:          summary,
    messages_analyzed: totalUnanswered,
  }, { onConflict: "date,type" })

  if (upsertError) {
    console.error("[cron/omni-unanswered-summary] upsert error:", upsertError.message)
    return { ok: false, error: upsertError.message }
  }

  const title = "🌙 Ann AI — Conversaciones sin responder"
  const body = totalUnanswered === 0
    ? "Todo respondido — nada pendiente hoy."
    : `${summary.instagram.length} en Instagram, ${summary.slack.length} en Slack sin responder.`

  await sendPushToNames(sb, ["Juampi", "Ann"], { title, body, url: "/admin/omni" }).catch(() => {})

  return { ok: true, instagram: summary.instagram.length, slack: summary.slack.length }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const result = await runUnansweredSummary()
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const result = await runUnansweredSummary()
  return NextResponse.json(result)
}
