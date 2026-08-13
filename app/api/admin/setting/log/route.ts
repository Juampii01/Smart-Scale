import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"
import { resolveInternalScope } from "@/lib/auth/internal-scope"
import { zapierEODSubmitted } from "@/lib/zapier"

function requestedTenantId(req: NextRequest, body?: any): string | null {
  return req.nextUrl.searchParams.get("client_id") ?? body?.client_id ?? null
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
  SQL — run once in Supabase SQL editor:

  create table if not exists setting_daily_logs (
    id                       uuid primary key default gen_random_uuid(),
    setter_id                uuid not null references auth.users(id) on delete cascade,
    date                     date not null,
    new_conversations        integer not null default 0,
    conversations_replied    integer not null default 0,
    qualified_leads          integer not null default 0,
    inbound_qualified        integer not null default 0,
    outbound_qualified       integer not null default 0,
    offer_docs_sent          integer not null default 0,
    offer_doc_responses      integer not null default 0,
    calls_done               integer not null default 0,
    notes                    text,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    unique (setter_id, date)
  );
  alter table setting_daily_logs enable row level security;
  create policy "service_role_all" on setting_daily_logs for all to service_role using (true) with check (true);
*/

const ALL_FIELDS = [
  "id", "setter_id", "date",
  "new_conversations_inbound", "new_conversations_outbound", "outbound_replies",
  "conversations_replied", "qualified_leads",
  "inbound_qualified", "outbound_qualified",
  "offer_docs_sent", "offer_doc_responses", "calls_done",
  "inbound_applications", "cierres",
  "notes", "created_at", "updated_at",
].join(", ")

const NUMERIC_FIELDS = [
  "new_conversations_inbound", "new_conversations_outbound", "outbound_replies",
  "conversations_replied", "qualified_leads",
  "inbound_qualified", "outbound_qualified",
  "offer_docs_sent", "offer_doc_responses", "calls_done",
  "inbound_applications", "cierres",
] as const

function sanitizeInt(v: any): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

/** GET — admin ve todos los del tenant, team/setter ve solo los suyos */
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveInternalScope(req, requestedTenantId(req))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const supabase = createServiceClient()
    const { searchParams } = new URL(req.url)
    const month = searchParams.get("month")      // optional YYYY-MM
    const since = searchParams.get("since")      // optional YYYY-MM-DD
    const until = searchParams.get("until")      // optional YYYY-MM-DD

    // Calcular since/until a partir de month si se proporciona
    let querySince = since
    let queryUntil = until
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-")
      querySince = `${y}-${m}-01`
      const lastDay = new Date(Number(y), Number(m), 0).getDate()
      queryUntil = `${y}-${m}-${String(lastDay).padStart(2, "0")}`
    }

    // Cualquier user internal ve TODOS los logs del tenant (admin/team/setter), no se filtra por rol.
    let query = supabase
      .from("setting_daily_logs")
      .select(ALL_FIELDS)
      .eq("client_id", scope.tenantId)
      .order("date", { ascending: false })
      .limit(500)

    if (querySince) query = query.gte("date", querySince)
    if (queryUntil) query = query.lte("date", queryUntil)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrich con nombre del setter desde profiles
    let logs = data ?? []
    if (logs.length) {
      const setterIds = Array.from(new Set(logs.map((l: any) => l.setter_id)))
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, role")
        .in("id", setterIds)
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))
      logs = logs.map((l: any) => ({
        ...l,
        setter_name: (profileMap.get(l.setter_id) as any)?.name ?? null,
        setter_role: (profileMap.get(l.setter_id) as any)?.role ?? null,
      }))
    }

    return NextResponse.json({ logs })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** POST — upsert por (setter_id, date). El setter siempre carga sus propios datos. */
