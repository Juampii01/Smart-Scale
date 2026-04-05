import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// ─── Event types ──────────────────────────────────────────────────────────────

export type EventType =
  | "monthly_report.completed"
  | "sale.registered"
  | "airtable.sync"

export interface EventPayload {
  client_id?: string
  client_name?: string
  month?: string
  new_clients?: number
  total_revenue?: number
  report_data?: Record<string, unknown>
  triggered_by?: string
  [key: string]: unknown
}

export interface EnqueueEventOptions {
  event_type: EventType
  payload: EventPayload
  client_id?: string
  user_id?: string
  max_attempts?: number
}

// ─── Service-role Supabase client (server-side only) ─────────────────────────

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ─── Enqueue a single event ───────────────────────────────────────────────────

export async function enqueueEvent(opts: EnqueueEventOptions): Promise<string> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("outbound_events")
    .insert({
      event_type: opts.event_type,
      payload: opts.payload,
      client_id: opts.client_id ?? null,
      user_id: opts.user_id ?? null,
      max_attempts: opts.max_attempts ?? 3,
      status: "pending",
      attempts: 0,
      next_retry_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) throw new Error(`Failed to enqueue event: ${error.message}`)
  return data.id
}

// ─── Enqueue multiple events ──────────────────────────────────────────────────

export async function enqueueEvents(events: EnqueueEventOptions[]): Promise<string[]> {
  if (events.length === 0) return []
  const supabase = createServiceClient()

  const rows = events.map((e) => ({
    event_type: e.event_type,
    payload: e.payload,
    client_id: e.client_id ?? null,
    user_id: e.user_id ?? null,
    max_attempts: e.max_attempts ?? 3,
    status: "pending",
    attempts: 0,
    next_retry_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from("outbound_events")
    .insert(rows)
    .select("id")

  if (error) throw new Error(`Failed to enqueue events: ${error.message}`)
  return (data ?? []).map((r: { id: string }) => r.id)
}

// ─── Fire the event-dispatcher edge function (non-blocking) ──────────────────

export async function fireEventDispatcher(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return

  // Fire and forget — don't await, don't throw
  fetch(`${supabaseUrl}/functions/v1/event-dispatcher`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ triggered_at: new Date().toISOString() }),
  }).catch(() => {
    // Silently ignore — events remain in queue for next invocation
  })
}
