// ─── Zapier Webhook Integration ───────────────────────────────────────────────
// Fires outbound webhooks to Zapier "Catch Hook" triggers.
// Zapier routes a Slack message (y cualquier otra integración configurada).
//
// Required env vars:
//   ZAPIER_WEBHOOK_REPORT             → fires when a monthly report is saved
//   ZAPIER_WEBHOOK_SALE               → fires when new_clients increases (optional — falls back to ZAPIER_WEBHOOK_REPORT)
//   ZAPIER_WEBHOOK_EOD                → fires when a setter submits an EOD
//   ZAPIER_WEBHOOK_ONBOARDING_STATUS  → fires on cada cambio de estado del onboarding
//                                        (contrato firmado, accesos enviados) — separado
//                                        de ZAPIER_WEBHOOK_ONBOARDING, que solo dispara
//                                        una vez al crear el cliente.
//   ZAPIER_WEBHOOK_LEAD_FOLLOWUP      → fires cuando llega (o se venció) la fecha de
//                                        "próximo seguimiento" de un lead en el pipeline
//                                        (disparado por app/api/cron/lead-follow-up)
//   ZAPIER_WEBHOOK_CLIENT_CALL        → fires cuando llega una llamada de Zoom nueva
//                                        vía app/api/webhooks/client-call
//   ZAPIER_WEBHOOK_POSI               → fires cuando un cliente completa un nivel
//                                        del formulario POSI (app/api/posi/submissions)
//
// Zapier Zap setup:
//   Trigger: "Webhooks by Zapier → Catch Hook"
//   Actions: Slack message

import { resolveTeamName } from "@/lib/team"
import { createServiceClient } from "@/lib/supabase-service"
import { logJobRun } from "@/lib/system-log"

export interface ZapierResult {
  ok: boolean
  error?: string
}

// jobName identifica cada función exportada de este archivo para el panel
// "Estado del Sistema" (/admin/omni) — así se ve, por función, cuándo disparó
// por última vez y si falló. Las que nunca se llaman (código muerto) van a
// mostrar naturalmente "nunca corrió" sin ninguna lógica extra.
async function postWebhook(url: string, payload: Record<string, unknown>, jobName: string): Promise<ZapierResult> {
  const sb = createServiceClient()
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const error = `Zapier returned ${res.status}: ${body}`
      await logJobRun(sb, `zapier:${jobName}`, "error", error)
      return { ok: false, error }
    }
    await logJobRun(sb, `zapier:${jobName}`, "ok")
    return { ok: true }
  } catch (err: any) {
    const error = err?.message ?? "Unknown error"
    await logJobRun(sb, `zapier:${jobName}`, "error", error)
    return { ok: false, error }
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
  return postWebhook(url, payload, "zapierReportCompleted")
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
  return postWebhook(url, flat, "zapierClientOnboarded")
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
  return postWebhook(url, payload, "zapierSaleRegistered")
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
  inbound_qualified:           number
  outbound_qualified:          number
  offer_docs_sent:             number
  offer_doc_responses:         number
  calls_done:                  number
  inbound_applications:        number
  cierres:                     number
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
    `  • Cierres: *${payload.cierres}*`,
  ]

  if (payload.notes) {
    lines.push(``, `📝 *Notas:* ${payload.notes}`)
  }

  const message = lines.join("\n")

  return postWebhook(url, { ...payload, message }, "zapierEODSubmitted")
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

/** Resuelve el nombre de quien ejecutó la acción a partir de su email/id. */
const prettyActor = (idOrEmail?: string): string | null => resolveTeamName(idOrEmail)

export type TaskEventType =
  | "task.created"
  | "task.moved"
  | "task.completed"
  | "task.assigned"
  | "task.review"

const PRIORITY_META: Record<string, { dot: string; label: string }> = {
  "urgente":    { dot: "🔴", label: "Urgente" },
  "importante": { dot: "🟡", label: "Importante" },
  "con-tiempo": { dot: "🟢", label: "Con tiempo" },
}

