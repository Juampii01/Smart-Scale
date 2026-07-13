/**
 * POST /api/admin/omni/prospecting/conversations/[id]/analyze
 *
 * Analiza UNA conversación puntual a demanda (botón "Analizar" en la card
 * de la lista). Distinto del análisis en bloque (prospecting-risk-analysis.ts):
 * acá siempre hay un veredicto, incluyendo "sano".
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"
import { analyzeOneConversation, ConversationAnalysisError } from "@/lib/omni/conversation-analysis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const sb = createServiceClient()

  try {
    const result = await analyzeOneConversation(sb, id)
    return NextResponse.json(result)
  } catch (e) {
    const status = e instanceof ConversationAnalysisError ? e.status : 500
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al analizar" }, { status })
  }
}
