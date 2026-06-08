// ─── Zapier Webhook Integration ───────────────────────────────────────────────
// Fires outbound webhooks to Zapier "Catch Hook" triggers.
// Zapier routes a Slack message (y cualquier otra integración configurada).
//
// Required env vars:
//   ZAPIER_WEBHOOK_REPORT   → fires when a monthly report is saved
//   ZAPIER_WEBHOOK_SALE     → fires when new_clients increases (optional — falls back to ZAPIER_WEBHOOK_REPORT)
//   ZAPIER_WEBHOOK_EOD      → fires when a setter submits an EOD
//
// Zapier Zap setup:
//   Trigger: "Webhooks by Zapier → Catch Hook"
//   Actions: Slack message

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

// ─── Fire: client onboarded ──────────────────────────────────────────────────

export async function zapierClientOnboarded(payload: {
  event_type:       string
  client_id:        string
  client_name:      string
  email:            string
  phone?:           string | null
  instagram?:       string | null
  program?:         string | null
  total_amount:     number
  cuotas?:          Record<string, number | null>
  program_start:    string
  program_duration?: number
  setter_name?:     string | null
  temp_password?:   string | null
  magic_link?:      string | null
}): Promise<ZapierResult> {
  const url = process.env.ZAPIER_WEBHOOK_ONBOARDING
  if (!url) return { ok: false, error: "ZAPIER_WEBHOOK_ONBOARDING not configured" }

  // Aplanar cuotas como campos top-level (cuota_1, cuota_2, ...)
  // Zapier no procesa bien objetos anidados — los convierte a "cuotas__cuota_1"
  const cuotasFlat: Record<string, number | string> = {}
  if (payload.cuotas) {
    for (const [k, v] of Object.entries(payload.cuotas)) {
      if (v != null) cuotasFlat[k] = v
    }
  }

  const flat = {
    event_type:       payload.event_type,
    client_id:        payload.client_id,
    client_name:      payload.client_name,
    email:            payload.email,
    phone:            payload.phone            ?? "",
    instagram:        payload.instagram        ?? "",
    program:          payload.program          ?? "",
    total_amount:     payload.total_amount,
    program_start:    payload.program_start,
    program_duration: payload.program_duration ?? "",
    setter_name:      payload.setter_name      ?? "",
    temp_password:    payload.temp_password    ?? "",
    magic_link:       payload.magic_link       ?? "",
    ...cuotasFlat,   // cuota_1, cuota_2, ... como campos raíz
  }

  console.log("Zapier onboarding payload:", JSON.stringify(flat))
  return postWebhook(url, flat)
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

// ─── Fire: EOD submitted ──────────────────────────────────────────────────────

export async function zapierEODSubmitted(payload: {
  event_type:                  "eod.submitted"
  setter_id:                   string
  setter_name:                 string
  date:                        string          // YYYY-MM-DD
  new_conversations_inbound:   number
  new_conversations_outbound:  number
  outbound_replies:            number
  qualified_leads:             number
  offer_docs_sent:             number
  offer_doc_responses:         number
  calls_done:                  number
  inbound_applications:        number
  notes:                       string
}): Promise<ZapierResult> {
  const url = process.env.ZAPIER_WEBHOOK_EOD
  if (!url) return { ok: false, error: "ZAPIER_WEBHOOK_EOD not configured" }

  // Pre-format a Slack-ready message so the Zap just uses {{message}}
  // without needing to map individual numeric fields.
  const [year, month, day] = payload.date.split("-")
  const dateLabel = `${day}/${month}/${year}`

  const lines = [
    `📊 *EOD de ${payload.setter_name}* — ${dateLabel}`,
    ``,
    `🔵 *Inbound*`,
    `  • Conversaciones recibidas: *${payload.new_conversations_inbound}*`,
    `  • Aplicaciones inbound: *${payload.inbound_applications}*`,
    ``,
    `🟣 *Outbound*`,
    `  • Leads contactados: *${payload.new_conversations_outbound}*`,
    `  • Respuestas obtenidas: *${payload.outbound_replies}*`,
    ``,
    `🟡 *Conversión*`,
    `  • Leads 4-5 ⭐: *${payload.qualified_leads}*`,
    `  • Offer docs enviados: *${payload.offer_docs_sent}*`,
    `  • Respuestas a offer doc: *${payload.offer_doc_responses}*`,
    `  • Llamadas completadas: *${payload.calls_done}*`,
  ]

  if (payload.notes) {
    lines.push(``, `📝 *Notas:* ${payload.notes}`)
  }

  const message = lines.join("\n")

  return postWebhook(url, { ...payload, message })
}

// ─── Fire: task events (Kanban) ───────────────────────────────────────────────
// Un solo webhook para todos los eventos del tablero de tareas.
//   ZAPIER_WEBHOOK_TAREAS → catch hook que postea a Slack usando {{message}}

const COLUMN_LABELS: Record<string, string> = {
  "por-hacer":  "Por hacer",
  "en-proceso": "En proceso",
  "listo":      "Listo",
}

/** "2026-06-11" → "11 de junio" */
function formatDueDateEs(iso?: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso.slice(0, 10) + "T00:00:00")
  if (isNaN(d.getTime())) return null
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
  return `${d.getDate()} de ${meses[d.getMonth()]}`
}

export type TaskEventType =
  | "task.created"
  | "task.moved"
  | "task.completed"
  | "task.assigned"

export async function zapierTaskEvent(payload: {
  event_type:   TaskEventType
  task_id:      string
  title:        string
  triggered_by: string                // quién hizo la acción (email)
  assigned_to?: string | null
  from_column?: string | null         // para task.moved
  to_column?:   string | null         // para task.moved / completed / created
  label?:       string | null         // etiqueta (ej "Urgente")
  due_date?:    string | null         // ISO
}): Promise<ZapierResult> {
  const url = process.env.ZAPIER_WEBHOOK_TAREAS
  if (!url) return { ok: false, error: "ZAPIER_WEBHOOK_TAREAS not configured" }

  const isUrgent = (payload.label ?? "").toLowerCase() === "urgente"
  const dueLabel = formatDueDateEs(payload.due_date)
  const toCol    = payload.to_column   ? (COLUMN_LABELS[payload.to_column]   ?? payload.to_column)   : null
  const fromCol  = payload.from_column ? (COLUMN_LABELS[payload.from_column] ?? payload.from_column) : null

  let message = ""
  switch (payload.event_type) {
    case "task.created":
      message = `🆕 Nueva tarea: *${payload.title}*`
      if (payload.assigned_to) message += `\n👤 Asignada a *${payload.assigned_to}*`
      if (isUrgent)            message += `\n🔴 *URGENTE*`
      if (dueLabel)            message += `\n📅 Para el ${dueLabel}`
      break

    case "task.moved":
      message = `🔀 *${payload.title}* se movió${fromCol ? ` de *${fromCol}*` : ""} a *${toCol}*`
      if (payload.assigned_to) message += ` · ${payload.assigned_to}`
      break

    case "task.completed":
      message = `✅ Tarea completada: *${payload.title}*`
      if (payload.assigned_to) message += ` por *${payload.assigned_to}*`
      break

    case "task.assigned":
      message = `👤 Se le asignó una tarea${isUrgent ? " *urgente*" : ""} a *${payload.assigned_to}*: *${payload.title}*`
      if (dueLabel) message += `\n📅 Para el ${dueLabel}`
      break
  }

  return postWebhook(url, { ...payload, message })
}
