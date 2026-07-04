/**
 * GET /api/admin/omni/instagram/callback
 *
 * Recibe el code OAuth del connect de Omni, valida el state (omni_oauth_states,
 * un solo uso), intercambia el code y guarda en omni_instagram_connections.
 * No requiere header de auth: confía en la fila de state (igual que el flujo
 * compartido de clientes). Redirige a /admin/omni en éxito/error.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { encryptToken } from "@/lib/social/crypto"
import { omniInstagramAppOrigin, omniInstagramCallbackUrl, exchangeOmniInstagramCode } from "@/lib/omni/instagram"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function redirectTo(req: NextRequest, key: string, value: string) {
  const url = new URL("/admin/omni", omniInstagramAppOrigin(req))
  url.searchParams.set(key, value)
  return NextResponse.redirect(url.toString())
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const code = sp.get("code")
  const state = sp.get("state")
  const oauthError = sp.get("error")

  const sb = createServiceClient()
  await sb.from("omni_oauth_states").delete().lt("expires_at", new Date().toISOString()).then(() => {}, () => {})

  if (oauthError) return redirectTo(req, "omni_ig_error", "denied")
  if (!code || !state) return redirectTo(req, "omni_ig_error", "missing_code")

  const { data: stateRow } = await sb.from("omni_oauth_states").select("*").eq("state", state).maybeSingle()
  await sb.from("omni_oauth_states").delete().eq("state", state)

  if (!stateRow) return redirectTo(req, "omni_ig_error", "invalid_state")
  if (new Date(stateRow.expires_at) < new Date()) return redirectTo(req, "omni_ig_error", "expired_state")

  const redirectUri = omniInstagramCallbackUrl(req)

  try {
    const { token, profile } = await exchangeOmniInstagramCode(code, redirectUri)

    const { error } = await sb.from("omni_instagram_connections").upsert({
      account_id:   profile.accountId,
      account_name: profile.accountName,
      account_pic:  profile.accountPic ?? null,
      access_token: encryptToken(token.accessToken),
      expires_at:   token.expiresAt ? token.expiresAt.toISOString() : null,
      scopes:       "instagram_business_basic,instagram_business_manage_insights,instagram_business_manage_messages",
      updated_at:   new Date().toISOString(),
    }, { onConflict: "account_id" })
    if (error) throw new Error(error.message)
  } catch (e) {
    console.error("[omni/instagram/callback] error:", e instanceof Error ? e.message : e)
    return redirectTo(req, "omni_ig_error", "exchange_failed")
  }

  return redirectTo(req, "omni_ig_success", "1")
}
