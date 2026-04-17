import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/webhooks/lead
 *
 * Receives a webhook from any CRM (GoHighLevel, ActiveCampaign, HubSpot, Zapier…)
 * when a tag is applied to a lead, and saves the lead to the `leads` table.
 *
 * Optional security: set WEBHOOK_SECRET in your env vars.
 * Then configure your CRM to send the header:  X-Webhook-Secret: <your_secret>
 *
 * The endpoint tries to extract these fields from ANY JSON payload shape:
 *   name, email, phone, instagram, tag, source
 *
 * The full raw payload is always stored in raw_payload for future reference.
 */
export async function POST(req: NextRequest) {
  try {
    // ── Optional secret verification ────────────────────────────────────────
    const webhookSecret = process.env.WEBHOOK_SECRET
    if (webhookSecret) {
      const incoming =
        req.headers.get("x-webhook-secret") ??
        req.headers.get("x-secret") ??
        req.headers.get("authorization")?.replace("Bearer ", "") ??
        null

      if (incoming !== webhookSecret) {
        console.warn("[webhook/lead] invalid secret")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // ── Parse body ───────────────────────────────────────────────────────────
    let raw: any
    try { raw = await req.json() } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    console.log("[webhook/lead] received payload keys:", Object.keys(raw ?? {}).join(", "))

    // ── Field extraction — works with most CRM payload shapes ────────────────
    // Supports flat payloads AND nested (e.g. GHL's contact object)
    const contact = raw?.contact ?? raw?.data?.contact ?? raw?.data ?? raw

    const name =
      contact?.full_name ??
      contact?.fullName  ??
      contact?.name      ??
      [contact?.first_name ?? contact?.firstName, contact?.last_name ?? contact?.lastName]
        .filter(Boolean).join(" ") || null

    const email =
      contact?.email ??
      contact?.email_address ??
      raw?.email ??
      null

    const phone =
      contact?.phone         ??
      contact?.phone_number  ??
      contact?.phoneNumber   ??
      contact?.mobile        ??
      raw?.phone             ??
      null

    const instagram =
      contact?.instagram        ??
      contact?.instagramHandle  ??
      contact?.instagram_handle ??
      contact?.customField?.instagram ??
      raw?.instagram            ??
      null

    const tag =
      // GHL sends tags as array — join them
      (Array.isArray(contact?.tags)  ? contact.tags.join(", ") : null) ??
      (Array.isArray(raw?.tags)      ? raw.tags.join(", ")     : null) ??
      contact?.tag ??
      raw?.tag     ??
      raw?.label   ??
      null

    const source =
      contact?.source       ??
      contact?.lead_source  ??
      contact?.leadSource   ??
      raw?.source           ??
      null

    // ── Insert into Supabase ──────────────────────────────────────────────────
    const supabase = createServiceClient()
    const { error } = await supabase.from("leads").insert({
      name:        name        || null,
      email:       email       || null,
      phone:       phone       || null,
      instagram:   instagram   || null,
      tag:         tag         || null,
      source:      source      || null,
      status:      "nuevo",
      raw_payload: raw,
    })

    if (error) {
      console.error("[webhook/lead] db error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[webhook/lead] lead saved:", { name, email, tag })
    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error("[webhook/lead] error:", err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
