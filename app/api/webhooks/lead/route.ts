import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { logJobRun } from "@/lib/system-log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/webhooks/lead
 *
 * Receives a webhook from any CRM (GoHighLevel, ActiveCampaign, HubSpot,
 * ManyChat, Zapier…) when a tag is applied to a lead, and saves the lead to
 * the `leads` table, en el sector interno de Smart Scale (Ann).
 *
 * Required: set WEBHOOK_SECRET in Vercel env vars.
 * Configure your CRM to send the header:  X-Webhook-Secret: <your_secret>
 *
 * The endpoint tries to extract these fields from ANY JSON payload shape:
 *   name, email, instagram (o ig_username, formato ManyChat), tag, source,
 *   avatar_url (o profile_pic, formato ManyChat)
 * `tag` también puede venir como query param (?tag=Interesado) — pensado
 * para ManyChat, que no tiene un merge field nativo con el nombre de la
 * etiqueta que disparó el flow; cada flow de ManyChat apunta a esta misma
 * URL con un `?tag=` distinto. Si el tag vino por query param, `source` se
 * completa "ManyChat" por default cuando el payload no trae uno explícito.
 * `rating` siempre entra en 4 (no hay CRM que lo mande hoy).
 *
 * The full raw payload is always stored in raw_payload for future reference.
 */
export async function POST(req: NextRequest) {
  try {
    // ── Secret verification (fail-closed) ───────────────────────────────────
    const webhookSecret = process.env.WEBHOOK_SECRET
    // If WEBHOOK_SECRET is not configured, reject all requests rather than
    // silently accepting them. Set the env var in Vercel before deploying.
    if (!webhookSecret) {
      console.error("[webhook/lead] WEBHOOK_SECRET not configured — rejecting request")
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 })
    }
    const incoming =
      req.headers.get("x-webhook-secret") ??
      req.headers.get("x-secret") ??
      req.headers.get("authorization")?.replace("Bearer ", "") ??
      null
    if (incoming !== webhookSecret) {
      console.warn("[webhook/lead] invalid secret")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    const firstName = (contact?.first_name ?? contact?.firstName ?? "") as string
    const lastName  = (contact?.last_name  ?? contact?.lastName  ?? "") as string
    const name =
      contact?.full_name ??
      contact?.fullName  ??
      contact?.name      ??
      ([firstName, lastName].filter(Boolean).join(" ") || null)

    const email =
      contact?.email ??
      contact?.email_address ??
      raw?.email ??
      null

    // Nota: la tabla `leads` NO tiene columna `phone` (se eliminó a propósito).
    // El teléfono, si viene en el payload, queda guardado en raw_payload.

    const instagram =
      contact?.instagram        ??
      contact?.instagramHandle  ??
      contact?.instagram_handle ??
      contact?.ig_username      ?? // ManyChat: merge field {{ig_username}}
      contact?.customField?.instagram ??
      raw?.instagram            ??
      raw?.ig_username          ??
      null

    // ManyChat no tiene un merge field con "la etiqueta que disparó este
    // flow" — el patrón recomendado es que cada flow (uno por etiqueta)
    // pegue a esta misma URL con `?tag=NombreEtiqueta` en vez de mandarlo
    // en el body. Se prueba el body primero (otros CRMs sí lo mandan ahí),
    // y si no vino nada se cae al query param.
    const tagFromQuery = req.nextUrl.searchParams.get("tag")
    const tag =
      // GHL sends tags as array — join them
      (Array.isArray(contact?.tags)  ? contact.tags.join(", ") : null) ??
      (Array.isArray(raw?.tags)      ? raw.tags.join(", ")     : null) ??
      contact?.tag ??
      raw?.tag     ??
      raw?.label   ??
      tagFromQuery ??
      null

    // Si el tag vino por query param es porque es el patrón de ManyChat
    // (ver comment arriba) — en ese caso, si no vino "source" explícito en
    // el payload, se completa "ManyChat" para que el campo "Desde dónde
    // llegó" no quede vacío en /admin/leads.
    const source =
      contact?.source       ??
      contact?.lead_source  ??
      contact?.leadSource   ??
      raw?.source           ??
      (tagFromQuery ? "ManyChat" : null)

    // Ningún CRM conectado hoy manda un rating — se asume 4/5 estrellas por
    // default (pedido explícito) para que el lead caiga directo en la vista
    // "4 estrellas" de /admin/leads en vez de quedar sin calificar.
    const ratingRaw = contact?.rating ?? raw?.rating ?? null
    const rating =
      ratingRaw !== null && Number.isFinite(Number(ratingRaw))
        ? Math.min(5, Math.max(1, Math.round(Number(ratingRaw))))
        : 4

    // ManyChat: merge field {{profile_pic}} — URL de la foto de perfil de
    // Instagram/Messenger del contacto.
    const avatarUrl =
      contact?.profile_pic  ??
      contact?.profilePic   ??
      contact?.avatar_url   ??
      contact?.avatar       ??
      raw?.profile_pic      ??
      raw?.avatar_url       ??
      null

    // ── Insert into Supabase ──────────────────────────────────────────────────
    const supabase = createServiceClient()

    // `leads.client_id` es NOT NULL (sector interno multi-tenant) — este
    // webhook siempre entra al sector de Smart Scale (Ann), nunca al de un
    // cliente, porque el ManyChat que lo dispara es el propio de Ann.
    const { data: workspace, error: workspaceError } = await supabase
      .from("clients")
      .select("id")
      .eq("is_internal_workspace", true)
      .single()

    if (workspaceError || !workspace) {
      console.error("[webhook/lead] no se encontró el workspace interno:", workspaceError?.message)
      await logJobRun(supabase, "webhook:lead", "error", "Workspace interno no encontrado")
      return NextResponse.json({ error: "Internal workspace not found" }, { status: 500 })
    }

    const { error } = await supabase.from("leads").insert({
      client_id:   workspace.id,
      name:        name        || null,
      email:       email       || null,
      instagram:   instagram   || null,
      tag:         tag         || null,
      source:      source      || null,
      rating,
      avatar_url:  avatarUrl   || null,
      status:      "nuevo",
      raw_payload: raw,
    })

    if (error) {
      console.error("[webhook/lead] db error:", error.message)
      await logJobRun(supabase, "webhook:lead", "error", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[webhook/lead] lead saved:", { name, email, tag })
    await logJobRun(supabase, "webhook:lead", "ok", `${name ?? "sin nombre"} (${tag ?? "sin tag"})`)
    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error("[webhook/lead] error:", err)
    await logJobRun(createServiceClient(), "webhook:lead", "error", err?.message ?? "Error interno")
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
