// ─── Zapier Webhook Integration ───────────────────────────────────────────────
// Fires outbound webhooks to Zapier "Catch Hook" triggers.
// Zapier then routes to Slack, Airtable CRM, or any other integration.
//
// Required env vars:
//   ZAPIER_WEBHOOK_REPORT   → fires when a monthly report is saved
//   ZAPIER_WEBHOOK_SALE     → fires when new_clients increases (optional — falls back to ZAPIER_WEBHOOK_REPORT)
//
// Zapier Zap setup:
//   Trigger: "Webhooks by Zapier → Catch Hook"
//   Actions: Slack message + Airtable create/update (use Zapier Paths for both)

export interface ZapierResult {
  ok: boolean
  error?: string
}

async function postWebhook(url: string, payload: Record<string, unknown>): Promise<ZapierResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return { ok: false, error: `Zapier returned ${res.status}: ${body}` }
    }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Unknown error" }
  }
}

// ─── Fire: monthly report completed ──────────────────────────────────────────

export async function zapierReportCompleted(payload: {
  event_type: "monthly_report.completed"
  client_id: string
  client_name?: string
  month: string
  triggered_by: string
  total_revenue?: number
  cash_collected?: number
  mrr?: number
  new_clients?: number
  ad_spend?: number
  short_followers?: number
  yt_subscribers?: number
  email_subscribers?: number
  scheduled_calls?: number
  attended_calls?: number
  biggest_win?: string
  next_focus?: string
  [key: string]: unknown
}): Promise<ZapierResult> {
  const url = process.env.ZAPIER_WEBHOOK_REPORT
  if (!url) return { ok: false, error: "ZAPIER_WEBHOOK_REPORT not configured" }
  return postWebhook(url, payload)
}

// ─── Fire: sale registered ────────────────────────────────────────────────────

export async function zapierSaleRegistered(payload: {
  event_type: "sale.registered"
  client_id: string
  client_name?: string
  month: string
  triggered_by: string
  new_clients: number
  total_revenue?: number
  [key: string]: unknown
}): Promise<ZapierResult> {
  // Use dedicated sale webhook if set, otherwise fall back to report webhook
  const url = process.env.ZAPIER_WEBHOOK_SALE ?? process.env.ZAPIER_WEBHOOK_REPORT
  if (!url) return { ok: false, error: "ZAPIER_WEBHOOK_SALE not configured" }
  return postWebhook(url, payload)
}
