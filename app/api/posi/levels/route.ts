import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET — lista los 8 niveles de Posi. Nunca manda correct_index al cliente
 *  (solo el equipo interno lo ve, vía ?admin=1). */
export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error: dbErr } = await supabase
    .from("posi_levels")
    .select("id, level_number, title, description, questions, passing_score")
    .order("level_number", { ascending: true })
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const wantsAnswers = req.nextUrl.searchParams.get("admin") === "1" && !!(await requireInternal(jwt))

  const levels = (data ?? []).map((lvl: any) => ({
    ...lvl,
    questions: wantsAnswers
      ? lvl.questions
      : (lvl.questions ?? []).map((q: any) => {
          const { correct_index, ...rest } = q
          return rest
        }),
  }))

  return NextResponse.json({ levels })
}
