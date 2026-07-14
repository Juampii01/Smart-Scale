/**
 * PATCH /api/admin/omni/prospecting/patterns/[id]
 *
 * Solo permite actualizar resultado/corrección de un patrón ya cargado (ej:
 * un caso "pendiente" que después cierra o se cae). No se puede editar
 * situacion/enfoque una vez creado — mantiene la integridad del corpus
 * histórico (append-only por diseño).
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const allowed: Record<string, any> = { updated_at: new Date().toISOString() }
  if (body.resultado !== undefined) {
    if (!["cerro", "no_cerro", "pendiente"].includes(body.resultado)) {
      return NextResponse.json({ error: "resultado inválido" }, { status: 400 })
    }
    allowed.resultado = body.resultado
  }
  if (body.correccion !== undefined) {
    allowed.correccion = body.correccion ? String(body.correccion).trim() : null
  }

  const sb = createServiceClient()
  const { error } = await sb
    .from("omni_prospecting_patterns")
    .update(allowed)
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
