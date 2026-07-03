// OAuth de Slack para Omni — aislado del flujo de escritura existente
// (lib/slack.ts, SLACK_BOT_TOKEN). Acá no autorizamos un bot: le pedimos a
// Ann que autorice como SU PROPIO usuario (user_scope, no scope), así el
// token resultante hereda automáticamente todos los canales de los que ella
// ya es miembro — público y privado — sin invitar a nadie canal por canal.

import { NextRequest } from "next/server"

const OMNI_SLACK_USER_SCOPES = [
  "channels:history",
  "channels:read",
  "groups:history",
  "groups:read",
  "users:read",
].join(",")

export function omniSlackAppOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/+$/, "")
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(/:$/, "")
  const host = req.headers.get("x-forwarded-host") ?? req.nextUrl.host
  return `${proto}://${host}`
}

/** redirect_uri propio de Omni — debe registrarse en Slack (OAuth & Permissions → Redirect URLs). */
export function omniSlackCallbackUrl(req: NextRequest): string {
  if (process.env.OMNI_SLACK_REDIRECT_URI) return process.env.OMNI_SLACK_REDIRECT_URI
  return `${omniSlackAppOrigin(req)}/api/admin/omni/slack/callback`
}

/** Arma la URL de autorización OAuth de Slack (user token). Null si faltan credenciales. */
export function buildOmniSlackOAuthUrl(state: string, req: NextRequest): string | null {
  const clientId = process.env.SLACK_CLIENT_ID
  if (!clientId) return null
  const params = new URLSearchParams({
    client_id:    clientId,
    user_scope:   OMNI_SLACK_USER_SCOPES,
    redirect_uri: omniSlackCallbackUrl(req),
    state,
  })
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`
}

export interface OmniSlackUserToken {
  accessToken:  string
  slackUserId:  string
  slackTeamId:  string
  scopes:       string
}

/** Intercambia el code OAuth por el token de usuario (authed_user.access_token). */
export async function exchangeOmniSlackCode(code: string, redirectUri: string): Promise<OmniSlackUserToken> {
  const clientId     = process.env.SLACK_CLIENT_ID!
  const clientSecret = process.env.SLACK_CLIENT_SECRET!

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`Slack oauth.v2.access: ${data.error ?? "unknown error"}`)

  const authedUser = data.authed_user
  if (!authedUser?.access_token) throw new Error("Slack no devolvió un token de usuario (¿faltó user_scope?)")

  return {
    accessToken: authedUser.access_token,
    slackUserId: authedUser.id,
    slackTeamId: data.team?.id ?? "",
    scopes:      authedUser.scope ?? "",
  }
}
