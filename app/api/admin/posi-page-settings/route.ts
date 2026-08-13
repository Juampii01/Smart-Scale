import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET — título/subtítulo fijo de la página Founder → POSI */
export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("posi_page_settings")
    .select("title, subtitle")
    .eq("id", "posi")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data ?? { title: "POSI", subtitle: "" } })
}

/** PATCH — admin edita el título/subtítulo */
export async function PATCH(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { title, subtitle } = body ?? {}
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (title !== undefined) update.title = title
  if (subtitle !== undefined) update.subtitle = subtitle

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("posi_page_settings")
    .update(update)
    .eq("id", "posi")
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
