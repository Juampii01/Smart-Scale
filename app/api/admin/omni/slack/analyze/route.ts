/**
 * POST /api/admin/omni/slack/analyze
 *
 * Corre el análisis de comunidad a demanda (botón "Analizar"). La lógica en
 * sí vive en lib/omni/community-analysis.ts — la comparte con el cron diario
 * (/api/cron/omni-daily-briefing) para no duplicar el prompt.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"
import { runCommunityAnalysis, CommunityAnalysisError } from "@/lib/omni/community-analysis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 90

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()

  try {
    const result = await runCommunityAnalysis(sb)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof CommunityAnalysisError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("[omni/slack/analyze] unexpected error:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
