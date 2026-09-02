import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET — lista los 9 niveles de Posi (0-8). Las multiple_choice pueden traer
 *  `correct_index` (para calificar) — nunca se lo mandamos al cliente que
 *  completa el formulario, solo al admin (que lo necesita para editarlo). */
export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error: dbErr } = await supabase
    .from("posi_levels")
    .select("id, level_number, title, intro, questions, skool_course_name")
    .order("level_number", { ascending: true })
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = String((profile as any)?.role ?? "").toLowerCase()

  // skool_course_name no es sensible, pero tampoco le sirve al cliente que
  // completa el formulario — mismo criterio que correct_index: solo admin.
  const levels = isAdmin(role)
    ? (data ?? [])
    : (data ?? []).map((level: any) => {
        const { skool_course_name, ...rest } = level
        return {
          ...rest,
          questions: (level.questions ?? []).map((q: any) => {
            const { correct_index, ...qRest } = q
            return qRest
          }),
        }
      })

  return NextResponse.json({ levels })
}
