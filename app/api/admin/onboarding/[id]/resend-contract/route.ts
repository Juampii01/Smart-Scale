/**
 * POST /api/admin/onboarding/[id]/resend-contract
 *
 * Regenera el contrato de SignNow de un cliente YA onboardeado — para casos
 * donde el documento salió mal por algo ajeno al cliente (ej. la plantilla
 * tenía un dato viejo pegado) y no hace falta rehacer el onboarding entero
 * (cuenta, cuotas y acceso al portal quedan intactos). `id` es el
 * crm_client_id. Cancela (best-effort) la invitación del documento viejo
 * para que el cliente no firme por error la versión con el dato mal.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { sendContractForSignature, cancelContractInvite } from "@/lib/signnow"

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

  const { data: client, error: clientErr } = await sb
    .from("crm_clients")
    .select("id, name, email, address, programa, total_amount")
    .eq("id", id)
    .maybeSingle()
  if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 })
  if (!client) {
    // DEBUG temporal — sacar después de diagnosticar el 404 fantasma en producción.
    console.error("[resend-contract] cliente no encontrado — id recibido:", JSON.stringify(id), "len:", id?.length)
    return NextResponse.json({ error: "Cliente no encontrado", debug_id: id }, { status: 404 })
  }

  const { data: installments, error: instErr } = await sb
    .from("crm_installments")
    .select("installment_number, amount")
    .eq("client_id", id)
    .order("installment_number", { ascending: true })
  if (instErr) return NextResponse.json({ error: instErr.message }, { status: 500 })

  const primerPago = (installments ?? []).find(i => (i as any).installment_number === 1)?.amount ?? null
  const cuotas: Record<string, number> = {}
  for (const inst of installments ?? []) {
    const n = (inst as any).installment_number
    if (n >= 2) cuotas[`cuota_${n}`] = Number((inst as any).amount)
  }

  const { data: flow } = await sb
    .from("onboarding_flow")
    .select("signnow_document_id")
    .eq("crm_client_id", id)
    .maybeSingle()
  const oldDocumentId = (flow as any)?.signnow_document_id ?? null

  const result = await sendContractForSignature({
    clienteNombre: (client as any).name,
    clienteEmail: (client as any).email,
    clienteAddress: (client as any).address,
    program: (client as any).programa,
    totalAmount: Number((client as any).total_amount ?? 0),
    primerPago: primerPago != null ? Number(primerPago) : undefined,
    cuotas,
    cantidadMeses: (installments ?? []).length || undefined,
  })

  if (!result?.document_id) {
    return NextResponse.json({ error: "No se pudo generar el contrato en SignNow" }, { status: 500 })
  }

  const { error: updateErr } = await sb
    .from("onboarding_flow")
    .update({ signnow_document_id: result.document_id, contract_signed_at: null, updated_at: new Date().toISOString() })
    .eq("crm_client_id", id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  let oldInviteCancelled = false
  if (oldDocumentId) {
    oldInviteCancelled = await cancelContractInvite(oldDocumentId)
  }

  return NextResponse.json({ ok: true, document_id: result.document_id, old_invite_cancelled: oldInviteCancelled })
}
