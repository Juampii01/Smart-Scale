import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"

/*
  Webhook endpoint for Stripe payments via Zapier / Make.

  URL: https://tu-dominio.com/api/webhooks/payment
  Payload Type: JSON

  Map these fields in Zapier's Data section:
    name        → Customer Name  (from Stripe trigger)
    email       → Customer Email
    amount      → Amount         (Stripe sends cents: 40000 = $400)
    description → Description or Product Name
    status      → "aceptado" | "cancelado"   ← set manually or from Stripe event

  Optional security: set PAYMENT_WEBHOOK_SECRET env var in Vercel.
  Add header  x-webhook-secret: <your_secret>  in Zapier.
*/

const VALID_STATUSES = ["aceptado", "cancelado", "rechazado", "pendiente"]

export async function POST(req: NextRequest) {
  try {
    // Optional secret check
    const secret = process.env.PAYMENT_WEBHOOK_SECRET
    if (secret) {
      const incoming =
        req.headers.get("x-webhook-secret") ??
        req.headers.get("authorization")?.replace("Bearer ", "")
      if (incoming !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // ── Amount ───────────────────────────────────────────────────────────────
    // Zapier's Stripe integration already converts cents to dollars
    // (e.g. Stripe's 200000 cents → Zapier sends 2000 for $2,000).
    // So we use the value as-is — no division needed.
    const rawAmount =
      body.amount          ??
      body.amount_total    ??
      body.amount_received ??
      body.grand_total     ??
      0

    const amount = Number(rawAmount)

    // ── Name ─────────────────────────────────────────────────────────────────
    const name =
      body.name                                                   ??
      body.customer_name                                          ??
      body.billing_name                                           ??
      body["Customer Name"]                                       ??
      body.customer?.name                                         ??
      body.charges?.data?.[0]?.billing_details?.name             ??
      "Stripe Payment"

    // ── Email ─────────────────────────────────────────────────────────────────
    const email =
      body.email               ??
      body.customer_email      ??
      body.billing_email       ??
      body["Customer Email"]   ??
      body.customer?.email     ??
      body.receipt_email       ??
      null

    // ── Description ───────────────────────────────────────────────────────────
    const description =
      body.description         ??
      body.product_name        ??
      body["Product Name"]     ??
      body.metadata?.description ??
      null

    // ── Status ───────────────────────────────────────────────────────────────
    // Zapier can send status = "aceptado" | "cancelado" | "rechazado" | "pendiente"
    // Defaults to "aceptado" for successful Stripe payments.
    const rawStatus = String(body.status ?? "aceptado").toLowerCase().trim()
    const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : "aceptado"

    // ── Insert ────────────────────────────────────────────────────────────────
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("payments")
      .insert({
        name:        String(name).trim(),
        email:       email ? String(email).trim() : null,
        amount,
        status,
        description: description ? String(description).trim() : null,
      })
      .select("id")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
