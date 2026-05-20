import { NextRequest, NextResponse } from "next/server"
import { requireInternal } from "@/lib/auth/api-guards"
import { findGHLContactByEmail, createGHLInvoice } from "@/lib/ghl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/payment-link
 * Crea una invoice en GHL y devuelve el link de pago.
 * Body: { email, amount, description? }
 */
export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const caller = await requireInternal(jwt)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email       = String(body.email ?? "").trim().toLowerCase()
  const amount      = Number(body.amount)
  const description = body.description ? String(body.description).trim() : null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Email inválido" }, { status: 400 })

  if (!amount || amount <= 0)
    return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 })

  // 1. Buscar el contacto en GHL por email
  const contactId = await findGHLContactByEmail(email)
  if (!contactId)
    return NextResponse.json({ error: "No se encontró el contacto en GHL. Primero completá el onboarding." }, { status: 404 })

  // 2. Crear invoice en GHL
  const invoiceName = description || `Pago Smart Scale — $${amount}`
  const result = await createGHLInvoice({
    contactId,
    name:        invoiceName,
    amount,
    description: invoiceName,
  })

  if (!result.success)
    return NextResponse.json({ error: result.error ?? "Error al crear el link de pago" }, { status: 500 })

  return NextResponse.json({
    ok:         true,
    paymentUrl: result.paymentUrl,
    invoiceId:  result.invoiceId,
  })
}
