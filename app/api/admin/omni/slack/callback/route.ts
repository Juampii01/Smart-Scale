/**
 * GET /api/admin/omni/slack/callback
 *
 * Recibe el code OAuth, valida el state (omni_oauth_states, un solo uso),
 * intercambia el code por el token de USUARIO de Ann y lo guarda en
 * omni_slack_user_connection. No requiere header de auth: confía en la fila
 * de state (mismo patrón que el callback de Instagram de Omni).
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { encryptToken } from "@/lib/social/crypto"
import { omniSlackAppOrigin, omniSlackCallbackUrl, exchangeOmniSlackCode } from "@/lib/omni/slack-oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function redirectTo(req: NextRequest, key: string, value: string) {
  const url = new URL("/admin/omni", omniSlackAppOrigin(req))
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

  if (oauthError) return redirectTo(req, "omni_slack_error", "denied")
  if (!code || !state) return redirectTo(req, "omni_slack_error", "missing_code")

  const { data: stateRow } = await sb.from("omni_oauth_states").select("*").eq("state", state).maybeSingle()
  await sb.from("omni_oauth_states").delete().eq("state", state)

  if (!stateRow) return redirectTo(req, "omni_slack_error", "invalid_state")
  if (new Date(stateRow.expires_at) < new Date()) return redirectTo(req, "omni_slack_error", "expired_state")

  const redirectUri = omniSlackCallbackUrl(req)

  try {
    const token = await exchangeOmniSlackCode(code, redirectUri)

    const { error } = await sb.from("omni_slack_user_connection").upsert({
      slack_user_id: token.slackUserId,
      slack_team_id: token.slackTeamId,
      access_token:  encryptToken(token.accessToken),
      scopes:        token.scopes,
      updated_at:    new Date().toISOString(),
    }, { onConflict: "slack_user_id,slack_team_id" })
    if (error) throw new Error(error.message)
  } catch (e) {
    console.error("[omni/slack/callback] error:", e instanceof Error ? e.message : e)
    return redirectTo(req, "omni_slack_error", "exchange_failed")
  }

  return redirectTo(req, "omni_slack_success", "1")
}
