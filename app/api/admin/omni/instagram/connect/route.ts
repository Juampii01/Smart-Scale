/**
 * GET /api/admin/omni/instagram/connect
 *
 * Arranca el connect de Instagram de Omni (solo Ann/la cuenta del piloto).
 * Aislado del flujo compartido de clientes: state propio (omni_oauth_states),
 * redirect_uri propio, scope propio (incluye lectura de DMs).
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"
import { buildOmniInstagramOAuthUrl } from "@/lib/omni/instagram"

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

  const url = buildOmniInstagramOAuthUrl(state, req)
  if (!url) {
    await sb.from("omni_oauth_states").delete().eq("state", state)
    return NextResponse.json(
      { error: "not_configured", detail: "Falta INSTAGRAM_APP_ID en el servidor" },
      { status: 503 },
    )
  }

  return NextResponse.json({ url })
}
