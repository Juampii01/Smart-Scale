// ─── Slack Integration ────────────────────────────────────────────────────────
// Two modes:
//   1. Incoming Webhooks (SLACK_WEBHOOK_URL) — post to a single pre-configured channel.
//   2. Bot Token (SLACK_BOT_TOKEN) — create channels dynamically + post to any channel.
//
// For onboarding automation, SLACK_BOT_TOKEN is required with scopes:
//   channels:manage  (or groups:write for private channels)
//   chat:write
//   chat:write.public  (to post without joining the channel first)

export interface SlackResult {
  ok: boolean
  error?: string
  channel_id?: string  // populated when a channel is created/found
}

// ─── Slack Web API helpers (Bot Token) ───────────────────────────────────────

async function slackApi(method: string, body: Record<string, unknown>): Promise<any> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) return { ok: false, error: "SLACK_BOT_TOKEN not configured" }

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

/** Sanitize a name into a valid Slack channel name (lowercase, no spaces, max 80 chars) */
function toChannelName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip accents
    .replace(/[^a-z0-9-_]/g, "-")      // replace invalid chars
    .replace(/-+/g, "-")               // collapse dashes
    .replace(/^-|-$/g, "")             // trim leading/trailing
    .slice(0, 75)                      // leave room for "cl-" prefix (80 max)
}

/**
 * Create a public Slack channel. If it already exists, returns the existing channel id.
 * Returns { ok, channel_id } or { ok: false, error }.
 */
export async function createSlackChannel(clientName: string): Promise<SlackResult> {
  const channelName = `cl-${toChannelName(clientName)}`

  const data = await slackApi("conversations.create", {
    name: channelName,
    is_private: false,
  })

  if (data.ok) {
    return { ok: true, channel_id: data.channel?.id }
  }

  // Channel already exists — look it up
  if (data.error === "name_taken") {
    const list = await slackApi("conversations.list", {
      exclude_archived: true,
      types: "public_channel",
      limit: 1000,
    })
    const existing = (list.channels ?? []).find(
      (c: any) => c.name === channelName
    )
    if (existing) return { ok: true, channel_id: existing.id }
    return { ok: false, error: "name_taken but channel not found in list" }
  }

  return { ok: false, error: data.error ?? "Unknown error creating channel" }
}

/**
 * Post a message to a specific channel id using the Bot Token.
 */
export async function postToChannel(
  channelId: string,
  blocks: unknown[],
  fallbackText: string
): Promise<SlackResult> {
  const data = await slackApi("chat.postMessage", {
    channel: channelId,
    text: fallbackText,
    blocks,
  })
  if (data.ok) return { ok: true, channel_id: channelId }
  return { ok: false, error: data.error ?? "Unknown error posting message" }
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
  const clientName = payload.client_name ?? "Cliente"
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
  const clientName = payload.client_name ?? "Cliente"
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

// ─── Notification: client onboarded ──────────────────────────────────────────
// Creates a dedicated #cl-{name} channel and posts the onboarding summary.
// Requires SLACK_BOT_TOKEN. Fails silently if the token is missing.

export async function notifyClientOnboarded(payload: {
  client_id:     string
  name:          string
  email:         string
  instagram?:    string | null
  phone?:        string | null
  program?:      string | null
  total_amount:  number
  cuotas?:       Record<string, number | null>
  program_start: string
  setter_name?:  string | null
  temp_password?: string | null
  magic_link?:   string          // one-time login link to forward to client
  dashboard_url?: string
}): Promise<SlackResult & { channel_id?: string }> {
  // 1. Create (or find) the dedicated channel
  const channelResult = await createSlackChannel(payload.name)
  if (!channelResult.ok || !channelResult.channel_id) {
    return { ok: false, error: channelResult.error ?? "No channel id" }
  }
  const channelId = channelResult.channel_id

  const mrrFmt = `$${payload.total_amount.toLocaleString("es-AR")}`
  const url = payload.dashboard_url ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.smartscale.co"

  // 2. Build the onboarding message
  const contactParts: string[] = []
  if (payload.instagram) contactParts.push(`📸 @${payload.instagram}`)
  if (payload.phone)     contactParts.push(`📱 ${payload.phone}`)

  // Format cuotas para mostrar
  const cuotasStr = payload.cuotas
    ? Object.entries(payload.cuotas)
        .filter(([_, v]) => v != null)
        .map(([k, v]) => `${k}: $${(v as number).toLocaleString("es-AR")}`)
        .join(" | ") || "—"
    : "—"

  const blocks = [
    header("🎉 Nuevo cliente onboarded"),
    section(`*${payload.name}* ya tiene acceso al dashboard de Smart Scale.`),
    divider(),
    fields([
      { title: "Nombre",        value: payload.name },
      { title: "Email",         value: payload.email },
      { title: "Programa",      value: payload.program ?? "—" },
      { title: "Total",         value: mrrFmt },
      { title: "Cuotas",        value: cuotasStr },
      { title: "Inicio",        value: payload.program_start },
      { title: "Setter",        value: payload.setter_name ?? "—" },
      { title: "Contacto",      value: contactParts.join("  ·  ") || "—" },
    ]),
    divider(),
    ...(payload.magic_link ? [
      section(`🔗 *Link de acceso del cliente (1 uso · 24hs):*\n${payload.magic_link}\n_Reenviárselo por WhatsApp si no ve el email._`),
      divider(),
    ] : payload.temp_password ? [
      section(`🔑 *Contraseña temporal:* \`${payload.temp_password}\`\nEl cliente debe cambiarla en su primer login.`),
      divider(),
    ] : []),
    section(`🖥️ <${url}/dashboard|Abrir portal del cliente>`),
    context(`Smart Scale Onboarding · ${new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}`),
  ]

  // 3. Post the message
  return postToChannel(channelId, blocks, `🎉 ${payload.name} onboarded — ${mrrFmt} MRR`)
}
