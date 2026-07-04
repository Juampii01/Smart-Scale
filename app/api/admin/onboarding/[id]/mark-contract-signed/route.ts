/**
 * POST /api/admin/onboarding/[id]/mark-contract-signed
 *
 * Override manual — para cuando el webhook de GHL no se disparó y hay que
 * desbloquear el flujo a mano. `id` es el crm_client_id. Llama a la misma
 * triggerContractSigned() que usa el webhook, así que es idempotente.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { triggerContractSigned } from "@/lib/onboarding-flow"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const caller = await requireInternal(jwt)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const sb = createServiceClient()
  const result = await triggerContractSigned(sb, id)

  if (!result.ok && !result.alreadyProcessed) {
    return NextResponse.json({ error: result.error ?? "No se pudo marcar el contrato como firmado" }, { status: 500 })
  }
  return NextResponse.json({ ok: true, alreadyProcessed: result.alreadyProcessed })
}
