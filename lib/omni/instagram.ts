// Instagram para Omni — aislado del flujo compartido de clientes
// (lib/social/oauth.ts, app/api/social/[platform]/*). Pide un scope extra
// (instagram_business_manage_messages) que solo se le solicita a la cuenta de
// Ann, nunca a los clientes normales que conectan Instagram para insights.

import { NextRequest } from "next/server"

const OMNI_INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
  "instagram_business_manage_messages",
].join(",")

export function omniInstagramAppOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/+$/, "")
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(/:$/, "")
  const host = req.headers.get("x-forwarded-host") ?? req.nextUrl.host
  return `${proto}://${host}`
}

/** redirect_uri propio de Omni — debe registrarse aparte en Meta Developer
 *  (Valid OAuth Redirect URIs), además del que ya usan los clientes. */
export function omniInstagramCallbackUrl(req: NextRequest): string {
  if (process.env.OMNI_INSTAGRAM_REDIRECT_URI) return process.env.OMNI_INSTAGRAM_REDIRECT_URI
  return `${omniInstagramAppOrigin(req)}/api/admin/omni/instagram/callback`
}

/** Arma la URL de autorización OAuth de Omni. Null si faltan credenciales. */
export function buildOmniInstagramOAuthUrl(state: string, req: NextRequest): string | null {
  const clientId = process.env.INSTAGRAM_APP_ID
  if (!clientId) return null
  const redirect = omniInstagramCallbackUrl(req)
  const params = new URLSearchParams({
    force_reauth: "true",
    client_id: clientId,
    redirect_uri: redirect,
    state,
    response_type: "code",
  })
  // El scope debe ir con comas literales — URLSearchParams las encodea como
  // %2C y el OAuth de Instagram no lo acepta.
  return `https://www.instagram.com/oauth/authorize?${params.toString()}&scope=${OMNI_INSTAGRAM_SCOPES}`
}

interface OmniIgToken { accessToken: string; expiresAt?: Date }
interface OmniIgProfile { accountId: string; accountName: string; accountPic?: string }

/** Intercambia el code OAuth por un token de larga duración + trae el perfil. */
export async function exchangeOmniInstagramCode(code: string, redirectUri: string) {
  const clientId = process.env.INSTAGRAM_APP_ID!
  const clientSecret = process.env.INSTAGRAM_APP_SECRET!

  const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code }),
    signal: AbortSignal.timeout(10_000),
  })
  const shortText = await shortRes.text()
  if (!shortRes.ok) throw new Error(`IG short-token ${shortRes.status}: ${shortText.slice(0, 150)}`)
  const shortData = JSON.parse(shortText) as { access_token: string; user_id: number; expires_in?: number }
  let accessToken = shortData.access_token
  let expiresAt: Date | undefined = shortData.expires_in ? new Date(Date.now() + shortData.expires_in * 1000) : undefined

  const llRes = await fetch(
    `https://graph.instagram.com/access_token?` +
      new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: clientSecret, access_token: accessToken }).toString(),
    { signal: AbortSignal.timeout(10_000) },
  )
  const llText = await llRes.text()
  if (llRes.ok) {
    let longData: { access_token?: string; expires_in?: number } = {}
    try { longData = JSON.parse(llText) } catch { /* non-JSON */ }
    if (longData.access_token) {
      accessToken = longData.access_token
      expiresAt = longData.expires_in ? new Date(Date.now() + longData.expires_in * 1000) : expiresAt
    }
  }

  const igUserId = String(shortData.user_id)
  let accountName = igUserId
  let accountPic: string | undefined
  const profileRes = await fetch(
    `https://graph.instagram.com/v23.0/me?fields=user_id,username,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (profileRes.ok) {
    const p = (await profileRes.json()) as { username?: string; profile_picture_url?: string }
    accountName = p.username ?? igUserId
    accountPic = p.profile_picture_url
  }

  return {
    token: { accessToken, expiresAt } as OmniIgToken,
    profile: { accountId: igUserId, accountName, accountPic } as OmniIgProfile,
  }
}

export interface OmniIgConversation {
  id: string
  participantUsername: string | null
  participantIgId: string | null
}

export interface OmniIgMessage {
  id: string
  from: "lead" | "ann"
  body: string | null
  sentAt: string | null
}

/** Trae las conversaciones recientes de la cuenta conectada. */
export async function fetchOmniIgConversations(accessToken: string, accountId: string): Promise<OmniIgConversation[]> {
  const url = `https://graph.instagram.com/v23.0/me/conversations?platform=instagram&fields=participants&access_token=${encodeURIComponent(accessToken)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`IG conversations ${res.status}: ${(await res.text()).slice(0, 150)}`)
  const data = await res.json() as { data?: Array<{ id: string; participants?: { data?: Array<{ id: string; username?: string }> } }> }

  return (data.data ?? []).map(c => {
    const other = (c.participants?.data ?? []).find(p => p.id !== accountId)
    return {
      id: c.id,
      participantUsername: other?.username ?? null,
      participantIgId: other?.id ?? null,
    }
  })
}

/** Trae los mensajes de una conversación puntual. */
export async function fetchOmniIgMessages(accessToken: string, conversationId: string, accountId: string): Promise<OmniIgMessage[]> {
  const url = `https://graph.instagram.com/v23.0/${conversationId}?fields=messages.limit(50){id,from,to,message,created_time}&access_token=${encodeURIComponent(accessToken)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`IG messages ${res.status}: ${(await res.text()).slice(0, 150)}`)
  const data = await res.json() as {
    messages?: { data?: Array<{ id: string; from?: { id: string }; message?: string; created_time?: string }> }
  }

  return (data.messages?.data ?? []).map(m => ({
    id: m.id,
    from: m.from?.id === accountId ? "ann" : "lead",
    body: m.message ?? null,
    sentAt: m.created_time ?? null,
  }))
}
