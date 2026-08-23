import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { resolveInternalScope } from "@/lib/auth/internal-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET — cantidad de onboardings reales completados en un mes.
 * ?month=YYYY-MM — requerido
 *
 * "Onboarding hecho" = onboarding_flow.contract_signed_at cae en el mes
 * (mismo trigger que dispara los 3 emails de bienvenida). Se compara contra
 * setting_daily_logs.cierres (carga manual del setter) para ver si hay
 * cierres sin onboarding todavía.
 */
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveInternalScope(req, req.nextUrl.searchParams.get("client_id"))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const month = req.nextUrl.searchParams.get("month")
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month (YYYY-MM) is required" }, { status: 400 })
    }

    const [y, m] = month.split("-").map(Number)
    const monthStart = new Date(y, m - 1, 1).toISOString()
    const monthEndExclusive = new Date(y, m, 1).toISOString()

    const supabase = createServiceClient()
    // onboarding_flow no tiene client_id propio — se scopea por tenant a
    // través de su crm_clients padre (crm_client_id).
    const { count, error } = await supabase
      .from("onboarding_flow")
      .select("id, crm_clients!inner(client_id)", { count: "exact", head: true })
      .gte("contract_signed_at", monthStart)
      .lt("contract_signed_at", monthEndExclusive)
      .eq("crm_clients.client_id", scope.tenantId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ count: count ?? 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
