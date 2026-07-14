/**
 * GET/POST /api/admin/omni/prospecting/patterns
 *
 * Corpus estructurado de patrones de prospección (situación → enfoque
 * usado → resultado), append-only. Se crea desde el botón "Corregir" en un
 * análisis de conversación ya generado, o suelto desde el apartado
 * "Prospección" en admin-omni-view.tsx. Se usa como few-shot en
 * lib/omni/prospecting-context.ts para el análisis individual.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_PATTERNS = 100

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const conversationId = req.nextUrl.searchParams.get("conversation_id")

  let query = sb
    .from("omni_prospecting_patterns")
    .select("id, conversation_id, participant_username, situacion, enfoque, resultado, correccion, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_PATTERNS)

  if (conversationId) query = query.eq("conversation_id", conversationId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ patterns: data ?? [] })
}

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const situacion = String(body.situacion ?? "").trim()
  const enfoque    = String(body.enfoque ?? "").trim()
  if (!situacion || !enfoque) {
    return NextResponse.json({ error: "situacion y enfoque son obligatorios" }, { status: 400 })
  }

  const resultado = ["cerro", "no_cerro", "pendiente"].includes(body.resultado) ? body.resultado : "pendiente"

  const sb = createServiceClient()
  const { data, error } = await sb
    .from("omni_prospecting_patterns")
    .insert({
      conversation_id:       body.conversation_id || null,
      participant_username:  body.participant_username || null,
      situacion,
      enfoque,
      resultado,
      correccion:            body.correccion ? String(body.correccion).trim() : null,
      created_by:            user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pattern: data })
}
