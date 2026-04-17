import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
  SQL — run once in Supabase SQL editor:

  create table if not exists applications (
    id                   uuid primary key default gen_random_uuid(),
    first_name           text,
    last_name            text,
    email                text,
    whatsapp             text,
    instagram_handle     text,
    primary_channel      text,
    short_content_link   text,
    youtube_podcast_link text,
    email_list_size      text,
    monthly_revenue      text,
    paying_clients       text,
    client_work_style    text,
    income_goal          text,
    main_blocker         text,
    superpowers          text,
    contribution         text,
    motivation           text,
    one_year_goal        text,
    terms_accepted       boolean not null default false,
    status               text not null default 'nueva',
    notes                text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
  );
  alter table applications enable row level security;
  create policy "service_role_all" on applications for all to service_role using (true) with check (true);

  -- If the table already exists, add missing columns:
  alter table applications add column if not exists whatsapp             text;
  alter table applications add column if not exists instagram_handle     text;
  alter table applications add column if not exists short_content_link   text;
  alter table applications add column if not exists youtube_podcast_link text;
  alter table applications add column if not exists email_list_size      text;
  alter table applications add column if not exists monthly_revenue      text;
  alter table applications add column if not exists paying_clients       text;
  alter table applications add column if not exists client_work_style    text;
  alter table applications add column if not exists income_goal          text;
  alter table applications add column if not exists main_blocker         text;
  alter table applications add column if not exists superpowers          text;
  alter table applications add column if not exists contribution         text;
  alter table applications add column if not exists motivation           text;
  alter table applications add column if not exists one_year_goal        text;
  alter table applications add column if not exists terms_accepted       boolean not null default false;
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

const ALL_FIELDS = [
  "id","first_name","last_name","email","whatsapp","instagram_handle",
  "primary_channel","short_content_link","youtube_podcast_link",
  "email_list_size","monthly_revenue","paying_clients","client_work_style",
  "income_goal","main_blocker","superpowers","contribution","motivation",
  "one_year_goal","terms_accepted","status","notes","created_at",
].join(", ")

/** GET — all applications ordered by created_at desc */
export async function GET(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("applications")
      .select(ALL_FIELDS)
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

    const {
      first_name, last_name, email, whatsapp, instagram_handle,
      primary_channel, short_content_link, youtube_podcast_link,
      email_list_size, monthly_revenue, paying_clients, client_work_style,
      income_goal, main_blocker, superpowers, contribution, motivation,
      one_year_goal, terms_accepted, status, notes,
    } = body

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("applications")
      .insert({
        first_name:           first_name           || null,
        last_name:            last_name            || null,
        email:                email                || null,
        whatsapp:             whatsapp             || null,
        instagram_handle:     instagram_handle     || null,
        primary_channel:      primary_channel      || null,
        short_content_link:   short_content_link   || null,
        youtube_podcast_link: youtube_podcast_link || null,
        email_list_size:      email_list_size      || null,
        monthly_revenue:      monthly_revenue      || null,
        paying_clients:       paying_clients       || null,
        client_work_style:    client_work_style    || null,
        income_goal:          income_goal          || null,
        main_blocker:         main_blocker         || null,
        superpowers:          superpowers          || null,
        contribution:         contribution         || null,
        motivation:           motivation           || null,
        one_year_goal:        one_year_goal        || null,
        terms_accepted:       Boolean(terms_accepted),
        status:               status               ?? "nueva",
        notes:                notes                || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ application: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH — update any allowed field */
export async function PATCH(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const PATCHABLE = [
      "status","notes","first_name","last_name","email","whatsapp",
      "instagram_handle","primary_channel","short_content_link","youtube_podcast_link",
      "email_list_size","monthly_revenue","paying_clients","client_work_style",
      "income_goal","main_blocker","superpowers","contribution","motivation","one_year_goal",
    ]
    const allowed: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of PATCHABLE) {
      if (updates[key] !== undefined) allowed[key] = updates[key]
    }

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
