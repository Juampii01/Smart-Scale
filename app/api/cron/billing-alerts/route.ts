/**
 * Cron diario para suscripciones mensuales:
 *  1. Genera la siguiente cuota cuando la última está paga.
 *  2. Manda alerta a Slack 5 días antes del vencimiento (una vez por cuota).
 *
 * Auth: Vercel Cron envía `Authorization: Bearer ${CRON_SECRET}` automáticamente
 * cuando configuramos `crons` en vercel.json + ENV var CRON_SECRET.
 *
 * También se puede invocar manualmente con el mismo header desde un terminal,
 * útil para testear.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { sendSlackMessage } from "@/lib/slack"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const ALERT_DAYS_BEFORE = 5

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayUTC(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + (dateStr.length === 10 ? "T12:00:00Z" : ""))
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

function daysBetween(fromIsoDate: string, to: Date): number {
  const f = new Date(fromIsoDate + "T12:00:00Z")
  f.setUTCHours(0, 0, 0, 0)
  return Math.round((f.getTime() - to.getTime()) / (1000 * 60 * 60 * 24))
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n)
}

function fmtDateAR(iso: string) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = req.headers.get("authorization") ?? ""
  return auth === `Bearer ${expected}`
}

// ─── Main handler ────────────────────────────────────────────────────────────

async function runBillingAlerts() {
  const supabase = createServiceClient()
  const today    = todayUTC()
  const todayStr = today.toISOString().slice(0, 10)

  const result = {
    clientsScanned: 0,
    installmentsCreated: 0,
    alertsSent: 0,
    errors: [] as string[],
  }

  // 1. Cargar todos los clientes con plan mensual activo
  const { data: clients, error: clientsErr } = await supabase
    .from("crm_clients")
    .select("id, name, installment_amount, status, is_monthly_subscription, program_start")
    .eq("is_monthly_subscription", true)
    .eq("status", "activo")

  if (clientsErr) {
    result.errors.push(`Error cargando clientes: ${clientsErr.message}`)
    return result
  }

  result.clientsScanned = clients?.length ?? 0

  for (const client of clients ?? []) {
    try {
      // 2. Última cuota del cliente
      const { data: installments } = await supabase
        .from("crm_installments")
        .select("id, due_date, amount, paid_at, alert_sent_at")
        .eq("client_id", client.id)
        .order("due_date", { ascending: false })

      const list = installments ?? []
      const latest = list[0] ?? null
      const amount = client.installment_amount ?? 0

      // 3. Generar próxima cuota si la última está paga (y no hay otra futura)
      if (latest && latest.paid_at) {
        const hasFuture = list.some(i => !i.paid_at && i.due_date >= todayStr)
        if (!hasFuture) {
          const nextDue = addMonths(latest.due_date, 1)
          const { error: insErr } = await supabase.from("crm_installments").insert({
            client_id: client.id,
            installment_number: list.length + 1,
            due_date: nextDue,
            amount,
            paid_at: null,
          })
          if (insErr) {
            result.errors.push(`[${client.name}] insert error: ${insErr.message}`)
          } else {
            result.installmentsCreated++
          }
        }
      } else if (!latest) {
        // 3b. Sin cuotas: generar la primera con due_date = program_start o hoy
        const firstDue = client.program_start && client.program_start >= todayStr
          ? client.program_start
          : todayStr
        const { error: insErr } = await supabase.from("crm_installments").insert({
          client_id: client.id,
          installment_number: 1,
          due_date: firstDue,
          amount,
          paid_at: null,
        })
        if (insErr) {
          result.errors.push(`[${client.name}] first insert error: ${insErr.message}`)
        } else {
          result.installmentsCreated++
        }
      }

      // 4. Alertas de Slack para cuotas pendientes próximas a vencer
      const { data: pending } = await supabase
        .from("crm_installments")
        .select("id, due_date, amount, alert_sent_at")
        .eq("client_id", client.id)
        .is("paid_at", null)
        .is("alert_sent_at", null)

      for (const cuota of pending ?? []) {
        const daysUntil = daysBetween(cuota.due_date, today)
        if (daysUntil < 0 || daysUntil > ALERT_DAYS_BEFORE) continue

        const dayLabel = daysUntil === 0 ? "hoy" : daysUntil === 1 ? "mañana" : `en ${daysUntil} días`

        const blocks = [
          {
            type: "header",
            text: { type: "plain_text", text: `⏰ Cobro mensual ${dayLabel}`, emoji: true },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Cliente:*\n${client.name}` },
              { type: "mrkdwn", text: `*Monto:*\n${fmtMoney(cuota.amount ?? amount ?? 0)}` },
              { type: "mrkdwn", text: `*Vence:*\n${fmtDateAR(cuota.due_date)}` },
              { type: "mrkdwn", text: `*Días restantes:*\n${daysUntil === 0 ? "Hoy" : daysUntil}` },
            ],
          },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: "Plan mensual auto-renovable · Smart Scale Internal" },
            ],
          },
        ]

        const fallback = `⏰ ${client.name} — cobro de ${fmtMoney(cuota.amount ?? amount ?? 0)} ${dayLabel} (${fmtDateAR(cuota.due_date)})`
        const slackResult = await sendSlackMessage(blocks, fallback)

        if (slackResult.ok) {
          await supabase
            .from("crm_installments")
            .update({ alert_sent_at: new Date().toISOString() })
            .eq("id", cuota.id)
          result.alertsSent++
        } else {
          result.errors.push(`[${client.name}] slack error: ${slackResult.reason ?? "unknown"}`)
        }
      }
    } catch (err: any) {
      result.errors.push(`[${client.name}] ${err?.message ?? "unknown"}`)
    }
  }

  return result
}

// ─── GET (Vercel Cron) ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await runBillingAlerts()
  return NextResponse.json(result)
}

// ─── POST (manual trigger por admin con misma auth) ──────────────────────────

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await runBillingAlerts()
  return NextResponse.json(result)
}
