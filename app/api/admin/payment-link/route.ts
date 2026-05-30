import { NextRequest, NextResponse } from "next/server"
import { requireInternal } from "@/lib/auth/api-guards"
import Stripe from "stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/payment-link
 * Crea un link de pago en Stripe.
 *
 * Body (pago único):
 *   { type: "once", amount: number, description?: string }
 *
 * Body (en cuotas):
 *   { type: "recurring", amount_per_installment: number, installments: number, description?: string }
 */
export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const caller = await requireInternal(jwt)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: "STRIPE_SECRET_KEY no configurado" }, { status: 500 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const type         = body.type === "recurring" ? "recurring" : "once"
  const description  = body.description ? String(body.description).trim() : "Smart Scale"
  const calendlyUrl  = body.calendly_url ? String(body.calendly_url).trim() : null

  // Validate Calendly URL if provided
  if (calendlyUrl && !calendlyUrl.startsWith("https://")) {
    return NextResponse.json({ error: "calendly_url debe empezar con https://" }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any })

  // after_completion: redirect to Calendly (or default Stripe confirmation page)
  const afterCompletion: Stripe.PaymentLinkCreateParams["after_completion"] = calendlyUrl
    ? { type: "redirect", redirect: { url: calendlyUrl } }
    : { type: "hosted_confirmation" }

  try {
    if (type === "once") {
      const amount = Number(body.amount)
      if (!amount || amount <= 0)
        return NextResponse.json({ error: "Monto inválido" }, { status: 400 })

      const price = await stripe.prices.create({
        currency:    "usd",
        unit_amount: Math.round(amount * 100),
        product_data: { name: description },
      })

      const link = await stripe.paymentLinks.create({
        line_items:       [{ price: price.id, quantity: 1 }],
        after_completion: afterCompletion,
      })

      return NextResponse.json({ ok: true, paymentUrl: link.url, type: "once", amount, calendly_url: calendlyUrl })

    } else {
      const amountPerInstallment = Number(body.amount_per_installment)
      const installments         = Number(body.installments)

      if (!amountPerInstallment || amountPerInstallment <= 0)
        return NextResponse.json({ error: "Monto por cuota inválido" }, { status: 400 })
      if (!installments || installments < 1 || installments > 24)
        return NextResponse.json({ error: "Cantidad de cuotas debe ser entre 1 y 24" }, { status: 400 })

      const total = amountPerInstallment * installments

      const price = await stripe.prices.create({
        currency:    "usd",
        unit_amount: Math.round(amountPerInstallment * 100),
        recurring:   { interval: "month" },
        product_data: { name: `${description} (${installments} cuotas de $${amountPerInstallment})` },
      })

      const link = await stripe.paymentLinks.create({
        line_items:        [{ price: price.id, quantity: 1 }],
        subscription_data: { description: `${installments} cuotas — Total $${total}` },
        after_completion:  afterCompletion,
      })

      return NextResponse.json({
        ok:                     true,
        paymentUrl:             link.url,
        type:                   "recurring",
        amount_per_installment: amountPerInstallment,
        installments,
        total,
        calendly_url:           calendlyUrl,
      })
    }
  } catch (err: any) {
    const msg = err?.message ?? "Error al crear link de pago"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
