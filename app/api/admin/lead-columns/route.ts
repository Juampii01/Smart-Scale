import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"
import { resolveInternalScope } from "@/lib/auth/internal-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Definiciones de columnas custom para la tabla de leads (estilo Airtable).
// Requiere la migración 20260622000001_lead_custom_columns.sql. Si la tabla
// todavía no existe, GET devuelve [] (degradación elegante) y POST avisa.

function slugify(s: string) {
  const base = s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
  return base || "campo"
}

function requestedTenantId(req: NextRequest, body?: any): string | null {
  return req.nextUrl.searchParams.get("client_id") ?? body?.client_id ?? null
}

const MISSING = (msg: any) =>
  typeof msg === "string" && /relation .*lead_columns.* does not exist|does not exist|schema cache/i.test(msg)

/** GET — lista de columnas custom del tenant (ordenadas). Tolerante si la tabla no existe. */
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveInternalScope(req, requestedTenantId(req))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("lead_columns")
      .select("id, key, label, type, position")
      .eq("client_id", scope.tenantId)
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
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const label = String(body.label ?? "").trim()
    const type  = body.type === "number" ? "number" : "text"
    if (!label) return NextResponse.json({ error: "label is required" }, { status: 400 })

    const supabase = createServiceClient()

    // Posición = al final, dentro del tenant
    const { data: last } = await supabase
      .from("lead_columns").select("position").eq("client_id", scope.tenantId).order("position", { ascending: false }).limit(1).maybeSingle()
    const position = ((last?.position as number) ?? -1) + 1

    // Clave estable y única (dentro del tenant)
    const key = `${slugify(label)}_${Math.random().toString(36).slice(2, 6)}`

    const { data, error } = await supabase
      .from("lead_columns")
      .insert({ client_id: scope.tenantId, key, label, type, position })
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
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    if (!isAdmin(scope.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { error } = await supabase.from("lead_columns").delete().eq("id", body.id).eq("client_id", scope.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
