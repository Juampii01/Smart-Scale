/**
 * GET /api/social/[platform]/callback
 *
 * Recibe el code OAuth, valida el state CSRF (oauth_states), intercambia code
 * por tokens, trae el perfil de la cuenta y hace upsert en social_connections.
 * No requiere header de auth: confía en la fila de oauth_states (que guarda
 * client_id/user_id al iniciar el connect). Redirige al portal en éxito/error.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { encryptToken } from "@/lib/social/crypto"
import { isSocialPlatform, appOrigin, callbackUrl, type SocialPlatform } from "@/lib/social/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface TokenResult { accessToken: string; refreshToken?: string; expiresAt?: Date; scopes?: string }
interface ProfileResult { accountId: string; accountName: string; accountPic?: string }

// ─── Instagram (Business Login) ───────────────────────────────────────────────
async function exchangeInstagram(code: string, redirectUri: string) {
  const clientId = process.env.INSTAGRAM_APP_ID!
  const clientSecret = process.env.INSTAGRAM_APP_SECRET!

  // 1. Token corto (~1h)
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

  // 2. Token largo (60 días)
  const llRes = await fetch(
    `https://graph.instagram.com/access_token?` +
      new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: clientSecret, access_token: accessToken }).toString(),
    { signal: AbortSignal.timeout(10_000) },
  )
  const llText = await llRes.text()
  if (!llRes.ok) throw new Error(`IG long-token ${llRes.status}`)
  let longData: { access_token?: string; expires_in?: number } = {}
  try { longData = JSON.parse(llText) } catch { /* non-JSON */ }
  if (longData.access_token) {
    accessToken = longData.access_token
    expiresAt = longData.expires_in ? new Date(Date.now() + longData.expires_in * 1000) : expiresAt
  }

  // 3. Perfil
  const igUserId = String(shortData.user_id)
  let accountName = igUserId
  let accountPic: string | undefined
  const profileRes = await fetch(
    `https://graph.instagram.com/v23.0/me?fields=user_id,username,account_type,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (profileRes.ok) {
    const p = (await profileRes.json()) as { username?: string; profile_picture_url?: string }
    accountName = p.username ?? igUserId
    accountPic = p.profile_picture_url
  }

  return {
    token: { accessToken, expiresAt, scopes: "" } as TokenResult,
    profile: { accountId: igUserId, accountName, accountPic } as ProfileResult,
  }
}

// ─── YouTube (Google OAuth2) ──────────────────────────────────────────────────
async function exchangeYouTube(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!tokenRes.ok) throw new Error(`YT token ${tokenRes.status}: ${(await tokenRes.text()).slice(0, 150)}`)
  const tokenData = (await tokenRes.json()) as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string }

  const channelRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!channelRes.ok) throw new Error(`YT channel ${channelRes.status}`)
  const channelData = (await channelRes.json()) as {
    items?: Array<{ id: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }>
  }
  const channel = channelData.items?.[0]
  if (!channel) throw new Error("No se encontró canal de YouTube para esta cuenta")

  return {
    token: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
      scopes: tokenData.scope ?? "",
    } as TokenResult,
    profile: {
      accountId: channel.id,
      accountName: channel.snippet?.title ?? channel.id,
      accountPic: channel.snippet?.thumbnails?.default?.url,
    } as ProfileResult,
  }
}

function redirectTo(req: NextRequest, path: string, key: string, value: string) {
  const url = new URL(path, appOrigin(req))
  url.searchParams.set(key, value)
  return NextResponse.redirect(url.toString())
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform: rawPlatform } = await params
  if (!isSocialPlatform(rawPlatform)) return redirectTo(req, "/", "connect_error", "unknown")
  const platform: SocialPlatform = rawPlatform

  const sp = req.nextUrl.searchParams
  const code = sp.get("code")
  const state = sp.get("state")
  const oauthError = sp.get("error")

  const fallbackReturn = platform === "instagram" ? "/mi-instagram" : "/mi-youtube"
  const sb = createServiceClient()

  // Limpieza oportunista de states vencidos
  await sb.from("oauth_states").delete().lt("expires_at", new Date().toISOString()).then(() => {}, () => {})

  if (oauthError) {
    return redirectTo(req, fallbackReturn, "connect_error", platform)
  }
  if (!code || !state) {
    return redirectTo(req, fallbackReturn, "connect_error", platform)
  }

  // Validar state (lectura + borrado atómico de un solo uso)
  const { data: stateRow } = await sb.from("oauth_states").select("*").eq("state", state).maybeSingle()
  await sb.from("oauth_states").delete().eq("state", state)

  if (!stateRow) return redirectTo(req, fallbackReturn, "connect_error", platform)
  if (stateRow.platform !== platform) return redirectTo(req, fallbackReturn, "connect_error", platform)
  if (new Date(stateRow.expires_at) < new Date()) return redirectTo(req, stateRow.return_to, "connect_error", platform)

  const returnTo: string = stateRow.return_to || fallbackReturn
  const userId: string = stateRow.user_id
  const clientId: string = stateRow.client_id

  const redirectUri = callbackUrl(platform, req)

  let token: TokenResult
  let profile: ProfileResult
  try {
    const ex = platform === "instagram" ? await exchangeInstagram(code, redirectUri) : await exchangeYouTube(code, redirectUri)
    token = ex.token
    profile = ex.profile
  } catch (e) {
    console.error("[social/callback] exchange error:", e instanceof Error ? e.message : e)
    return redirectTo(req, returnTo, "connect_error", platform)
  }

  try {
    const now = new Date().toISOString()
    const { error } = await sb.from("social_connections").upsert(
      {
        client_id: clientId,
        created_by: userId,
        updated_by: userId,
        platform,
        account_id: profile.accountId,
        account_name: profile.accountName,
        account_pic: profile.accountPic ?? null,
        access_token: encryptToken(token.accessToken),
        refresh_token: token.refreshToken ? encryptToken(token.refreshToken) : null,
        expires_at: token.expiresAt ? token.expiresAt.toISOString() : null,
        scopes: token.scopes ?? "",
        updated_at: now,
      },
      { onConflict: "client_id,platform" },
    )
    if (error) throw new Error(error.message)
  } catch (e) {
    console.error("[social/callback] upsert error:", e instanceof Error ? e.message : e)
    return redirectTo(req, returnTo, "connect_error", platform)
  }

  return redirectTo(req, returnTo, "connect_success", platform)
}
