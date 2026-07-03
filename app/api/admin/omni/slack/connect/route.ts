/**
 * GET /api/admin/omni/slack/connect
 *
 * Arranca el connect de Slack de Omni — autoriza como el USUARIO de Ann
 * (user_scope), no como bot. Reusa omni_oauth_states (genérica, ya usada por
 * el connect de Instagram) para el CSRF.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"
import { buildOmniSlackOAuthUrl } from "@/lib/omni/slack-oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const state = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  const sb = createServiceClient()
  await sb.from("omni_oauth_states").delete().lt("expires_at", new Date().toISOString()).then(() => {}, () => {})
  const { error } = await sb.from("omni_oauth_states").insert({ state, expires_at: expiresAt.toISOString() })
  if (error) {
    return NextResponse.json({ error: "No se pudo iniciar la conexión" }, { status: 500 })
  }

  const url = buildOmniSlackOAuthUrl(state, req)
  if (!url) {
    await sb.from("omni_oauth_states").delete().eq("state", state)
    return NextResponse.json(
      { error: "not_configured", detail: "Falta SLACK_CLIENT_ID en el servidor" },
      { status: 503 },
    )
  }

  return NextResponse.json({ url })
}
