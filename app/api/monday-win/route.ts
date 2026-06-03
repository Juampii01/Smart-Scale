import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"


export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get("authorization") ?? ""
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { client_id, fecha, logro_1, logro_2, logro_3, una_sola_cosa, bloqueo } = body

    if (!client_id || !fecha || !logro_1 || !una_sola_cosa || !bloqueo) {
      return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 })
    }

    // Resolve client name: clients.nombre → clients.name (si no es email) → profiles.name → user.email
    const isEmail = (s: string) => s.includes("@")
    let clientName: string = client_id

    const { data: clientRow } = await supabase
      .from("clients")
      .select("nombre, name")
      .eq("id", client_id)
      .maybeSingle()

    if (clientRow?.nombre && !isEmail(clientRow.nombre)) {
      clientName = clientRow.nombre
    } else if (clientRow?.name && !isEmail(clientRow.name)) {
      clientName = clientRow.name
    } else {
      // Fallback: name from the authenticated user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle()
      if ((profile as any)?.name) {
        clientName = (profile as any).name
      } else if (user.email) {
        clientName = user.email
      }
    }

    // ── Persistir en la base (registro en el dashboard) ──────────────────────
    const { error: insErr } = await supabase.from("monday_wins").insert({
      client_id,
      user_id:       user.id,
      fecha,
      logro_1,
      logro_2:       logro_2 || null,
      logro_3:       logro_3 || null,
      una_sola_cosa,
      bloqueo,
      submitted_by:  user.email,
    })
    if (insErr) console.error("[monday-win] insert error:", insErr.message)

    // Build Zapier payload
    const payload = {
      event_type:       "monday_win.submitted",
      client_id,
      client_name:      clientName,
      submitted_by:     user.email,
      fecha,
      logro_1,
      logro_2:          logro_2 || null,
      logro_3:          logro_3 || null,
      una_sola_cosa,
      bloqueo_pregunta: bloqueo,
      timestamp:        new Date().toISOString(),
    }

    // Send to Zapier — use server-only var (no NEXT_PUBLIC_ prefix)
    const webhookUrl = process.env.ZAPIER_WEBHOOK_MONDAY_WIN
    if (!webhookUrl) {
      console.warn("[monday-win] No webhook URL configured")
      return NextResponse.json({ ok: true, warning: "Webhook no configurado" })
    }

    const zapierRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!zapierRes.ok) {
      const text = await zapierRes.text().catch(() => "")
      console.error("[monday-win] Zapier error:", zapierRes.status, text)
      return NextResponse.json(
        { error: `Zapier respondió con error ${zapierRes.status}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, client_name: clientName })
  } catch (err: any) {
    console.error("[monday-win] error:", err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
