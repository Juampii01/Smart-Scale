/**
 * Cron diario: revisa los leads del pipeline cuya fecha de "próximo
 * seguimiento" (leads.next_follow_up_at) llegó o ya pasó, y le avisa a
 * Zapier (que postea a Slack) — una sola vez por fecha cargada.
 *
 * Evita duplicados con follow_up_alert_sent_at (se resetea a null cada vez
 * que se carga una fecha nueva, ver PATCH en app/api/admin/leads/route.ts).
 *
 * Auth: Vercel Cron envía `Authorization: Bearer ${CRON_SECRET}` (mismo
 * patrón que app/api/cron/billing-alerts). También se puede invocar a mano
 * con el mismo header para testear.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { logJobRun } from "@/lib/system-log"
import { zapierLeadFollowUpDue } from "@/lib/zapier"
import { PIPELINE_STAGE_LABELS } from "@/components/leads-pipeline/constants"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = req.headers.get("authorization") ?? ""
  return auth === `Bearer ${expected}`
}

function daysOverdue(dateStr: string, todayStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z")
  const t = new Date(todayStr + "T00:00:00Z")
  return Math.max(0, Math.round((t.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)))
}

async function runLeadFollowUp() {
  const supabase = createServiceClient()
  const todayStr = new Date().toISOString().slice(0, 10)

  const result = { leadsScanned: 0, alertsSent: 0, errors: [] as string[] }

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, instagram, rating, status, purchased, deal_value, next_follow_up_at")
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", todayStr)
    .is("follow_up_alert_sent_at", null)
    .eq("purchased", false)
    .neq("status", "perdimos")

  if (error) {
    await logJobRun(supabase, "lead-follow-up", "error", error.message)
    return { ...result, errors: [error.message] }
  }

  for (const lead of leads ?? []) {
    result.leadsScanned++
    try {
      const stageLabel = (lead.status && PIPELINE_STAGE_LABELS[lead.status as keyof typeof PIPELINE_STAGE_LABELS]) || "Calificado"
      const res = await zapierLeadFollowUpDue({
        event_type:        "lead.follow_up_due",
        lead_id:            lead.id,
        lead_name:          lead.name ?? "Lead sin nombre",
        instagram:          lead.instagram,
        rating:             lead.rating,
        stage_label:        stageLabel,
        deal_value:         lead.deal_value,
        next_follow_up_at:  lead.next_follow_up_at,
        days_overdue:       daysOverdue(lead.next_follow_up_at, todayStr),
      })
      if (res.ok) {
        await supabase.from("leads").update({ follow_up_alert_sent_at: new Date().toISOString() }).eq("id", lead.id)
        result.alertsSent++
      } else {
        result.errors.push(`[${lead.name ?? lead.id}] ${res.error ?? "zapier error"}`)
      }
    } catch (err: any) {
      result.errors.push(`[${lead.name ?? lead.id}] ${err?.message ?? "unknown"}`)
    }
  }

  await logJobRun(
    supabase,
    "lead-follow-up",
    result.errors.length > 0 ? "error" : "ok",
    JSON.stringify(result),
  )

  return result
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const result = await runLeadFollowUp()
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const result = await runLeadFollowUp()
  return NextResponse.json(result)
}
