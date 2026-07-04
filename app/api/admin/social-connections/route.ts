/**
 * GET /api/admin/social-connections
 * Lista todas las conexiones sociales (IG/YT) con el nombre del cliente.
 * Solo admin. No expone tokens.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const { data: conns, error } = await sb
    .from("social_connections")
    .select("client_id, platform, account_id, account_name, account_pic, connected_at, expires_at")
    .order("connected_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = conns ?? []
  const clientIds = Array.from(new Set(rows.map((r: any) => r.client_id)))
  const names = new Map<string, string>()
  if (clientIds.length) {
    const { data: clients } = await sb.from("clients").select("id, name, nombre").in("id", clientIds)
    for (const c of clients ?? []) names.set((c as any).id, (c as any).name ?? (c as any).nombre ?? "—")
  }

  const now = Date.now()
  const connections = rows.map((r: any) => ({
    clientId: r.client_id,
    clientName: names.get(r.client_id) ?? "—",
    platform: r.platform,
    accountName: r.account_name,
    accountPic: r.account_pic ?? null,
    connectedAt: r.connected_at,
    expiresAt: r.expires_at ?? null,
    tokenExpired: r.expires_at ? new Date(r.expires_at).getTime() <= now : false,
  }))

  // Resumen
  const clientsWith = new Set(rows.map((r: any) => r.client_id)).size
  const summary = {
    totalClients: clientsWith,
    instagram: rows.filter((r: any) => r.platform === "instagram").length,
    youtube: rows.filter((r: any) => r.platform === "youtube").length,
  }

  return NextResponse.json({ connections, summary })
}
