import { createServiceClient } from "@/lib/supabase-service"
import { logJobRun } from "@/lib/system-log"

// ─── Slack Integration ────────────────────────────────────────────────────────
// Bot Token (SLACK_BOT_TOKEN) — create channels dynamically + post to any channel.
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
    const error = channelResult.error ?? "No channel id"
    await logJobRun(createServiceClient(), "slack:notifyClientOnboarded", "error", error)
    return { ok: false, error }
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
  const result = await postToChannel(channelId, blocks, `🎉 ${payload.name} onboarded — ${mrrFmt} MRR`)
  await logJobRun(createServiceClient(), "slack:notifyClientOnboarded", result.ok ? "ok" : "error", result.error)
  return result
}

// ─── Notification: checklist level completed ─────────────────────────────────
// Canal fijo de equipo (no uno por cliente) — se crea/busca una sola vez.

/**
 * Encuentra o crea un canal de EQUIPO (sin el prefijo "cl-" de los canales
 * por cliente) — mismo mecanismo que createSlackChannel, para canales
 * internos fijos como "posi-niveles".
 */
/** Busca (no crea) un canal por nombre entre públicos Y privados — para
 *  canales privados el bot tiene que estar invitado, si no aparece en el
 *  listado aunque el canal exista. */
async function findTeamChannel(channelName: string): Promise<SlackResult> {
  const name = toChannelName(channelName)
  const list = await slackApi("conversations.list", {
    exclude_archived: true,
    types: "public_channel,private_channel",
    limit: 1000,
  })
  if (!list.ok) return { ok: false, error: list.error ?? "Error listando canales" }
  const existing = (list.channels ?? []).find((c: any) => c.name === name)
  if (existing) return { ok: true, channel_id: existing.id }
  return { ok: false, error: `Canal "${name}" no encontrado — ¿está el bot invitado?` }
}

export async function findOrCreateTeamChannel(channelName: string): Promise<SlackResult> {
  const name = toChannelName(channelName)

  const data = await slackApi("conversations.create", { name, is_private: false })
  if (data.ok) return { ok: true, channel_id: data.channel?.id }

  if (data.error === "name_taken") {
    const list = await slackApi("conversations.list", {
      exclude_archived: true,
      types: "public_channel",
      limit: 1000,
    })
    const existing = (list.channels ?? []).find((c: any) => c.name === name)
    if (existing) return { ok: true, channel_id: existing.id }
    return { ok: false, error: "name_taken but channel not found in list" }
  }

  return { ok: false, error: data.error ?? "Unknown error creating channel" }
}

/**
 * Aviso al equipo cuando un cliente completa un nivel del Program Checklist
 * ("Posi") — el llamador (lib/checklist-level-progress.ts) ya se aseguró de
 * que sea la primera vez que este cliente cruza el umbral para este nivel.
 */
export async function notifyChecklistLevelCompleted(payload: {
  client_name: string
  level:       string
  pct:         number
}): Promise<SlackResult> {
  const channelResult = await findOrCreateTeamChannel("posi-niveles")
  if (!channelResult.ok || !channelResult.channel_id) {
    const error = channelResult.error ?? "No channel id"
    await logJobRun(createServiceClient(), "slack:notifyChecklistLevelCompleted", "error", error)
    return { ok: false, error }
  }

  const blocks = [
    header("✅ Nivel completado"),
    section(`*${payload.client_name}* completó el *${payload.level}* del checklist (${payload.pct}%).`),
    context(`Program Checklist · ${new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}`),
  ]

  const result = await postToChannel(channelResult.channel_id, blocks, `✅ ${payload.client_name} completó ${payload.level}`)
  await logJobRun(createServiceClient(), "slack:notifyChecklistLevelCompleted", result.ok ? "ok" : "error", result.error)
  return result
}

// ─── Notification: Posi form submitted ───────────────────────────────────────
// Canal fijo #9-posi-alertas — PRIVADO, el bot tiene que estar invitado a
// mano (Slack no deja que un bot vea/postee en un canal privado por API
// sola). Por eso se usa findTeamChannel (solo busca, no auto-crea como
// findOrCreateTeamChannel — crear de nuevo lo haría público).

export async function notifyPosiSubmission(payload: {
  client_name: string
  level_title: string
  questions:   { id: string; label: string; type: string; options?: string[] }[]
  answers:     Record<string, unknown>
}): Promise<SlackResult> {
  const channelResult = await findTeamChannel("9-posi-alertas")
  if (!channelResult.ok || !channelResult.channel_id) {
    const error = channelResult.error ?? "No channel id"
    await logJobRun(createServiceClient(), "slack:notifyPosiSubmission", "error", error)
    return { ok: false, error }
  }

  const qaLines = payload.questions.map((q) => {
    const raw = payload.answers[q.id]
    let answer: string
    if (raw === undefined || raw === null || raw === "") answer = "_(sin responder)_"
    else if (q.type === "multiple_choice" && typeof raw === "number") answer = q.options?.[raw] ?? String(raw)
    else if (q.type === "yesno") answer = raw ? "Sí" : "No"
    else answer = String(raw)
    return `*${q.label}*\n${answer}`
  })

  // Slack corta cada bloque "section" en 3000 chars — se agrupan de a 6
  // preguntas por bloque para no acercarse al límite en niveles largos.
  const blocks: unknown[] = [
    header(`📋 ${payload.level_title} completado`),
    section(`*${payload.client_name}* completó el formulario de *${payload.level_title}*.`),
  ]
  for (let i = 0; i < qaLines.length; i += 6) {
    blocks.push(section(qaLines.slice(i, i + 6).join("\n\n")))
  }
  blocks.push(context(new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })))

  const result = await postToChannel(channelResult.channel_id, blocks, `📋 ${payload.client_name} completó ${payload.level_title}`)
  await logJobRun(createServiceClient(), "slack:notifyPosiSubmission", result.ok ? "ok" : "error", result.error)
  return result
}

