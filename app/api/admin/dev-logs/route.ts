import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_LOGS = 500 // máximo a devolver por página

/** GET — últimos logs, filtrable por level */
export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = req.nextUrl
  const level  = searchParams.get("level")   // error | warn | info | debug | null (todos)
  const limit  = Math.min(Number(searchParams.get("limit") ?? MAX_LOGS), MAX_LOGS)
  const before = searchParams.get("before")  // cursor: id para paginación

  const sb = createServiceClient()
  let q = sb
    .from("app_logs")
    .select("id, level, route, message, context, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (level && ["error", "warn", "info", "debug"].includes(level)) {
    q = q.eq("level", level)
  }
  if (before) {
    q = q.lt("id", Number(before))
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: (data ?? []).reverse() }) // cronológico asc
}

/** DELETE — limpia logs más viejos de N días (default 7) o todos */
export async function DELETE(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  let body: any = {}
  try { body = await req.json() } catch {}

  if (body.all) {
    const { error } = await sb.from("app_logs").delete().neq("id", 0)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, deleted: "all" })
  }

  // Por defecto: borrar más viejos de 7 días
  const days = Number(body.days ?? 7)
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await sb.from("app_logs").delete().lt("created_at", cutoff)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, deleted: `older than ${days} days` })
}
