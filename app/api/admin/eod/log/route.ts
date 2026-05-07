import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { isAdmin } from "@/lib/auth/permissions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
  SQL — run once in Supabase SQL editor:

  create table if not exists eod_logs (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    date            date not null,
    wins            text,
    plans_tomorrow  text,
    blockers        text,
    mood            integer,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (user_id, date)
  );
  alter table eod_logs enable row level security;
  create policy "service_role_all" on eod_logs for all to service_role using (true) with check (true);
*/

const ALL_FIELDS = "id, user_id, date, wins, plans_tomorrow, blockers, mood, created_at, updated_at"

async function getRoleAndUser(jwt: string | null) {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role, name").eq("id", user.id).maybeSingle()
  return { user, role: (profile as any)?.role ?? null, name: (profile as any)?.name ?? null }
}

/** GET — admin ve todos los EODs (con nombre del autor); team/setter ve solo los suyos */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await getRoleAndUser(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { searchParams } = new URL(req.url)
    const since = searchParams.get("since")
    const until = searchParams.get("until")

    let query = supabase
      .from("eod_logs")
      .select(ALL_FIELDS)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300)

    if (!isAdmin(ctx.role)) {
      query = query.eq("user_id", ctx.user.id)
    }
    if (since) query = query.gte("date", since)
    if (until) query = query.lte("date", until)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrich con nombre del autor (solo para admin)
    let logs = data ?? []
    if (isAdmin(ctx.role) && logs.length) {
      const userIds = Array.from(new Set(logs.map((l: any) => l.user_id)))
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, role")
        .in("id", userIds)
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
      logs = logs.map((l: any) => ({
        ...l,
        author_name: (profileMap.get(l.user_id) as any)?.name ?? null,
        author_role: (profileMap.get(l.user_id) as any)?.role ?? null,
      }))
    }

    return NextResponse.json({ logs })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** POST — upsert del EOD del día actual. user_id = auth user. */
export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ error: "date (YYYY-MM-DD) is required" }, { status: 400 })
    }

    let mood: number | null = null
    if (body.mood != null) {
      const m = Number(body.mood)
      if (Number.isFinite(m) && m >= 1 && m <= 5) mood = Math.floor(m)
    }

    const row = {
      user_id: user.id,
      date: body.date,
      wins: body.wins ? String(body.wins).trim() || null : null,
      plans_tomorrow: body.plans_tomorrow ? String(body.plans_tomorrow).trim() || null : null,
      blockers: body.blockers ? String(body.blockers).trim() || null : null,
      mood,
      updated_at: new Date().toISOString(),
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("eod_logs")
      .upsert(row, { onConflict: "user_id,date" })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ log: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** DELETE — admin puede borrar cualquiera; usuario solo el suyo */
export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await getRoleAndUser(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    if (!isAdmin(ctx.role)) {
      const { data: existing } = await supabase
        .from("eod_logs").select("user_id").eq("id", body.id).maybeSingle()
      if (!existing || (existing as any).user_id !== ctx.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const { error } = await supabase.from("eod_logs").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
