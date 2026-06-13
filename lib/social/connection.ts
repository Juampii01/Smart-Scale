import { createServiceClient } from "@/lib/supabase-service"
import { decryptToken, encryptToken } from "@/lib/social/crypto"
import type { SocialPlatform } from "@/lib/social/oauth"

export interface SocialConnection {
  accountId: string
  accountName: string
  accountPic: string | null
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scopes: string
}

/** Lee la conexión de un cliente/plataforma y descifra los tokens. */
export async function getConnection(clientId: string, platform: SocialPlatform): Promise<SocialConnection | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from("social_connections")
    .select("account_id, account_name, account_pic, access_token, refresh_token, expires_at, scopes")
    .eq("client_id", clientId)
    .eq("platform", platform)
    .maybeSingle()
  if (!data) return null
  return {
    accountId: data.account_id,
    accountName: data.account_name,
    accountPic: data.account_pic ?? null,
    accessToken: decryptToken(data.access_token),
    refreshToken: data.refresh_token ? decryptToken(data.refresh_token) : null,
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    scopes: data.scopes ?? "",
  }
}

/**
 * Devuelve un access token de YouTube válido. Si el actual venció (o falta < 2 min)
 * y hay refresh_token, lo refresca contra Google y persiste el nuevo en la DB.
 * Devuelve null si no se puede refrescar (hay que reconectar).
 */
export async function getValidYouTubeToken(clientId: string, conn: SocialConnection): Promise<string | null> {
  const soon = Date.now() + 2 * 60 * 1000
  const stillValid = conn.expiresAt ? conn.expiresAt.getTime() > soon : true
  if (stillValid) return conn.accessToken
  if (!conn.refreshToken) return null

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    console.error("[social/connection] YT refresh failed:", res.status)
    return null
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) return null

  const sb = createServiceClient()
  await sb
    .from("social_connections")
    .update({
      access_token: encryptToken(data.access_token),
      expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("platform", "youtube")

  return data.access_token
}
