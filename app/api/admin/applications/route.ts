import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
  SQL — run once in Supabase SQL editor:

  create table if not exists applications (
    id              uuid primary key default gen_random_uuid(),
    first_name      text,
    last_name       text,
    email           text,
    primary_channel text,
    question        text,
    status          text not null default 'nueva',
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
  );
  alter table applications enable row level security;
  create policy "service_role_all" on applications for all to service_role using (true) with check (true);
*/

async function requireAdmin(jwt: string | null) {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (String(profile?.role ?? "").toLowerCase() !== "admin") return null
  return user
}

/** GET — all applications ordered by created_at desc */
export async function GET(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("applications")
      .select("id, first_name, last_name, email, primary_channel, question, status, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(1000)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ applications: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** POST — create a new application */
export async function POST(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { first_name, last_name, email, primary_channel, question, status, notes } = body

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("applications")
      .insert({
        first_name:      first_name      || null,
        last_name:       last_name       || null,
        email:           email           || null,
        primary_channel: primary_channel || null,
        question:        question        || null,
        status:          status          ?? "nueva",
        notes:           notes           || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ application: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH — update status and/or notes */
export async function PATCH(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const allowed: Record<string, any> = { updated_at: new Date().toISOString() }
    if (updates.status          !== undefined) allowed.status          = updates.status
    if (updates.notes           !== undefined) allowed.notes           = updates.notes
    if (updates.first_name      !== undefined) allowed.first_name      = updates.first_name
    if (updates.last_name       !== undefined) allowed.last_name       = updates.last_name
    if (updates.email           !== undefined) allowed.email           = updates.email
    if (updates.primary_channel !== undefined) allowed.primary_channel = updates.primary_channel
    if (updates.question        !== undefined) allowed.question        = updates.question

    const supabase = createServiceClient()
    const { error } = await supabase.from("applications").update(allowed).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** DELETE — remove an application */
export async function DELETE(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase.from("applications").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
