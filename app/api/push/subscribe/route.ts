import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { resolveTeamName } from "@/lib/team"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function getUser(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  if (!jwt) return null
  const sb = createServiceClient()
  const { data: { user }, error } = await sb.auth.getUser(jwt)
  if (error || !user) return null
  return { user, sb }
}

/** POST — guardar/actualizar la suscripción push del usuario */
export async function POST(req: NextRequest) {
  const ctx = await getUser(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { user, sb } = ctx

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const sub = body?.subscription
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 })
  }

  const email = (user as { email?: string }).email ?? null
  const name  = resolveTeamName(email)

  const { error } = await sb.from("push_subscriptions").upsert({
    user_id:    user.id,
    name,
    endpoint:   sub.endpoint,
    p256dh:     sub.keys.p256dh,
    auth:       sub.keys.auth,
    user_agent: req.headers.get("user-agent") ?? null,
  }, { onConflict: "endpoint" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** DELETE — desuscribir (por endpoint en body) */
export async function DELETE(req: NextRequest) {
  const ctx = await getUser(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { sb } = ctx

  let body: any = {}
  try { body = await req.json() } catch {}
  if (!body.endpoint) return NextResponse.json({ error: "endpoint requerido" }, { status: 400 })

  const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", body.endpoint)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
