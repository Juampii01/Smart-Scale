import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { createServiceClient } from "@/lib/supabase-service"
import { logJobRun } from "@/lib/system-log"
import { resolveClientAndSuggestion } from "@/lib/payments"

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

  Required: set PAYMENT_WEBHOOK_SECRET env var in Vercel.
  Add header  x-webhook-secret: <your_secret>  in Zapier.
*/

const VALID_STATUSES = ["aceptado", "cancelado", "rechazado", "pendiente"]

export async function POST(req: NextRequest) {
  try {
    // Secret check (fail-closed — rejects all requests if env var is not set)
    const secret = process.env.PAYMENT_WEBHOOK_SECRET
    if (!secret) {
      console.error("[webhook/payment] PAYMENT_WEBHOOK_SECRET not configured — rejecting request")
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 })
    }
    const incoming =
      req.headers.get("x-webhook-secret") ??
      req.headers.get("authorization")?.replace("Bearer ", "")
    if (incoming !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    // ── Idempotencia ─────────────────────────────────────────────────────────
    // Zapier reintenta un paso que tardó o falló — sin esto, cada reintento
    // insertaba un pago duplicado. Preferimos el id real del evento/charge de
    // Stripe si viene; si no, una clave sintética por email+monto+día, que no
    // es perfecta (dos pagos legítimos del mismo monto el mismo día colisionan)
    // pero corta la enorme mayoría de los reintentos reales.
    const rawEventId =
      body.id ?? body.event_id ?? body.charge_id ?? body["Charge ID"] ??
      body.payment_intent ?? body.invoice_id ?? null
    const today = new Date().toISOString().slice(0, 10)
    const externalEventId = rawEventId
      ? String(rawEventId).trim()
      : createHash("sha256").update(`${email ?? name}|${amount}|${today}`).digest("hex")

    const supabase = createServiceClient()

    // Best-effort, nunca bloquea el pago: payments no tenía ninguna columna
    // que apuntara a un cliente — conciliar era 100% manual. NUNCA marca
    // paid_at sola: la sugerencia se confirma con un click en /admin/payments.
    const { clientId, suggestedInstallmentId } = await resolveClientAndSuggestion(supabase, email, amount, status)

    // ── Idempotencia (check-then-insert) ────────────────────────────────────
    // El índice único sobre external_event_id quedó creado como parcial
    // (where external_event_id is not null) — Postgres no puede resolver un
    // ON CONFLICT (external_event_id) contra un índice parcial sin repetir
    // el mismo WHERE en el conflicto, y el upsert de supabase-js no lo
    // soporta. Eso rompía TODO insert real con "there is no unique or
    // exclusion constraint matching the ON CONFLICT specification". Se
    // reemplaza por un check-then-insert explícito, que no depende de
    // ON CONFLICT.
    const { data: existing, error: existingError } = await supabase
      .from("payments")
      .select("id")
      .eq("external_event_id", externalEventId)
      .maybeSingle()

    if (existingError) {
      await logJobRun(supabase, "webhook:payment", "error", existingError.message)
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existing) {
      await logJobRun(supabase, "webhook:payment", "ok", `duplicado — ${name} — $${amount}`)
      return NextResponse.json({ success: true, duplicate: true })
    }

    const { data, error } = await supabase
      .from("payments")
      .insert({
        external_event_id: externalEventId,
        name:        String(name).trim(),
        email:       email ? String(email).trim() : null,
        amount,
        status,
        description: description ? String(description).trim() : null,
        client_id:   clientId,
        suggested_installment_id: suggestedInstallmentId,
      })
      .select("id")
      .single()

    if (error) {
      // 23505 = choque real de carrera contra el índice único (dos
      // reintentos casi simultáneos) — se trata igual que un duplicado,
      // no como un fallo real.
      if (error.code === "23505") {
        await logJobRun(supabase, "webhook:payment", "ok", `duplicado (carrera) — ${name} — $${amount}`)
        return NextResponse.json({ success: true, duplicate: true })
      }
      await logJobRun(supabase, "webhook:payment", "error", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logJobRun(supabase, "webhook:payment", "ok", `${name} — $${amount}`)
    return NextResponse.json({ success: true, id: data.id })
  } catch (err: any) {
    await logJobRun(createServiceClient(), "webhook:payment", "error", err?.message ?? "Error interno")
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
