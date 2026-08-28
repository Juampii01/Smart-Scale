import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal, requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET — cualquier usuario autenticado puede leer la agenda (clientes incluidos).
// Es a propósito: son las calls grupales de todo el programa (título, horario,
// zoom_url, passcode) — el cliente NECESITA el link y el código para poder
// entrar. Verificado en la base (2026-08-20): `calendar_events` no mezcla
// eventos internos del equipo, son 5 filas y todas son calls grupales
// públicas para clientes. Select explícito (no `*`) para que agregar una
// columna nueva sea una decisión consciente de qué se expone, no un default.
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const supabaseAuth = createServiceClient()
    const { data: { user } } = await supabaseAuth.auth.getUser(jwt)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("calendar_events")
      .select("id, title, description, day_of_week, time, tz_label, zoom_url, passcode, status, recurrence, next_date, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ events: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// POST — solo admin
export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        title:       body.title,
        description: body.description || null,
        day_of_week: body.day_of_week || null,
        time:        body.time || null,
        tz_label:    body.tz_label || "Miami",
        zoom_url:    body.zoom_url || null,
        passcode:    body.passcode || null,
        status:      body.status || "active",
        recurrence:  body.recurrence || "weekly",
        next_date:   body.next_date || null,
        sort_order:  body.sort_order ?? 0,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ event: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// PATCH — solo admin
export async function PATCH(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { id, ...fields } = body

    const { error } = await supabase
      .from("calendar_events")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// DELETE — solo admin
export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", body.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
