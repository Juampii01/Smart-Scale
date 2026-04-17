import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
  SQL to create the leads table (run once in Supabase SQL editor):

  create table if not exists leads (
    id          uuid primary key default gen_random_uuid(),
    name        text,
    email       text,
    phone       text,
    instagram   text,
    tag         text,
    source      text,
    status      text not null default 'nuevo',
    notes       text,
    raw_payload jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
  );

  -- Let service role access everything (webhook + admin API both use service role)
  alter table leads enable row level security;
  create policy "service_role_all" on leads for all to service_role using (true) with check (true);
*/

async function requireAdmin(jwt: string | null) {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!profile || String(profile.role ?? "").toLowerCase() !== "admin") return null
  return user
}

/** GET /api/admin/leads — returns all leads ordered by created_at desc */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, email, phone, instagram, tag, source, status, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ leads: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH /api/admin/leads — update status and/or notes of a lead */
export async function PATCH(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: { id?: string; status?: string; notes?: string }
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id, status, notes } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (status !== undefined) updates.status = status
    if (notes  !== undefined) updates.notes  = notes

    const supabase = createServiceClient()
    const { error } = await supabase.from("leads").update(updates).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** DELETE /api/admin/leads — remove a lead by id */
export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: { id?: string }
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase.from("leads").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
