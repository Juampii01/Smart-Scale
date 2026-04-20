import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
  SQL — run once in Supabase SQL editor:

  create table if not exists leads (
    id          uuid primary key default gen_random_uuid(),
    name        text,
    tag         text,
    source      text,
    lead_type   text,
    status      text not null default 'nuevo',
    instagram   text,
    rating      integer check (rating between 1 and 5),
    niche       text,
    notes       text,
    raw_payload jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
  );
  alter table leads enable row level security;
  create policy "service_role_all" on leads for all to service_role using (true) with check (true);

  -- If table already exists, add missing columns:
  alter table leads add column if not exists lead_type text;
  alter table leads add column if not exists rating    integer check (rating between 1 and 5);
  alter table leads add column if not exists niche     text;
  -- remove old columns we no longer use (optional):
  -- alter table leads drop column if exists email;
  -- alter table leads drop column if exists phone;
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

const SELECT_FIELDS = "id, name, email, tag, source, lead_type, status, instagram, rating, niche, notes, created_at"

/** GET — all leads ordered by created_at desc */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("leads")
      .select(SELECT_FIELDS)
      .order("created_at", { ascending: false })
      .limit(1000)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ leads: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH — update any editable field */
export async function PATCH(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const PATCHABLE = ["status", "source", "lead_type", "niche", "notes", "rating", "instagram", "email", "tag", "name"]
    const allowed: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of PATCHABLE) {
      if (updates[key] !== undefined) allowed[key] = updates[key]
    }

    const supabase = createServiceClient()
    const { error } = await supabase.from("leads").update(allowed).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** POST — create a lead manually */
export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { name, instagram, tag, email, source, lead_type, niche, notes, rating } = body
    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("leads")
      .insert({
        name:      name.trim(),
        instagram: instagram || null,
        tag:       tag       || null,
        email:     email     || null,
        source:    source    || null,
        lead_type: lead_type || null,
        niche:     niche     || null,
        notes:     notes     || null,
        rating:    rating ? Number(rating) : null,
        status:    "nuevo",
      })
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lead: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** DELETE — remove a lead */
export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase.from("leads").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
