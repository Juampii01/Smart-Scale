import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { enqueueEvents, fireEventDispatcher, EventPayload } from "@/lib/events"
import { zapierReportCompleted, zapierSaleRegistered } from "@/lib/zapier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"


export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth: read JWT from Authorization header ───────────────────────────
    // The client sends its session access_token as "Bearer <jwt>".
    // We verify it via the service client (avoids the window.sessionStorage issue).
    const authHeader = req.headers.get("authorization") ?? ""
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

    const supabase = createServiceClient()

    let userId: string | null = null
    let userEmail: string | null = null

    if (jwt) {
      // getUser(jwt) verifies the token server-side without browser storage
      const { data: { user }, error } = await supabase.auth.getUser(jwt)
      if (!error && user) {
        userId = user.id
        userEmail = user.email ?? null
      }
    }

    // Also accept direct service-role calls (internal/cron)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
    const isServiceCaller = serviceKey && jwt === serviceKey

    if (!userId && !isServiceCaller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    const monthValue = /^\d{4}-\d{2}$/.test(rawMonth) ? `${rawMonth}-01` : rawMonth

    // ── 3. Build upsert payload ───────────────────────────────────────────────
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

    // ── 4. Fetch client name + previous state ─────────────────────────────────
    const [{ data: clientRow }, { data: existingRow }] = await Promise.all([
      supabase.from("clients").select("nombre").eq("id", clientId).maybeSingle(),
      supabase.from("monthly_reports").select("new_clients").eq("client_id", clientId).eq("month", monthValue).maybeSingle(),
    ])

    const clientName: string | undefined = clientRow?.nombre ?? undefined

    const prevNewClients = Number(existingRow?.new_clients ?? 0) || 0
    const nextNewClients = Number(reportRow.new_clients ?? 0) || 0

    // ── 5. Upsert ─────────────────────────────────────────────────────────────
    const { data: saved, error: upsertErr } = await supabase
      .from("monthly_reports")
      .upsert(reportRow, { onConflict: "client_id,month" })
      .select()
      .single()

    if (upsertErr) {
      console.error("[monthly-reports/save] Upsert error:", upsertErr)
      return NextResponse.json({ error: `Database error: ${upsertErr.message}` }, { status: 500 })
    }

    // ── 6. Enqueue events ─────────────────────────────────────────────────────
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

    const airtableEnabled = Boolean(process.env.AIRTABLE_API_KEY) && Boolean(process.env.AIRTABLE_BASE_ID)
    if (airtableEnabled) {
      eventsToEnqueue.push({
        event_type: "airtable.sync",
        payload: { ...sharedPayload, report_data: reportRow },
        client_id: clientId,
        user_id: userId ?? undefined,
      })
    }

    let eventIds: string[] = []
    try {
      eventIds = await enqueueEvents(eventsToEnqueue)
    } catch (e: any) {
      console.error("[monthly-reports/save] Event enqueue error:", e?.message)
    }

    if (eventIds.length > 0) fireEventDispatcher()

    // ── 7. Fire Zapier webhooks (fire-and-forget, non-blocking) ───────────────
    const zapierBase = {
      client_id: clientId,
      client_name: clientName ?? clientId,
      month: rawMonth,
      triggered_by: userEmail ?? "sistema",
      total_revenue: Number(reportRow.total_revenue ?? 0) || undefined,
      cash_collected: Number(reportRow.cash_collected ?? 0) || undefined,
      mrr: Number(reportRow.mrr ?? 0) || undefined,
      new_clients: nextNewClients || undefined,
      ad_spend: Number(reportRow.ad_spend ?? 0) || undefined,
      short_followers: Number(reportRow.short_followers ?? 0) || undefined,
      yt_subscribers: Number(reportRow.yt_subscribers ?? 0) || undefined,
      email_subscribers: Number(reportRow.email_subscribers ?? 0) || undefined,
      scheduled_calls: Number(reportRow.scheduled_calls ?? 0) || undefined,
      attended_calls: Number(reportRow.attended_calls ?? 0) || undefined,
      biggest_win: reportRow.biggest_win as string | undefined,
      next_focus: reportRow.next_focus as string | undefined,
    }

    // Always fire report webhook
    zapierReportCompleted({ event_type: "monthly_report.completed", ...zapierBase }).catch(() => {})

    // Fire Ann's CRM webhook ONLY when she is the one saving the report
    const ANN_EMAIL = "ann@strategycoach.us"
    if (userEmail?.toLowerCase() === ANN_EMAIL) {
      zapierSaleRegistered({
        event_type: "sale.registered",
        ...zapierBase,
        new_clients: nextNewClients,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, report: saved, events_enqueued: eventIds.length, event_ids: eventIds })
  } catch (err: any) {
    console.error("[monthly-reports/save] Unexpected error:", err)
    return NextResponse.json({ error: err?.message ?? "Internal server error" }, { status: 500 })
  }
}
