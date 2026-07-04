/**
 * GET /api/admin/omni/briefing
 *
 * Devuelve el briefing diario más reciente guardado por el cron
 * (/api/cron/omni-daily-briefing), para mostrarlo en la vista sin tener que
 * volver a llamar a Claude.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const { data } = await sb
    .from("omni_daily_briefings")
    .select("date, findings, messages_analyzed, created_at")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ briefing: data ?? null })
}
