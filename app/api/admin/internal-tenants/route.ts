import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requirePlatformOwner } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/internal-tenants
 *
 * Lista de tenants del sector interno (`clients` completa, incluida la fila
 * de Smart Scale). Exclusivo del platform owner — alimenta el selector de
 * "Sector interno" al crear usuarios y el de "Ver Clientes".
 */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const owner = await requirePlatformOwner(jwt)
    if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, nombre, is_internal_workspace")
      .order("is_internal_workspace", { ascending: false })
      .order("name", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ tenants: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
