import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireSmartScaleInternal } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** PATCH — admin edita el contenido (título, intro, preguntas) de un nivel */
export async function PATCH(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireSmartScaleInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { id, title, intro, questions, skool_course_name } = body ?? {}
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (title !== undefined) update.title = title
  if (intro !== undefined) update.intro = intro
  if (questions !== undefined) update.questions = questions
  // Curso privado de Skool que se destraba al aprobar el nivel ANTERIOR a
  // este — ver app/api/posi/submissions/route.ts.
  if (skool_course_name !== undefined) update.skool_course_name = skool_course_name || null

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