export async function zapierTaskEvent(payload: {
  event_type:   TaskEventType
  task_id:      string
  title:        string
  triggered_by: string                // quién hizo la acción (email)
  assigned_to?: string | null
  from_column?: string | null         // para task.moved
  to_column?:   string | null         // para task.moved / completed / created
  label?:       string | null         // etiqueta descriptiva (texto libre)
  priority?:    string | null         // urgente | importante | con-tiempo
  due_date?:    string | null         // ISO
}): Promise<ZapierResult> {
  const url = process.env.ZAPIER_WEBHOOK_TAREAS
  if (!url) return { ok: false, error: "ZAPIER_WEBHOOK_TAREAS not configured" }

  const isUrgent = payload.priority === "urgente"
  const dueLabel = formatDueDateEs(payload.due_date)
  const toCol    = payload.to_column   ? (COLUMN_LABELS[payload.to_column]   ?? payload.to_column)   : null
  const fromCol  = payload.from_column ? (COLUMN_LABELS[payload.from_column] ?? payload.from_column) : null

  // Etiqueta descriptiva (texto libre que puso quien la creó)
  const labelTxt = payload.label && payload.label.trim() ? payload.label.trim() : null
  const showLabel = labelTxt ? `🏷 ${labelTxt}` : null
  // Prioridad visible (salvo urgente, que tiene banner propio)
  const prio = payload.priority ? PRIORITY_META[payload.priority] : null
  const showPriority = prio && payload.priority !== "urgente" ? `${prio.dot} ${prio.label}` : null

  // Línea de metadatos: solo incluye lo que existe, separado por " · "
  const meta = (parts: (string | false | null | undefined)[]) =>
    parts.filter(Boolean).join("  ·  ")

  const actor = prettyActor(payload.triggered_by)

  let message = ""
  switch (payload.event_type) {
    case "task.created": {
      const metaLine = meta([
        payload.assigned_to && `👤 ${payload.assigned_to}`,
        dueLabel            && `📅 ${dueLabel}`,
        showPriority,
        showLabel,
      ])
      message = `🆕  *Nueva tarea*${toCol ? `  ·  _${toCol}_` : ""}\n`
      message += `> *${payload.title}*`
      if (metaLine) message += `\n> ${metaLine}`
      if (actor)    message += `\n_creada por ${actor}_`
      break
    }

    case "task.assigned": {
      const metaLine = meta([
        dueLabel && `📅 ${dueLabel}`,
        showPriority,
        showLabel,
      ])
      message = `🎯  *Tarea asignada a ${payload.assigned_to}*\n`
      message += `> *${payload.title}*`
      if (metaLine) message += `\n> ${metaLine}`
      if (actor)    message += `\n_asignada por ${actor}_`
      break
    }

    case "task.moved": {
      const metaLine = meta([
        payload.assigned_to && `👤 ${payload.assigned_to}`,
        showLabel,
      ])
      message = `🔀  *Tarea movida*\n`
      message += `> *${payload.title}*\n`
      message += `> ${fromCol ? `${fromCol}  →  ` : ""}*${toCol}*`
      if (metaLine) message += `  ·  ${metaLine}`
      if (actor)    message += `\n_movida por ${actor}_`
      break
    }

    case "task.review": {
      const metaLine = meta([
        payload.assigned_to && `👤 ${payload.assigned_to}`,
        showPriority,
        showLabel,
      ])
      message = `👀  *Para revisar* — Ann\n`
      message += `> *${payload.title}*`
      if (metaLine) message += `\n> ${metaLine}`
      message += `\n_Revisá y pasala a Listo cuando esté_`
      if (actor) message += `\n_envió a revisión: ${actor}_`
      break
    }

    case "task.completed": {
      const metaLine = meta([payload.assigned_to && `👤 ${payload.assigned_to}`, showLabel])
      message = `✅  *Tarea completada*\n`
      message += `> *${payload.title}*`
      if (metaLine) message += `\n> ${metaLine}`
      if (actor)    message += `\n_completada por ${actor}_`
      break
    }
  }

  // Banner para urgentes — resalta arriba de todo
  if (isUrgent) message = `🚨  *URGENTE*  🚨\n${message}`

  return postWebhook(url, { ...payload, message }, "zapierTaskEvent")
}