export async function POST(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ error: "date (YYYY-MM-DD) is required" }, { status: 400 })
    }

    const row: Record<string, any> = {
      client_id: scope.tenantId,
      setter_id: scope.userId,
      date: body.date,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    }
    for (const f of NUMERIC_FIELDS) {
      row[f] = sanitizeInt(body[f])
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("setting_daily_logs")
      .upsert(row, { onConflict: "setter_id,date" })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Fire Zapier webhook (fire-and-forget — no bloquea la respuesta)
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", scope.userId)
      .maybeSingle()
    const setterName = (profile as any)?.name ?? "Setter"

    zapierEODSubmitted({
      event_type:                 "eod.submitted",
      setter_id:                  scope.userId,
      setter_name:                setterName,
      date:                       body.date,
      new_conversations_inbound:  row.new_conversations_inbound  ?? 0,
      new_conversations_outbound: row.new_conversations_outbound ?? 0,
      outbound_replies:           row.outbound_replies           ?? 0,
      qualified_leads:            row.qualified_leads            ?? 0,
      inbound_qualified:          row.inbound_qualified          ?? 0,
      outbound_qualified:         row.outbound_qualified         ?? 0,
      offer_docs_sent:            row.offer_docs_sent            ?? 0,
      offer_doc_responses:        row.offer_doc_responses        ?? 0,
      calls_done:                 row.calls_done                 ?? 0,
      inbound_applications:       row.inbound_applications       ?? 0,
      cierres:                    row.cierres                    ?? 0,
      notes:                      row.notes                      ?? "",
    }).then(result => {
      if (!result.ok) console.error("Zapier EOD webhook failed:", result.error)
      else console.log("Zapier EOD webhook sent OK — setter:", setterName, "date:", body.date)
    }).catch((err: any) => console.error("Zapier EOD webhook error:", err))

    return NextResponse.json({ log: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH — actualizar campos por date+field. Setter solo puede tocar sus propios rows; admin todos. */
export async function PATCH(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const { id, date, field, value, ...otherUpdates } = body

    // Soporta dos modos: por ID (legacy) o por date+field (nuevo)
    let updateQuery = null
    const supabase = createServiceClient()

    if (id) {
      // Modo legacy: actualizar por ID
      if (!isAdmin(scope.role)) {
        const { data: existing } = await supabase
          .from("setting_daily_logs").select("setter_id, client_id").eq("id", id).maybeSingle()
        if (!existing || (existing as any).setter_id !== scope.userId || (existing as any).client_id !== scope.tenantId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      }
      const allowed: Record<string, any> = { updated_at: new Date().toISOString(), ...otherUpdates }
      for (const f of NUMERIC_FIELDS) {
        if (otherUpdates[f] !== undefined) allowed[f] = sanitizeInt(otherUpdates[f])
      }
      if (otherUpdates.notes !== undefined) allowed.notes = otherUpdates.notes || null
      updateQuery = supabase.from("setting_daily_logs").update(allowed).eq("id", id).eq("client_id", scope.tenantId)
    } else if (date && field) {
      // Modo nuevo: actualizar por date+field (tabla mensual)
      if (!NUMERIC_FIELDS.includes(field as any) && field !== "notes") {
        return NextResponse.json({ error: `Invalid field: ${field}` }, { status: 400 })
      }

      // Buscar el log: si no es admin, solo puede editar el suyo. Siempre dentro del tenant.
      let logQuery = supabase
        .from("setting_daily_logs")
        .select("id, setter_id")
        .eq("date", date)
        .eq("client_id", scope.tenantId)

      if (!isAdmin(scope.role)) {
        logQuery = logQuery.eq("setter_id", scope.userId)
      }

      const { data: existing } = await logQuery.maybeSingle()
      if (!existing) {
        return NextResponse.json({ error: `No log found for ${date}` }, { status: 404 })
      }

      const allowed: Record<string, any> = { updated_at: new Date().toISOString() }
      if (field === "notes") {
        allowed.notes = value || null
      } else {
        allowed[field] = sanitizeInt(value)
      }
      updateQuery = supabase.from("setting_daily_logs").update(allowed).eq("id", existing.id).eq("client_id", scope.tenantId)
    } else {
      return NextResponse.json({ error: "id OR (date+field) is required" }, { status: 400 })
    }

    const { error } = await updateQuery
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** DELETE — solo admin */
export async function DELETE(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const scope = await resolveInternalScope(req, requestedTenantId(req, body))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    if (!isAdmin(scope.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { error } = await supabase.from("setting_daily_logs").delete().eq("id", body.id).eq("client_id", scope.tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
