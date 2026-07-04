/**
 * GET /api/admin/client-activity
 *
 * Snapshot de actividad de clientes para el panel de Desarrollador: último
 * login + estado de Monday Win / reporte mensual del período actual. Mismo
 * dato que usa el cron de recordatorios (lib/client-activity.ts), expuesto
 * acá para la UI.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"
import { getClientActivitySnapshot } from "@/lib/client-activity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const caller = await requireAdmin(jwt)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const activity = await getClientActivitySnapshot(sb)

  return NextResponse.json({ activity })
}
