import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireAdmin(jwt: string | null) {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!isAdmin(profile?.role)) return null
  return user
}

const SELECT_COLS =
  "id, role, first_name, last_name, email, whatsapp, instagram_handle, answers, status, notes, created_at, updated_at"

/** GET — todos los team_applications, ordenados por created_at desc.
 *  ?role=setter para filtrar por rol. */
export async function GET(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const roleFilter = searchParams.get("role")

    const supabase = createServiceClient()
    let query = supabase
      .from("team_applications")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .limit(500)

    if (roleFilter) query = query.eq("role", roleFilter)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ applications: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH — actualizar status/notes (campos administrativos). */
export async function PATCH(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const PATCHABLE = ["status", "notes"]
    const allowed: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of PATCHABLE) {
      if (updates[key] !== undefined) allowed[key] = updates[key]
    }

    const supabase = createServiceClient()
    const { error } = await supabase.from("team_applications").update(allowed).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** DELETE — borrar una aplicación. */
export async function DELETE(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase.from("team_applications").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
