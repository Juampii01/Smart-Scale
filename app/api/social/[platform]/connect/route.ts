/**
 * GET /api/social/[platform]/connect
 *
 * Devuelve { url } con la URL de autorización OAuth (NO redirige), porque
 * Smart Scale autentica por bearer en el header — una redirección de navegador
 * no llevaría el token. El cliente hace window.location = url.
 * Persiste un state CSRF en oauth_states (TTL 10 min).
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { rateLimit } from "@/lib/rate-limit"
import { resolveSocialScope } from "@/lib/social/scope"
import { isSocialPlatform, buildOAuthUrl } from "@/lib/social/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const limited = rateLimit(req, { bucket: "social-connect", limit: 20, windowMs: 60_000 })
  if (limited) return limited

  const { platform } = await params
  if (!isSocialPlatform(platform)) {
    return NextResponse.json({ error: "Plataforma no válida" }, { status: 400 })
  }

  const scope = await resolveSocialScope(req, req.nextUrl.searchParams.get("client_id"))
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

  const state = crypto.randomUUID()
  const returnTo = platform === "instagram" ? "/mi-instagram" : "/mi-youtube"
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  const sb = createServiceClient()
  const { error } = await sb.from("oauth_states").insert({
    state,
    user_id: scope.userId,
    client_id: scope.clientId,
    platform,
    return_to: returnTo,
    expires_at: expiresAt.toISOString(),
  })
  if (error) {
    console.error(`[social/connect] insert oauth_state error:`, error.message)
    return NextResponse.json({ error: "No se pudo iniciar la conexión" }, { status: 500 })
  }

  const url = buildOAuthUrl(platform, state, req)
  if (!url) {
    await sb.from("oauth_states").delete().eq("state", state)
    return NextResponse.json(
      { error: "not_configured", detail: `Faltan las credenciales de ${platform} en el servidor` },
      { status: 503 },
    )
  }

  return NextResponse.json({ url })
}
