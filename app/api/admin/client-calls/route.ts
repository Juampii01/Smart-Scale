import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SELECT_FIELDS = "id, client_id, participant_email, participant_name, recording_url, transcript, meeting_topic, duration_minutes, occurred_at, matched_at"

/**
 * GET — llamadas de un cliente (?client_id=...) o las que quedaron sin
 * asignar (sin el parámetro). admin/team/setter: mismo criterio que el resto
 * de los endpoints internos de clientes.
 */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const clientId = req.nextUrl.searchParams.get("client_id")
    const supabase = createServiceClient()

    let query = supabase.from("client_calls").select(SELECT_FIELDS).order("occurred_at", { ascending: false }).limit(200)
    query = clientId ? query.eq("client_id", clientId) : query.is("client_id", null)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ calls: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH — asignar (o reasignar) una llamada "sin asignar" a un cliente a mano. */
export async function PATCH(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id, client_id } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase
      .from("client_calls")
      .update({ client_id: client_id || null, matched_at: new Date().toISOString() })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
