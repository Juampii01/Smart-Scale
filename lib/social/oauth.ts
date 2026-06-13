import { NextRequest } from "next/server"

export type SocialPlatform = "instagram" | "youtube"

export function isSocialPlatform(p: string): p is SocialPlatform {
  return p === "instagram" || p === "youtube"
}

/** Origen público de la app (para armar el redirect_uri del callback). */
export function appOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/+$/, "")
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(/:$/, "")
  const host = req.headers.get("x-forwarded-host") ?? req.nextUrl.host
  return `${proto}://${host}`
}

/** redirect_uri registrado en la app de Meta/Google. */
export function callbackUrl(platform: SocialPlatform, req: NextRequest): string {
  // INSTAGRAM_REDIRECT_URI fija la URI exacta registrada en Meta Developer,
  // evitando cualquier mismatch de cálculo en runtime (http vs https, etc.)
  if (platform === "instagram" && process.env.INSTAGRAM_REDIRECT_URI) {
    return process.env.INSTAGRAM_REDIRECT_URI
  }
  return `${appOrigin(req)}/api/social/${platform}/callback`
}

/** Arma la URL de autorización OAuth. Devuelve null si faltan credenciales. */
export function buildOAuthUrl(platform: SocialPlatform, state: string, req: NextRequest): string | null {
  const redirect = callbackUrl(platform, req)

  if (platform === "instagram") {
    // Instagram Business Login. El App ID es el específico de Instagram
    // (sección "API setup with Instagram login" de Meta), no el de Facebook.
    const clientId = process.env.INSTAGRAM_APP_ID
    if (!clientId) return null
    // El scope debe ir con comas literales — URLSearchParams las encodea como
    // %2C y el OAuth de Instagram no lo acepta. Se agrega como string crudo.
    const params = new URLSearchParams({
      force_reauth: "true",
      client_id: clientId,
      redirect_uri: redirect,
      state,
      response_type: "code",
    })
    const scope = ["instagram_business_basic", "instagram_business_manage_insights"].join(",")
    return `https://www.instagram.com/oauth/authorize?${params.toString()}&scope=${scope}`
  }

  if (platform === "youtube") {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) return null
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
      state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  return null
}