// ─── Fire: cambio de estado del onboarding ────────────────────────────────────
// Separado de zapierClientOnboarded (que solo dispara una vez, al crear el
// cliente) — este cubre los pasos siguientes del mismo onboarding, para que
// el equipo vea en Slack en qué etapa está cada cliente sin tener que
// revisar /admin/onboarding a mano.

export type OnboardingStatusEvent = "contract_signed" | "onboarding_completed" | "payment_unresolved" | "renewal_detected" | "renewal_failed" | "onboarding_partial_failure"

export async function zapierOnboardingStatusChanged(payload: {
  event_type:   OnboardingStatusEvent
  client_id?:   string
  client_name:  string
  client_email?: string
  detail?:      string   // usado por "payment_unresolved" — el motivo puntual (datos incompletos, plan no reconocido, etc.)
}): Promise<ZapierResult> {
  const url = process.env.ZAPIER_WEBHOOK_ONBOARDING_STATUS
  if (!url) return { ok: false, error: "ZAPIER_WEBHOOK_ONBOARDING_STATUS not configured" }

  const message = payload.event_type === "contract_signed"
    ? `✍️  *Contrato firmado* — ${payload.client_name}\n${payload.client_email}\nSe están enviando los accesos (Skool, Slack, Plataforma)...`
    : payload.event_type === "onboarding_completed"
    ? `🎉  *Onboarding completo* — ${payload.client_name}\nLos 3 accesos (Skool, Slack, Plataforma) se enviaron correctamente. Cliente listo para arrancar.`
    : payload.event_type === "renewal_detected"
    ? `🔁  *Renovación/segunda compra detectada* — ${payload.client_name}${payload.client_email ? ` (${payload.client_email})` : ""}\n${payload.detail ?? ""}\nSe agregaron cuotas al cliente existente — no se creó un cliente nuevo.`
    : payload.event_type === "renewal_failed"
    ? `🔴  *Pago recibido pero no se pudieron crear las cuotas* — ${payload.client_name}${payload.client_email ? ` (${payload.client_email})` : ""}\n${payload.detail ?? "Motivo no especificado"}\nEl pago es real y no quedó reflejado — revisar a mano.`
    : payload.event_type === "onboarding_partial_failure"
    ? `🟡  *Onboarding automático completado con errores* — ${payload.client_name}${payload.client_email ? ` (${payload.client_email})` : ""}\n${payload.detail ?? "Motivo no especificado"}\nEl cliente quedó creado pero revisar el paso que falló.`
    : `⚠️  *Pago de PayFunnels sin onboarding automático* — ${payload.client_name}${payload.client_email ? ` (${payload.client_email})` : ""}\n${payload.detail ?? "Motivo no especificado"}\nRevisar \`payfunnels_webhook_events\` y cargar a mano en /admin/onboarding.`

  return postWebhook(url, { ...payload, message }, "zapierOnboardingStatusChanged")
}

// ─── Fire: seguimiento de lead vencido ────────────────────────────────────────
// Disparado por app/api/cron/lead-follow-up — un lead del pipeline llegó (o
// pasó) su fecha de "próximo seguimiento" y todavía no se avisó por esa fecha.

