import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"

/*
  Webhook endpoint for Stripe payments via Zapier / Make.

  In Zapier: replace the "Airtable → Create Record" step with
  "Webhooks by Zapier → POST" and point it to:
    https://tu-dominio.com/api/webhooks/payment

  Zapier will send the Stripe payment fields as JSON.
  This handler extracts the relevant ones and inserts into the payments table.

  Optional security: set PAYMENT_WEBHOOK_SECRET env var.
  Add a "Secret" header in Zapier with the same value.
*/

export async function POST(req: NextRequest) {
  try {
    // Optional secret check
    const secret = process.env.PAYMENT_WEBHOOK_SECRET
    if (secret) {
      const incoming = req.headers.get("x-webhook-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "")
      if (incoming !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // ── Extract fields from Stripe payload (via Zapier / Make) ──────────────
    // Stripe sends amounts in cents — divide by 100
    const rawAmount =
      body.amount          ??  // Stripe: amount in cents
      body.amount_total    ??  // Stripe Checkout
      body.amount_received ??  // Payment Intent
      body.grand_total     ??
      0

    const amount = rawAmount > 1000
      ? rawAmount / 100   // likely cents (e.g. 5000 → $50)
      : rawAmount         // already in dollars

    const name =
      body.customer_name          ??
      body.billing_name           ??
      body["Customer Name"]       ??
      body.name                   ??
      body.customer?.name         ??
      body.charges?.data?.[0]?.billing_details?.name ??
      "Stripe Payment"

    const email =
      body.customer_email         ??
      body.billing_email          ??
      body["Customer Email"]      ??
      body.email                  ??
      body.customer?.email        ??
      body.receipt_email          ??
      null

    const description =
      body.description            ??
      body.product_name           ??
      body["Product Name"]        ??
      body.metadata?.description  ??
      null

    // ── Insert into payments table ───────────────────────────────────────────
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("payments")
      .insert({
        name:        String(name).trim(),
        email:       email ? String(email).trim() : null,
        amount:      Number(amount),
        status:      "aceptado",   // confirmed Stripe payment
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
