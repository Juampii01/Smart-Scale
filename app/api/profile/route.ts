import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

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

/** GET — datos básicos del perfil (nombre + email) */
export async function GET(req: NextRequest) {
  const ctx = await getUser(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { user, sb } = ctx

  const { data } = await sb.from("profiles").select("name, role").eq("id", user.id).maybeSingle()
  return NextResponse.json({
    name: (data as any)?.name ?? null,
    role: (data as any)?.role ?? null,
    email: user.email ?? null,
  })
}

/** PATCH — actualiza el nombre (profiles.name solo se puede tocar con service role) */
export async function PATCH(req: NextRequest) {
  const ctx = await getUser(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { user, sb } = ctx

  let body: { name?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }

  if (typeof body.name !== "string") {
    return NextResponse.json({ error: "Falta el nombre" }, { status: 400 })
  }
  const name = body.name.trim()
  if (name.length < 2) return NextResponse.json({ error: "El nombre es muy corto" }, { status: 400 })
  if (name.length > 60) return NextResponse.json({ error: "El nombre es muy largo (máx 60)" }, { status: 400 })

  const { error } = await sb.from("profiles").update({ name }).eq("id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ name })
}
