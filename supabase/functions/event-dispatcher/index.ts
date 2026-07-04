// Supabase Edge Function: event-dispatcher
// Polls outbound_events for pending/failed events and processes them.
// Invoked fire-and-forget from /api/monthly-reports/save.
// Can also be called manually via: supabase functions invoke event-dispatcher

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL") ?? null
// Airtable env vars eliminadas — ya no se usan.
const ZAPIER_WEBHOOK_REPORT = Deno.env.get("ZAPIER_WEBHOOK_REPORT") ?? null
const ZAPIER_WEBHOOK_SALE = Deno.env.get("ZAPIER_WEBHOOK_SALE") ?? null

const BATCH_SIZE = 10
const BACKOFF_SECONDS = [30, 120, 600]

// ─── Supabase REST helpers ────────────────────────────────────────────────────

async function dbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  })
  if (!res.ok) throw new Error(`DB GET ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function dbPatch(table: string, id: string, data: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`DB PATCH ${table}/${id}: ${res.status} ${await res.text()}`)
}

async function dbInsert(table: string, row: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`DB INSERT ${table}: ${res.status} ${await res.text()}`)
}

// ─── Logging helper ───────────────────────────────────────────────────────────

async function logEvent(
  eventId: string,
  level: "info" | "warn" | "error",
  message: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await dbInsert("event_logs", {
      event_id: eventId,
      level,
      message,
      metadata,
    })
  } catch {
    // Never let logging break event processing
    console.error(`[event-dispatcher] Failed to write log for event ${eventId}`)
  }
}

// ─── Mark event status ────────────────────────────────────────────────────────

async function markEvent(
  eventId: string,
  status: "completed" | "failed",
  attempts: number,
  maxAttempts: number,
  errorMessage?: string
) {
  const nextAttempts = attempts + 1
  const shouldRetry = status === "failed" && nextAttempts < maxAttempts
  const backoffIdx = Math.min(nextAttempts - 1, BACKOFF_SECONDS.length - 1)
  const backoffSecs = BACKOFF_SECONDS[backoffIdx] ?? 600
  const nextRetryAt = shouldRetry
    ? new Date(Date.now() + backoffSecs * 1000).toISOString()
    : new Date().toISOString()

  await dbPatch("outbound_events", eventId, {
    status: shouldRetry ? "failed" : status,
    attempts: nextAttempts,
    error_message: errorMessage ?? null,
    processed_at: status === "completed" ? new Date().toISOString() : null,
    next_retry_at: nextRetryAt,
  })
}

// ─── Slack integration ────────────────────────────────────────────────────────

async function sendSlack(blocks: unknown[], text: string): Promise<{ ok: boolean; error?: string }> {
  if (!SLACK_WEBHOOK_URL) return { ok: false, error: "SLACK_WEBHOOK_URL not configured" }
  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    })
    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `Slack ${res.status}: ${body}` }
    }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message }
  }
}

function formatMoney(n?: number | null) {
  if (n == null || !isFinite(n)) return "—"
  return `$${n.toLocaleString()}`
}

async function handleMonthlyReportCompleted(payload: Record<string, unknown>) {
  const clientName = (payload.client_name as string) ?? (payload.client_id as string) ?? "Cliente"
  const month = (payload.month as string) ?? "—"
  const revenue = formatMoney(payload.total_revenue as number)
  const cash = formatMoney((payload.report_data as any)?.cash_collected)
  const mrr = formatMoney((payload.report_data as any)?.mrr)
  const newClients = payload.new_clients != null ? String(payload.new_clients) : "—"

  const blocks = [
    { type: "header", text: { type: "plain_text", text: "📊 Reporte mensual completado", emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: `El reporte de *${month}* para *${clientName}* fue guardado exitosamente.` } },
    { type: "divider" },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Cliente*\n${clientName}` },
        { type: "mrkdwn", text: `*Mes*\n${month}` },
        { type: "mrkdwn", text: `*Revenue total*\n${revenue}` },
        { type: "mrkdwn", text: `*Cash collected*\n${cash}` },
        { type: "mrkdwn", text: `*MRR*\n${mrr}` },
        { type: "mrkdwn", text: `*Nuevos clientes*\n${newClients}` },
      ],
    },
    { type: "divider" },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `Cargado por: ${(payload.triggered_by as string) ?? "sistema"} · Smart Scale Portal 2.0` }],
    },
  ]

  return sendSlack(blocks, `📊 Reporte ${month} de ${clientName} completado — Revenue: ${revenue}`)
}

