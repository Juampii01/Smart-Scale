/**
 * DELETE /api/social/[platform]/disconnect
 * Borra la conexión OAuth guardada. Idempotente.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { resolveSocialScope } from "@/lib/social/scope"
import { isSocialPlatform } from "@/lib/social/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params
  if (!isSocialPlatform(platform)) {
    return NextResponse.json({ success: false, error: "Plataforma no válida" }, { status: 400 })
  }

  const scope = await resolveSocialScope(req, req.nextUrl.searchParams.get("client_id"))
  if (!scope.ok) return NextResponse.json({ success: false, error: scope.error }, { status: scope.status })

  const sb = createServiceClient()
  const { error } = await sb
    .from("social_connections")
    .delete()
    .eq("client_id", scope.clientId)
    .eq("platform", platform)

  if (error) {
    console.error(`[social/disconnect] DB error:`, error.message)
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