export async function zapierLeadFollowUpDue(payload: {
  event_type:        "lead.follow_up_due"
  lead_id:           string
  lead_name:         string
  instagram?:        string | null
  rating?:            number | null
  stage_label:       string
  deal_value?:       number | null
  next_follow_up_at: string   // YYYY-MM-DD
  days_overdue:      number   // 0 = vence hoy, >0 = días de atraso
}): Promise<ZapierResult> {
  const url = process.env.ZAPIER_WEBHOOK_LEAD_FOLLOWUP
  if (!url) return { ok: false, error: "ZAPIER_WEBHOOK_LEAD_FOLLOWUP not configured" }

  const stars   = payload.rating ? "⭐".repeat(payload.rating) : ""
  const ig      = payload.instagram?.trim() ? `\n📸 ${payload.instagram.trim().replace(/^@+/, "@")}` : ""
  const value   = payload.deal_value ? `\n💵 $${payload.deal_value.toLocaleString("es-AR")}` : ""
  const timing  = payload.days_overdue > 0
    ? `⚠️ *Atrasado ${payload.days_overdue} día${payload.days_overdue === 1 ? "" : "s"}*`
    : `📅 *Vence hoy*`

  const message = [
    `🔔  *Seguimiento pendiente* — ${payload.lead_name} ${stars}`.trim(),
    `> ${payload.stage_label}${ig}${value}`,
    timing,
  ].join("\n")

  return postWebhook(url, { ...payload, message }, "zapierLeadFollowUpDue")
}

// ─── Fire: llamada de cliente recibida ────────────────────────────────────────
// Disparado por app/api/webhooks/client-call apenas Zapier manda una grabación
// de Zoom nueva y se intentó matchear contra un cliente por email.

export async function zapierClientCallReceived(payload: {
  event_type:         "client_call.received"
  client_name?:       string | null
  participant_email?: string | null
  participant_name?:  string | null
  recording_url?:     string | null
  meeting_topic?:     string | null
  duration_minutes?:  number | null
}): Promise<ZapierResult> {
  const url = process.env.ZAPIER_WEBHOOK_CLIENT_CALL
  if (!url) return { ok: false, error: "ZAPIER_WEBHOOK_CLIENT_CALL not configured" }

  const who = payload.client_name?.trim()
    || payload.participant_name?.trim()
    || payload.participant_email?.trim()
    || "Participante sin identificar"

  const lines = [
    `📞  *Nueva llamada recibida* — ${who}${payload.client_name ? "" : "  _(sin cliente asignado — asignar a mano)_"}`,
  ]
  if (payload.meeting_topic) lines.push(`> ${payload.meeting_topic}`)
  if (payload.duration_minutes) lines.push(`⏱ ${Math.round(payload.duration_minutes)} min`)
  if (payload.recording_url) lines.push(`🎥 ${payload.recording_url}`)

  return postWebhook(url, { ...payload, message: lines.join("\n") }, "zapierClientCallReceived")
}

// ─── Fire: formulario POSI completado ─────────────────────────────────────────
// Disparado por app/api/posi/submissions/route.ts cada vez que un cliente
// completa (o vuelve a guardar) un nivel — sin aprobar/reprobar, se avisa
// siempre. Reemplaza el aviso directo que posteaba por bot al canal privado
// #9-posi-alertas (requería tener el bot invitado a mano) — ahora Zapier
// decide el destino, mismo patrón que el resto de los eventos de este archivo.

export async function zapierPosiSubmission(payload: {
  event_type:  "posi.submitted"
  client_name: string
  level_title: string
  passed:      boolean | null   // true=aprobó, false=no aprobó, null=nivel sin preguntas calificables
}): Promise<ZapierResult> {
  const url = process.env.ZAPIER_WEBHOOK_POSI
  if (!url) return { ok: false, error: "ZAPIER_WEBHOOK_POSI not configured" }

  // Mensaje deliberadamente corto — ni acá ni en Slack se muestra el
  // detalle de qué respondió bien o mal; eso solo se ve en /admin/posi
  // (pedido explícito, para que el cliente no lo use de respuestario y
  // el equipo sea quien lo guíe).
  const message =
    payload.passed === true  ? `✅ *${payload.client_name}* aprobó el *${payload.level_title}* de POSI.` :
    payload.passed === false ? `❌ *${payload.client_name}* no aprobó el *${payload.level_title}* de POSI.` :
    `📋 *${payload.client_name}* completó el *${payload.level_title}* de POSI.`

  return postWebhook(url, { ...payload, message }, "zapierPosiSubmission")
}
