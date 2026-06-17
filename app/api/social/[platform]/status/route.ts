/**
 * GET /api/social/[platform]/status
 * Estado de conexión. Siempre 200 — usar el boolean `connected`.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { resolveSocialScope } from "@/lib/social/scope"
import { isSocialPlatform } from "@/lib/social/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params
  if (!isSocialPlatform(platform)) return NextResponse.json({ connected: false })

  const scope = await resolveSocialScope(req, req.nextUrl.searchParams.get("client_id"))
  if (!scope.ok) return NextResponse.json({ connected: false })

  const sb = createServiceClient()
  const { data } = await sb
    .from("social_connections")
    .select("account_name, account_pic, connected_at, expires_at, refresh_token")
    .eq("client_id", scope.clientId)
    .eq("platform", platform)
    .maybeSingle()

  if (!data) return NextResponse.json({ connected: false })

  // El access token expira (Google ~1h). Si hay refresh_token, la conexión SIGUE
  // viva — el access token se refresca on-demand al pedir métricas. Solo se
  // considera "necesita reconectar" cuando venció y NO hay refresh disponible.
  const accessExpired = data.expires_at ? new Date(data.expires_at) <= new Date() : false
  const canRefresh = !!data.refresh_token
  const needsReconnect = accessExpired && !canRefresh

  return NextResponse.json({
    connected: !needsReconnect,
    tokenExpired: needsReconnect,
    accountName: data.account_name,
    accountPic: data.account_pic ?? undefined,
    connectedAt: data.connected_at,
    expiresAt: data.expires_at ?? null,
  })
}
