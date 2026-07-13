/**
 * GET /api/admin/omni/briefing
 *
 * Devuelve el briefing diario más reciente de cada tipo (community, leads)
 * guardado por el cron (/api/cron/omni-daily-briefing), para mostrarlo en la
 * vista sin tener que volver a llamar a Claude.
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

  const [{ data: community }, { data: leads }, { data: prospecting }, { data: unanswered }] = await Promise.all([
    sb.from("omni_daily_briefings")
      .select("date, findings, messages_analyzed, created_at")
      .eq("type", "community")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("omni_daily_briefings")
      .select("date, findings, messages_analyzed, created_at")
      .eq("type", "leads")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("omni_daily_briefings")
      .select("date, findings, messages_analyzed, created_at")
      .eq("type", "prospecting")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("omni_daily_briefings")
      .select("date, findings, messages_analyzed, created_at")
      .eq("type", "unanswered")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return NextResponse.json({
    briefing:            community ?? null, // se mantiene por compatibilidad con la UI existente
    leadsBriefing:       leads ?? null,
    prospectingBriefing: prospecting ?? null,
    unansweredBriefing:  unanswered ?? null,
  })
}
