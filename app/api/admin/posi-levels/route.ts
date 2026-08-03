import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** PATCH — admin edita el contenido (título, descripción, preguntas, passing_score) de un nivel */
export async function PATCH(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { id, title, description, questions, passing_score } = body ?? {}
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (title !== undefined) update.title = title
  if (description !== undefined) update.description = description
  if (questions !== undefined) update.questions = questions
  if (passing_score !== undefined) update.passing_score = Math.max(1, Math.min(100, Number(passing_score) || 80))

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("posi_levels")
    .update(update)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ level: data })
}
