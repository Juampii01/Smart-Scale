import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { enqueueEvents, fireEventDispatcher, EventPayload } from "@/lib/events"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"


export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ───────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") ?? ""
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id
    const userEmail = user.email ?? null

    // ── 2. Parse body ─────────────────────────────────────────────────────────
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const clientId = typeof body.client_id === "string" ? body.client_id : null
    const rawMonth = typeof body.month === "string" ? body.month : null

    if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 })
    if (!rawMonth) return NextResponse.json({ error: "month is required" }, { status: 400 })

    // ── 3. Ownership check (A-02) ─────────────────────────────────────────────
    // admin/team can write any client's report; clients can only write their own.
    const { data: prof } = await supabase
      .from("profiles")
      .select("role, client_id")
      .eq("id", userId)
      .maybeSingle()

    const callerRole = String(prof?.role ?? "").toLowerCase()
    const isStaff = callerRole === "admin" || callerRole === "team"

    if (!isStaff) {
      const ownClientId = (prof as any)?.client_id ?? null
      if (!ownClientId || ownClientId !== clientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const monthValue = /^\d{4}-\d{2}$/.test(rawMonth) ? `${rawMonth}-01` : rawMonth

    // ── 4. Build upsert payload ───────────────────────────────────────────────
    const NUMERIC_FIELDS = [
      "total_revenue", "cash_collected", "mrr", "ad_spend",
      "software_costs", "variable_costs",
      "scheduled_calls", "attended_calls", "qualified_calls",
      "aplications", "new_clients", "active_clients",
      "inbound_messages",
      "offer_docs_sent", "offer_docs_responded", "cierres_por_offerdoc",
      "short_followers", "short_reach", "short_posts",
      "yt_subscribers", "yt_monthly_audience", "yt_views",
      "yt_watch_time", "yt_new_subscribers", "yt_videos",
      "email_subscribers", "email_new_subscribers",
    ] as const

    const TEXT_FIELDS = [
      "biggest_win", "next_focus", "support_needed",
      "improvements", "report_date",
    ] as const

    const reportRow: Record<string, unknown> = {
      client_id: clientId,
      month: monthValue,
      report_date: monthValue, // default: first day of month (NOT NULL constraint)
    }

    for (const field of NUMERIC_FIELDS) {
      const raw = body[field]
      if (raw === undefined || raw === null || raw === "") continue
      const n = Number(raw)
      if (Number.isFinite(n)) reportRow[field] = n
    }

    for (const field of TEXT_FIELDS) {
      const raw = body[field]
      if (typeof raw === "string" && raw.trim().length > 0) {
        reportRow[field] = raw.trim()
      }
    }

    // ── 5. Fetch client name + previous state ─────────────────────────────────
    const [{ data: clientRow }, { data: existingRow }] = await Promise.all([
      supabase.from("clients").select("nombre").eq("id", clientId).maybeSingle(),
      supabase.from("monthly_reports").select("new_clients").eq("client_id", clientId).eq("month", monthValue).maybeSingle(),
    ])

    const clientName: string | undefined = clientRow?.nombre ?? undefined

    const prevNewClients = Number(existingRow?.new_clients ?? 0) || 0
    const nextNewClients = Number(reportRow.new_clients ?? 0) || 0

    // ── 6. Upsert ─────────────────────────────────────────────────────────────
    const { data: saved, error: upsertErr } = await supabase
      .from("monthly_reports")
      .upsert(reportRow, { onConflict: "client_id,month" })
      .select()
      .single()

    if (upsertErr) {
      console.error("[monthly-reports/save] Upsert error:", upsertErr)
      return NextResponse.json({ error: `Database error: ${upsertErr.message}` }, { status: 500 })
    }

    // ── 7. Enqueue events ─────────────────────────────────────────────────────
    const sharedPayload: EventPayload = {
      client_id: clientId,
      client_name: clientName,
      month: rawMonth,
      total_revenue: Number(reportRow.total_revenue ?? 0) || undefined,
      new_clients: nextNewClients || undefined,
      report_data: reportRow as Record<string, unknown>,
      triggered_by: userEmail ?? "sistema",
    }

    const eventsToEnqueue: Parameters<typeof enqueueEvents>[0] = [
      { event_type: "monthly_report.completed", payload: sharedPayload, client_id: clientId, user_id: userId ?? undefined },
    ]

    if (nextNewClients > 0 && nextNewClients > prevNewClients) {
      eventsToEnqueue.push({
        event_type: "sale.registered",
        payload: { ...sharedPayload, new_clients: nextNewClients },
        client_id: clientId,
        user_id: userId ?? undefined,
      })
    }

    // Airtable sync deshabilitado — ya no usamos Airtable.
    // (Si se reactiva en el futuro, descomentar el bloque y poner las env vars.)

    let eventIds: string[] = []
    try {
      eventIds = await enqueueEvents(eventsToEnqueue)
    } catch (e: any) {
      console.error("[monthly-reports/save] Event enqueue error:", e?.message)
    }

    if (eventIds.length > 0) fireEventDispatcher()

    // Nota: las notificaciones (Zapier + Slack) las maneja el event-dispatcher
    // de Supabase a través de la cola de eventos encolada arriba.
    // Se eliminó el disparo directo de Zapier desde acá para evitar duplicados
    // (antes llegaban 3 mensajes: 1 directo + 2 desde el edge function).

    return NextResponse.json({ ok: true, report: saved, events_enqueued: eventIds.length, event_ids: eventIds })
  } catch (err: any) {
    console.error("[monthly-reports/save] Unexpected error:", err)
    return NextResponse.json({ error: err?.message ?? "Internal server error" }, { status: 500 })
  }
}
