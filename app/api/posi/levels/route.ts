import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET — lista los 9 niveles de Posi (0-8), sin scoring. */
export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error: dbErr } = await supabase
    .from("posi_levels")
    .select("id, level_number, title, intro, questions")
    .order("level_number", { ascending: true })
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ levels: data ?? [] })
}
