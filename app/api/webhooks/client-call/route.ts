import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { logJobRun } from "@/lib/system-log"
import { zapierClientCallReceived } from "@/lib/zapier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Fail-closed: si CLIENT_CALL_WEBHOOK_SECRET no está configurado, rechaza todo.
function authorize(req: NextRequest): boolean {
  const secret = process.env.CLIENT_CALL_WEBHOOK_SECRET
  if (!secret) return false
  const incoming =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    req.nextUrl.searchParams.get("secret") ??
    null
  return incoming === secret
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Primer valor truthy entre varias keys (tolerante a variaciones de Zapier). */
function pick(obj: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    const v = obj[k] ?? obj[k.toLowerCase()] ?? obj[k.replace(/_/g, " ")]
    if (v !== undefined && v !== null && v !== "") return v
  }
  return null
}

function parseWhen(raw: any): string {
  const s = String(raw ?? "").trim()
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString()
  return new Date().toISOString()
}

// ─── POST ─────────────────────────────────────────────────────────────────────
// Recibe desde Zapier cuando Zoom termina de procesar una llamada 1:1 con un
// cliente. Diseño defensivo: el payload crudo se guarda SIEMPRE primero, antes
// de intentar matchear nada — así nunca se pierde el evento aunque el resto
// falle o el shape del payload no sea el esperado.
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    let body: Record<string, any> = {}
    const ct = req.headers.get("content-type") ?? ""
    if (ct.includes("application/json")) {
      body = await req.json().catch(() => ({}))
    } else {
      const text = await req.text().catch(() => "")
      body = Object.fromEntries(new URLSearchParams(text))
    }

    const email    = pick(body, "email", "participant_email", "host_email", "user_email")
    const name     = pick(body, "name", "participant_name", "host_name", "user_name", "topic")
    const recording_url = pick(body, "recording_url", "share_url", "play_url", "download_url", "url")
    const topic    = pick(body, "topic", "meeting_topic", "title", "subject")
    const duration = pick(body, "duration", "duration_minutes", "length")
    const start    = pick(body, "start_time", "occurred_at", "date", "recorded_at")
    const transcript = pick(body, "transcript", "transcript_text", "captions")

    // 1. Insert inmediato con el payload crudo — nunca se pierde el evento.
    const { data: inserted, error: insertError } = await supabase
      .from("client_calls")
      .insert({
        participant_email: email ? String(email).trim().toLowerCase() : null,
        participant_name:  name ? String(name) : null,
        recording_url:     recording_url ? String(recording_url) : null,
        meeting_topic:     topic ? String(topic) : null,
        duration_minutes:  duration ? Number(duration) || null : null,
        occurred_at:       parseWhen(start),
        transcript:        transcript ? String(transcript) : null,
        raw_payload:       body,
      })
      .select("id")
      .single()

    if (insertError || !inserted) {
      await logJobRun(supabase, "webhook:client-call", "error", insertError?.message ?? "insert failed")
      return NextResponse.json({ error: insertError?.message ?? "insert failed" }, { status: 500 })
    }

    // 2. Matchear por email contra crm_clients (misma tabla que ya usa el email
    //    como fuente confiable — clients/portal no tiene columna email).
    let clientId: string | null = null
    let clientName: string | null = null
    if (email) {
      const { data: match } = await supabase
        .from("crm_clients")
        .select("id, name")
        .ilike("email", String(email).trim())
        .maybeSingle()
      if (match) {
        clientId = match.id
        clientName = match.name
        await supabase
          .from("client_calls")
          .update({ client_id: clientId, matched_at: new Date().toISOString() })
          .eq("id", inserted.id)
      }
    }

    // 3. Avisar por Zapier → Slack (fire-and-forget, no bloquea la respuesta).
    await zapierClientCallReceived({
      event_type:        "client_call.received",
      client_name:       clientName,
      participant_email: email,
      participant_name:  name,
      recording_url:     recording_url,
      meeting_topic:     topic,
      duration_minutes:  duration ? Number(duration) || null : null,
    })

    await logJobRun(supabase, "webhook:client-call", "ok", clientId ? `matched: ${clientName}` : "sin asignar")
    return NextResponse.json({ ok: true, id: inserted.id, matched: !!clientId })
  } catch (err: any) {
    await logJobRun(supabase, "webhook:client-call", "error", err?.message ?? "Error interno")
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
