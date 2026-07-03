// Lectura de Slack para Omni — aislado de lib/slack.ts (que sigue siendo solo
// de salida: notificaciones, creación de canales de onboarding, con
// SLACK_BOT_TOKEN). Este módulo lee con el TOKEN DE USUARIO de Ann
// (omni_slack_user_connection, ver lib/omni/slack-oauth.ts), no con un bot.
//
// Por qué token de usuario y no bot: un token de usuario hereda automática-
// mente todos los canales de los que Ann YA es miembro — público y privado —
// sin necesidad de invitar a nadie canal por canal. Un bot, en cambio, no se
// puede auto-unir a canales privados vía API, y aun en públicos exige un paso
// de "join" explícito. Con token de usuario ese problema desaparece: no hay
// concepto de "unirse", ya está adentro de todo lo que ella puede ver.

async function slackApiGet(token: string, method: string, params: Record<string, string>): Promise<any> {
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

/** Lista todos los canales (públicos + privados) que Ann puede ver (paginado, hasta 10 páginas). */
export async function listOmniSlackChannels(token: string): Promise<OmniSlackChannel[]> {
  const channels: OmniSlackChannel[] = []
  let cursor = ""
  for (let page = 0; page < 10; page++) {
    const data = await slackApiGet(token, "conversations.list", {
      types: "public_channel,private_channel",
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
export async function fetchOmniSlackHistory(token: string, channelId: string): Promise<OmniSlackMessage[]> {
  const messages: OmniSlackMessage[] = []
  let cursor = ""
  for (let page = 0; page < 5; page++) {
    const data = await slackApiGet(token, "conversations.history", {
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
export async function resolveOmniSlackUserNames(token: string, userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  for (const id of unique) {
    const data = await slackApiGet(token, "users.info", { user: id })
    if (data.ok && data.user) {
      names.set(id, data.user.real_name ?? data.user.name ?? id)
    }
  }
  return names
}