async function handleSaleRegistered(payload: Record<string, unknown>) {
  const clientName = (payload.client_name as string) ?? (payload.client_id as string) ?? "Cliente"
  const month = (payload.month as string) ?? "—"
  const count = Number(payload.new_clients ?? 0)
  const revenue = formatMoney(payload.total_revenue as number)
  const label = count === 1 ? "1 nuevo cliente" : `${count} nuevos clientes`

  const blocks = [
    { type: "header", text: { type: "plain_text", text: `🎉 ¡Venta registrada! ${label}`, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: `*${clientName}* registró *${label}* en el reporte de *${month}*.` } },
    { type: "divider" },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Cliente*\n${clientName}` },
        { type: "mrkdwn", text: `*Mes*\n${month}` },
        { type: "mrkdwn", text: `*Nuevos clientes*\n${String(count)}` },
        { type: "mrkdwn", text: `*Revenue del mes*\n${revenue}` },
      ],
    },
    { type: "divider" },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `Registrado por: ${(payload.triggered_by as string) ?? "sistema"} · Smart Scale Portal 2.0` }],
    },
  ]

  return sendSlack(blocks, `🎉 ${label} registrados para ${clientName} en ${month}`)
}

// ─── Main event processor ─────────────────────────────────────────────────────

async function processEvent(event: {
  id: string
  event_type: string
  payload: Record<string, unknown>
  attempts: number
  max_attempts: number
}) {
  const { id, event_type, payload, attempts, max_attempts } = event

  // Mark as processing
  await dbPatch("outbound_events", id, { status: "processing" })
  await logEvent(id, "info", `Processing ${event_type}`, { attempt: attempts + 1 })

  try {
    let result: { ok: boolean; error?: string }

    if (event_type === "monthly_report.completed") {
      // Solo Zapier — el Zap postea a Slack.
      // Se eliminó el Slack directo para evitar duplicados (antes llegaban 3 mensajes).
      if (ZAPIER_WEBHOOK_REPORT) {
        result = await fetch(ZAPIER_WEBHOOK_REPORT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_type, ...payload }),
        })
          .then(r => r.ok ? { ok: true } : { ok: false, error: `Zapier ${r.status}` })
          .catch(e => ({ ok: false, error: String(e) }))
      } else {
        // Fallback: Slack directo si no hay Zapier configurado
        result = await handleMonthlyReportCompleted(payload)
      }
    } else if (event_type === "sale.registered") {
      // Solo Zapier — mismo criterio anti-duplicados.
      const saleUrl = ZAPIER_WEBHOOK_SALE ?? ZAPIER_WEBHOOK_REPORT
      if (saleUrl) {
        result = await fetch(saleUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_type, ...payload }),
        })
          .then(r => r.ok ? { ok: true } : { ok: false, error: `Zapier ${r.status}` })
          .catch(e => ({ ok: false, error: String(e) }))
      } else {
        result = await handleSaleRegistered(payload)
      }
    } else if (event_type === "airtable.sync") {
      // Airtable ya no se usa — completar como no-op para vaciar cola.
      await logEvent(id, "info", "airtable.sync deprecated — skipping")
      await markEvent(id, "completed", attempts, max_attempts)
      return
    } else {
      await logEvent(id, "warn", `Unknown event type: ${event_type}`)
      await markEvent(id, "completed", attempts, max_attempts)
      return
    }

    if (result.ok) {
      await logEvent(id, "info", `${event_type} processed successfully`)
      await markEvent(id, "completed", attempts, max_attempts)
    } else {
      throw new Error(result.error ?? "Integration returned not-ok")
    }
  } catch (err: any) {
    const errMsg = err?.message ?? "Unknown error"
    console.error(`[event-dispatcher] ${id} (${event_type}) failed: ${errMsg}`)
    await logEvent(id, "error", `Failed: ${errMsg}`)
    await markEvent(id, "failed", attempts, max_attempts, errMsg)
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

serve(async (_req) => {
  console.log("[event-dispatcher] Invoked")

  try {
    // Fetch pending events
    const now = new Date().toISOString()
    const rows: any[] = await dbGet(
      `outbound_events?select=id,event_type,payload,attempts,max_attempts&` +
      `status=in.(pending,failed)&next_retry_at=lte.${encodeURIComponent(now)}&` +
      `order=next_retry_at.asc&limit=${BATCH_SIZE}`
    )

    // Filter attempts < max_attempts in code (Supabase REST doesn't support column comparison filters)
    const events = rows.filter((r: any) => r.attempts < r.max_attempts)

    console.log(`[event-dispatcher] ${events.length} event(s) to process`)

    for (const event of events) {
      await processEvent(event)
    }

    return new Response(
      JSON.stringify({ ok: true, processed: events.length }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err: any) {
    console.error("[event-dispatcher] Fatal error:", err?.message)
    return new Response(
      JSON.stringify({ ok: false, error: err?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
