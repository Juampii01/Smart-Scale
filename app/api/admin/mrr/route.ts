import { NextRequest, NextResponse } from "next/server"
import { requireSmartScaleInternal } from "@/lib/auth/api-guards"
import { getSmartScaleTenantId } from "@/lib/auth/internal-scope"
import { createServiceClient } from "@/lib/supabase-service"
import { calculateCompanyMRR } from "@/lib/calculations/mrr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/mrr?month=YYYY-MM
 *
 * MRR calculado de TODA la empresa (todos los crm_clients activos), no de
 * un cliente puntual — solo admin. Usado para:
 *  - pre-llenar el campo MRR del Reporte Mensual de Ann/Smart Scale
 *  - el bloque MRR del Dashboard Ejecutivo
 */
export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const caller = await requireSmartScaleInternal(jwt)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month (YYYY-MM) is required" }, { status: 400 })
  }

  const smartScaleTenantId = await getSmartScaleTenantId(createServiceClient())
  if (!smartScaleTenantId) {
    return NextResponse.json({ error: "No se encontró el tenant interno de Smart Scale" }, { status: 500 })
  }

  const { mrr, breakdown } = await calculateCompanyMRR(`${month}-01`, smartScaleTenantId)
  return NextResponse.json({ mrr, breakdown })
}
