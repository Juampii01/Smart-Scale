// POST /api/events/process
// Processes pending outbound events: sends Slack notifications, syncs to Airtable.
// Called by the event-dispatcher Edge Function OR directly as a fallback.
// Protected by EVENTS_PROCESS_SECRET env var (set it in .env.local).

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import {
  notifyMonthlyReportCompleted,
  notifySaleRegistered,
} from "@/lib/slack"
import { syncReportToAirtable, isAirtableConfigured } from "@/lib/airtable"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BATCH_SIZE = 10
const BACKOFF_SECONDS = [30, 120, 600] // 30s, 2min, 10min for retries 1, 2, 3


type EventRow = {
  id: string
  event_type: string
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
  client_id: string | null
  user_id: string | null
}

async function logEvent(
  supabase: ReturnType<typeof createServiceClient>,
  eventId: string,
  level: "info" | "warn" | "error",
  message: string,
  metadata: Record<string, unknown> = {}
) {
  await supabase.from("event_logs").insert({
    event_id: eventId,
    level,
    message,
    metadata,
  })
}

async function markEvent(
  supabase: ReturnType<typeof createServiceClient>,
  eventId: string,
  status: "completed" | "failed",
  attempts: number,
  errorMessage?: string
) {
  const nextAttempts = attempts + 1
  const shouldRetry = status === "failed" && nextAttempts < BATCH_SIZE
  const backoffIdx = Math.min(nextAttempts - 1, BACKOFF_SECONDS.length - 1)
  const backoffSecs = BACKOFF_SECONDS[backoffIdx] ?? 600
  const nextRetryAt = shouldRetry
    ? new Date(Date.now() + backoffSecs * 1000).toISOString()
    : new Date().toISOString()

  await supabase
    .from("outbound_events")
    .update({
      status,
      attempts: nextAttempts,
      error_message: errorMessage ?? null,
      processed_at: status === "completed" ? new Date().toISOString() : null,
      next_retry_at: nextRetryAt,
    })
    .eq("id", eventId)
}

async function processEvent(
  supabase: ReturnType<typeof createServiceClient>,
  event: EventRow
): Promise<void> {
  const { id, event_type, payload, attempts } = event

  // Mark as processing
  await supabase
    .from("outbound_events")
    .update({ status: "processing" })
    .eq("id", id)

  await logEvent(supabase, id, "info", `Processing event: ${event_type}`, {
    attempt: attempts + 1,
  })

  try {
    if (event_type === "monthly_report.completed") {
      const result = await notifyMonthlyReportCompleted({
        client_id: payload.client_id as string | undefined,
        client_name: payload.client_name as string | undefined,
        month: payload.month as string | undefined,
        total_revenue: payload.total_revenue as number | undefined,
        new_clients: payload.new_clients as number | undefined,
        cash_collected: (payload.report_data as any)?.cash_collected as number | undefined,
        mrr: (payload.report_data as any)?.mrr as number | undefined,
        triggered_by: payload.triggered_by as string | undefined,
      })

      if (!result.ok) {
        throw new Error(`Slack error: ${result.error}`)
      }

      await logEvent(supabase, id, "info", "Slack notification sent successfully")
      await markEvent(supabase, id, "completed", attempts)
    } else if (event_type === "sale.registered") {
      const result = await notifySaleRegistered({
        client_id: payload.client_id as string | undefined,
        client_name: payload.client_name as string | undefined,
        month: payload.month as string | undefined,
        new_clients: (payload.new_clients as number) ?? 0,
        total_revenue: payload.total_revenue as number | undefined,
        triggered_by: payload.triggered_by as string | undefined,
      })

      if (!result.ok) {
        throw new Error(`Slack error: ${result.error}`)
      }

      await logEvent(supabase, id, "info", "Slack sale notification sent successfully")
      await markEvent(supabase, id, "completed", attempts)
    } else if (event_type === "airtable.sync") {
      if (!isAirtableConfigured()) {
        await logEvent(supabase, id, "warn", "Airtable not configured — skipping")
        await markEvent(supabase, id, "completed", attempts) // Not an error, just skipped
        return
      }

      const reportData = (payload.report_data ?? payload) as Record<string, unknown>
      const result = await syncReportToAirtable(reportData)

      if (!result.ok) {
        throw new Error(`Airtable error: ${result.error}`)
      }

      await logEvent(supabase, id, "info", `Airtable record upserted: ${result.record_id}`)
      await markEvent(supabase, id, "completed", attempts)
    } else {
      // Unknown event type — mark completed to avoid blocking queue
      await logEvent(supabase, id, "warn", `Unknown event type: ${event_type} — skipping`)
      await markEvent(supabase, id, "completed", attempts)
    }
  } catch (err: any) {
    const errMsg = err?.message ?? "Unknown error"
    console.error(`[events/process] Event ${id} (${event_type}) failed:`, errMsg)
    await logEvent(supabase, id, "error", `Event processing failed: ${errMsg}`)
    await markEvent(supabase, id, "failed", attempts, errMsg)
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth: accept service role header OR EVENTS_PROCESS_SECRET
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  const processSecret = process.env.EVENTS_PROCESS_SECRET ?? ""
  const authHeader = req.headers.get("authorization") ?? ""

  const isAuthorized =
    (serviceKey && authHeader === `Bearer ${serviceKey}`) ||
    (processSecret && authHeader === `Bearer ${processSecret}`)

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get pending events
  const { data: events, error: fetchErr } = await supabase
    .from("outbound_events")
    .select("id, event_type, payload, attempts, max_attempts, client_id, user_id")
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", new Date().toISOString())
    .lt("attempts", supabase.rpc as any) // raw filter below
    .order("next_retry_at", { ascending: true })
    .limit(BATCH_SIZE)

  // Fallback: filter attempts < max_attempts in JS
  const pendingEvents = ((events ?? []) as EventRow[]).filter(
    (e) => e.attempts < e.max_attempts
  )

  if (fetchErr) {
    console.error("[events/process] Fetch error:", fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (pendingEvents.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: "No pending events" })
  }

  // Process sequentially (avoid race conditions)
  const results: { id: string; event_type: string; ok: boolean }[] = []
  for (const event of pendingEvents) {
    try {
      await processEvent(supabase, event)
      results.push({ id: event.id, event_type: event.event_type, ok: true })
    } catch (err: any) {
      results.push({ id: event.id, event_type: event.event_type, ok: false })
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  })
}
