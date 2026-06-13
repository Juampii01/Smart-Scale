/**
 * Panel admin para lanzar notificaciones push manualmente.
 *  GET  → conteo de suscripciones por audiencia (para el preview de alcance).
 *  POST → envía la notificación a la audiencia elegida.
 * Solo admin.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"
import { sendPushToUser, sendPushToUsers } from "@/lib/push"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const INTERNAL_ROLES = ["admin", "developer", "team", "setter"]

type Audience = "clients" | "internal" | "all" | "me"

async function clientUserIds(sb: ReturnType<typeof createServiceClient>): Promise<string[]> {
  const { data } = await sb.from("profiles").select("id").eq("role", "client").not("client_id", "is", null)
  return (data ?? []).map((p: any) => p.id)
}
async function internalUserIds(sb: ReturnType<typeof createServiceClient>): Promise<string[]> {
  const { data } = await sb.from("profiles").select("id").in("role", INTERNAL_ROLES)
  return (data ?? []).map((p: any) => p.id)
}
async function allSubscribedUserIds(sb: ReturnType<typeof createServiceClient>): Promise<string[]> {
  const { data } = await sb.from("push_subscriptions").select("user_id")
  return Array.from(new Set((data ?? []).map((s: any) => s.user_id)))
}

/** Cuántas suscripciones (dispositivos) hay para un set de user_ids. */
async function subCount(sb: ReturnType<typeof createServiceClient>, userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0
  const { count } = await sb.from("push_subscriptions").select("id", { count: "exact", head: true }).in("user_id", userIds)
  return count ?? 0
}

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const [clients, internal] = await Promise.all([clientUserIds(sb), internalUserIds(sb)])
  const [clientsSubs, internalSubs, allSubs] = await Promise.all([
    subCount(sb, clients),
    subCount(sb, internal),
    sb.from("push_subscriptions").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
  ])
  return NextResponse.json({
    reach: { clients: clientsSubs, internal: internalSubs, all: allSubs },
  })
}

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: { title?: string; body?: string; url?: string; audience?: Audience }
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }

  const title = (body.title ?? "").trim()
  const text = (body.body ?? "").trim()
  const url = (body.url ?? "").trim() || "/dashboard"
  const audience = body.audience ?? "clients"

  if (!title) return NextResponse.json({ error: "Falta el título" }, { status: 400 })
  if (!text) return NextResponse.json({ error: "Falta el mensaje" }, { status: 400 })
  if (!["clients", "internal", "all", "me"].includes(audience)) {
    return NextResponse.json({ error: "Audiencia inválida" }, { status: 400 })
  }

  const sb = createServiceClient()
  const payload = { title, body: text, url }

  if (audience === "me") {
    await sendPushToUser(sb, user.id, payload)
    return NextResponse.json({ ok: true, recipients: 1, audience })
  }

  const userIds =
    audience === "clients" ? await clientUserIds(sb) :
    audience === "internal" ? await internalUserIds(sb) :
    await allSubscribedUserIds(sb)

  const devices = await subCount(sb, userIds)
  await sendPushToUsers(sb, userIds, payload)
  return NextResponse.json({ ok: true, recipients: userIds.length, devices, audience })
}
