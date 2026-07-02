// Lectura de Slack para Omni — aislado de lib/slack.ts (que sigue siendo solo
// de salida: notificaciones, creación de canales de onboarding). Usa el mismo
// SLACK_BOT_TOKEN ya configurado; el token es infraestructura compartida, pero
// este código de lectura es enteramente nuevo y propio de Omni.
//
// Requiere que el Bot Token tenga, además de los scopes de escritura ya
// otorgados, estos de lectura (se agregan reinstalando la app en el panel de
// Slack, sin crear una app nueva): channels:read, channels:history, users:read.

async function slackApiGet(method: string, params: Record<string, string>): Promise<any> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) return { ok: false, error: "SLACK_BOT_TOKEN not configured" }

  const url = `https://slack.com/api/${method}?${new URLSearchParams(params).toString()}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  return res.json()
}

export interface OmniSlackChannel {
  id:   string
  name: string
}

/** Lista todos los canales públicos que el bot puede ver (paginado, hasta 10 páginas). */
export async function listOmniSlackChannels(): Promise<OmniSlackChannel[]> {
  const channels: OmniSlackChannel[] = []
  let cursor = ""
  for (let page = 0; page < 10; page++) {
    const data = await slackApiGet("conversations.list", {
      types: "public_channel",
      exclude_archived: "true",
      limit: "200",
      ...(cursor ? { cursor } : {}),
    })
    if (!data.ok) throw new Error(`Slack conversations.list: ${data.error ?? "unknown error"}`)
    for (const c of data.channels ?? []) channels.push({ id: c.id, name: c.name })
    cursor = data.response_metadata?.next_cursor ?? ""
    if (!cursor) break
  }
  return channels
}

export interface OmniSlackMessage {
  ts:      string
  userId:  string | null
  text:    string | null
  postedAt: string
}

/** Trae el historial de un canal (paginado, hasta 5 páginas ~ 1000 mensajes). */
export async function fetchOmniSlackHistory(channelId: string): Promise<OmniSlackMessage[]> {
  const messages: OmniSlackMessage[] = []
  let cursor = ""
  for (let page = 0; page < 5; page++) {
    const data = await slackApiGet("conversations.history", {
      channel: channelId,
      limit: "200",
      ...(cursor ? { cursor } : {}),
    })
    if (!data.ok) throw new Error(`Slack conversations.history: ${data.error ?? "unknown error"}`)
    for (const m of data.messages ?? []) {
      if (m.subtype) continue // ignora eventos del sistema (join/leave/etc.)
      messages.push({
        ts:       m.ts,
        userId:   m.user ?? null,
        text:     m.text ?? null,
        postedAt: new Date(Number(m.ts) * 1000).toISOString(),
      })
    }
    cursor = data.response_metadata?.next_cursor ?? ""
    if (!cursor) break
  }
  return messages
}

/** Resuelve nombres de usuario (con cache local para no repetir llamadas). */
export async function resolveOmniSlackUserNames(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  for (const id of unique) {
    const data = await slackApiGet("users.info", { user: id })
    if (data.ok && data.user) {
      names.set(id, data.user.real_name ?? data.user.name ?? id)
    }
  }
  return names
}
