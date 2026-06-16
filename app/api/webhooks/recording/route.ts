import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Fail-closed: si RECORDING_WEBHOOK_SECRET no está configurado, rechaza todo.
function authorize(req: NextRequest): boolean {
  const secret = process.env.RECORDING_WEBHOOK_SECRET
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

/** Normaliza una fecha a YYYY-MM-DD; si no se puede, hoy. */
function parseDate(raw: any): string {
  const s = String(raw ?? "").trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>

    const title = pick(body, "title", "topic", "meeting_topic", "subject", "name")
    const recording_url = pick(
      body, "recording_url", "share_url", "play_url", "download_url", "url", "link"
    )

    if (!title || !recording_url) {
      return NextResponse.json(
        { error: "Faltan campos: se requieren 'title' (topic) y 'recording_url' (share_url)." },
        { status: 400 }
      )
    }

    const recorded_at = parseDate(pick(body, "recorded_at", "date", "start_time", "recording_start", "created"))
    const passcode    = pick(body, "passcode", "password", "recording_password", "play_passcode")
    const duration    = pick(body, "duration", "length", "recording_duration")
    const playbook_url = pick(body, "playbook_url", "playbook", "notes_url", "doc_url")
    const thumbnail   = pick(body, "thumbnail", "thumbnail_url", "image")
    const notes       = pick(body, "notes", "description", "summary")

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("calendar_recordings")
      .insert({
        title:         String(title).slice(0, 300),
        recording_url: String(recording_url),
        recorded_at,
        passcode:      passcode ? String(passcode) : null,
        duration:      duration ? String(duration) : null,
        playbook_url:  playbook_url ? String(playbook_url) : null,
        thumbnail:     thumbnail ? String(thumbnail) : null,
        notes:         notes ? String(notes) : null,
        source:        "zapier",
      })
      .select("id")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
