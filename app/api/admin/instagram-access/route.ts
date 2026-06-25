import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { isAdmin } from "@/lib/auth/permissions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Solicitudes de acceso a métricas de Instagram (las del form público /conectar-instagram).
// Requiere la migración 20260623000001_instagram_access_requests.sql.

async function requireAdmin(jwt: string | null) {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!profile || !isAdmin(profile?.role)) return null
  return user
}

const MISSING = (msg: any) =>
  typeof msg === "string" && /does not exist|schema cache|relation .*instagram_access_requests/i.test(msg)

/** GET — lista de solicitudes (más nuevas primero). Tolerante si falta la migración. */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("instagram_access_requests")
      .select("id, name, instagram, email, is_professional, status, created_at")
      .order("created_at", { ascending: false })
      .limit(500)

    if (error) {
      if (MISSING(error.message)) return NextResponse.json({ requests: [], migrated: false })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ requests: data ?? [], migrated: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH — actualizar estado { id, status } */
export async function PATCH(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const allowed = ["nueva", "invitado", "conectado", "rechazado"]
    const status = allowed.includes(body.status) ? body.status : null
    if (!status) return NextResponse.json({ error: "status inválido" }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase.from("instagram_access_requests").update({ status }).eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** DELETE — eliminar solicitud { id }. Solo admin. */
export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase.from("instagram_access_requests").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
