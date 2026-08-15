import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { resolveInternalScope } from "@/lib/auth/internal-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function requestedTenantId(req: NextRequest, body?: any): string | null {
  return req.nextUrl.searchParams.get("client_id") ?? body?.client_id ?? null
}

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
  alter table leads add column if not exists lead_type  text;
  alter table leads add column if not exists rating     integer check (rating between 1 and 5);
  alter table leads add column if not exists niche      text;
  alter table leads add column if not exists avatar_url text;
  -- remove old columns we no longer use (optional):
  -- alter table leads drop column if exists email;
  -- alter table leads drop column if exists phone;
*/

const SELECT_FIELDS = "id, name, email, tag, source, lead_type, status, instagram, rating, niche, notes, purchased, created_at, avatar_url"
const PIPELINE_FIELDS = "next_follow_up_at, deal_value, pipeline_order"

/** GET — all leads ordered by created_at desc. Lectura: admin OR team. */
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveInternalScope(req, requestedTenantId(req))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const supabase = createServiceClient()
    // Intentamos traer custom_fields + campos del pipeline; si alguna migración
    // todavía no se aplicó, vamos degradando hasta el set mínimo de columnas.
    // Tipado explícito: las 3 queries de fallback seleccionan distintas columnas,
    // así que el tipo fila-a-fila que infiere Supabase difiere entre ellas — sin
    // esto TS intenta unificarlos y falla.
    let data: any[] | null = null
    let error: { message: string } | null = null
    ;({ data, error } = await supabase
      .from("leads")
      .select(SELECT_FIELDS + ", custom_fields, " + PIPELINE_FIELDS)
      .eq("client_id", scope.tenantId)
      .order("created_at", { ascending: false })
      .limit(1000))

    if (error) {
      ({ data, error } = await supabase
        .from("leads")
        .select(SELECT_FIELDS + ", custom_fields")
        .eq("client_id", scope.tenantId)
        .order("created_at", { ascending: false })
        .limit(1000))
    }

    if (error) {
      ({ data, error } = await supabase
        .from("leads")
        .select(SELECT_FIELDS)
        .eq("client_id", scope.tenantId)
        .order("created_at", { ascending: false })
        .limit(1000))
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ leads: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH — update any editable field */
export async function PATCH(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    // admin/team/setter pueden editar leads (parte del flujo de prospección)
    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const PATCHABLE = ["status", "source", "lead_type", "niche", "notes", "rating", "instagram", "email", "tag", "name", "purchased", "custom_fields", "next_follow_up_at", "deal_value", "pipeline_order", "avatar_url"]
    const allowed: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of PATCHABLE) {
      if (updates[key] !== undefined) allowed[key] = updates[key]
    }
    // Nueva fecha de seguimiento → resetea el flag de aviso ya mandado, para
    // que el cron de app/api/cron/lead-follow-up vuelva a disparar en la
    // fecha nueva (si no, se queda "ya avisado" para siempre).
    if (updates.next_follow_up_at !== undefined) allowed.follow_up_alert_sent_at = null

    const supabase = createServiceClient()
    const { error } = await supabase.from("leads").update(allowed).eq("id", id).eq("client_id", scope.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** POST — create a lead manually */
export async function POST(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    // admin/team/setter pueden crear leads (es el core del trabajo del setter)
    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const { name, instagram, tag, email, source, lead_type, niche, notes, rating } = body
    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("leads")
      .insert({
        client_id: scope.tenantId,
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

/** DELETE — remove a lead. admin/team/setter, mismo criterio que GET/PATCH/POST. */
export async function DELETE(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const supabase = createServiceClient()
    const { error } = await supabase.from("leads").delete().eq("id", body.id).eq("client_id", scope.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
