import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { isAdmin } from "@/lib/auth/permissions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Definiciones de columnas custom para la tabla de leads (estilo Airtable).
// Requiere la migración 20260622000001_lead_custom_columns.sql. Si la tabla
// todavía no existe, GET devuelve [] (degradación elegante) y POST avisa.

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

function slugify(s: string) {
  const base = s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
  return base || "campo"
}

const MISSING = (msg: any) =>
  typeof msg === "string" && /relation .*lead_columns.* does not exist|does not exist|schema cache/i.test(msg)

/** GET — lista de columnas custom (ordenadas). Tolerante si la tabla no existe. */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("lead_columns")
      .select("id, key, label, type, position")
      .order("position", { ascending: true })

    if (error) {
      if (MISSING(error.message)) return NextResponse.json({ columns: [], migrated: false })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ columns: data ?? [], migrated: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** POST — crear columna { label, type } */
export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const label = String(body.label ?? "").trim()
    const type  = body.type === "number" ? "number" : "text"
    if (!label) return NextResponse.json({ error: "label is required" }, { status: 400 })

    const supabase = createServiceClient()

    // Posición = al final
    const { data: last } = await supabase
      .from("lead_columns").select("position").order("position", { ascending: false }).limit(1).maybeSingle()
    const position = ((last?.position as number) ?? -1) + 1

    // Clave estable y única
    const key = `${slugify(label)}_${Math.random().toString(36).slice(2, 6)}`

    const { data, error } = await supabase
      .from("lead_columns")
      .insert({ key, label, type, position })
      .select("id, key, label, type, position")
      .single()

    if (error) {
      if (MISSING(error.message)) {
        return NextResponse.json({ error: "Aplicá la migración 20260622000001_lead_custom_columns.sql primero." }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ column: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** DELETE — eliminar columna { id }. Solo admin. */
export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase.from("lead_columns").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
