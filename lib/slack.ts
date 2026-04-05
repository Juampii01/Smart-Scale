// ─── Slack Webhook Integration ────────────────────────────────────────────────
// Sends formatted notifications to a Slack channel via Incoming Webhooks.
// Requires: SLACK_WEBHOOK_URL environment variable.
// All errors are caught and returned — caller decides how to handle.

export interface SlackResult {
  ok: boolean
  error?: string
}

// ─── Block-kit message builders ───────────────────────────────────────────────

function divider() {
  return { type: "divider" }
}

function header(text: string) {
  return {
    type: "header",
    text: { type: "plain_text", text, emoji: true },
  }
}

function section(text: string) {
  return {
    type: "section",
    text: { type: "mrkdwn", text },
  }
}

function fields(items: { title: string; value: string }[]) {
  return {
    type: "section",
    fields: items.map((i) => ({
      type: "mrkdwn",
      text: `*${i.title}*\n${i.value || "—"}`,
    })),
  }
}

function context(text: string) {
  return {
    type: "context",
    elements: [{ type: "mrkdwn", text }],
  }
}

// ─── Core send function ───────────────────────────────────────────────────────

export async function sendSlackMessage(blocks: unknown[], fallbackText: string): Promise<SlackResult> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    return { ok: false, error: "SLACK_WEBHOOK_URL not configured" }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: fallbackText, blocks }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return { ok: false, error: `Slack returned ${res.status}: ${body}` }
    }

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Unknown Slack error" }
  }
}

// ─── Notification: monthly report completed ───────────────────────────────────

export async function notifyMonthlyReportCompleted(payload: {
  client_name?: string
  client_id?: string
  month?: string
  total_revenue?: number
  new_clients?: number
  cash_collected?: number
  mrr?: number
  triggered_by?: string
}): Promise<SlackResult> {
  const month = payload.month ?? "—"
  const clientName = payload.client_name ?? payload.client_id ?? "Cliente"
  const revenue = payload.total_revenue != null
    ? `$${Number(payload.total_revenue).toLocaleString()}`
    : "—"
  const cash = payload.cash_collected != null
    ? `$${Number(payload.cash_collected).toLocaleString()}`
    : "—"
  const mrr = payload.mrr != null
    ? `$${Number(payload.mrr).toLocaleString()}`
    : "—"
  const newClients = payload.new_clients != null ? String(payload.new_clients) : "—"

  const blocks = [
    header("📊 Reporte mensual completado"),
    section(`El reporte de *${month}* para *${clientName}* fue guardado exitosamente en el dashboard.`),
    divider(),
    fields([
      { title: "Cliente", value: clientName },
      { title: "Mes", value: month },
      { title: "Revenue total", value: revenue },
      { title: "Cash collected", value: cash },
      { title: "MRR", value: mrr },
      { title: "Nuevos clientes", value: newClients },
    ]),
    divider(),
    context(
      `Cargado por: ${payload.triggered_by ?? "sistema"} · Smart Scale Portal 2.0`
    ),
  ]

  return sendSlackMessage(
    blocks,
    `📊 Reporte ${month} de ${clientName} completado — Revenue: ${revenue}`
  )
}

// ─── Notification: sale registered ───────────────────────────────────────────

export async function notifySaleRegistered(payload: {
  client_name?: string
  client_id?: string
  month?: string
  new_clients: number
  total_revenue?: number
  triggered_by?: string
}): Promise<SlackResult> {
  const month = payload.month ?? "—"
  const clientName = payload.client_name ?? payload.client_id ?? "Cliente"
  const count = payload.new_clients
  const revenue = payload.total_revenue != null
    ? `$${Number(payload.total_revenue).toLocaleString()}`
    : "—"
  const label = count === 1 ? "1 nuevo cliente" : `${count} nuevos clientes`

  const blocks = [
    header(`🎉 ¡Venta registrada! ${label}`),
    section(
      `*${clientName}* registró *${label}* en el reporte de *${month}*.`
    ),
    divider(),
    fields([
      { title: "Cliente", value: clientName },
      { title: "Mes", value: month },
      { title: "Nuevos clientes", value: String(count) },
      { title: "Revenue del mes", value: revenue },
    ]),
    divider(),
    context(
      `Registrado por: ${payload.triggered_by ?? "sistema"} · Smart Scale Portal 2.0`
    ),
  ]

  return sendSlackMessage(
    blocks,
    `🎉 ${label} registrados para ${clientName} en ${month}`
  )
}
