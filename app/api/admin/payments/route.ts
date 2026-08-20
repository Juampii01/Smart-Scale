import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"
import { resolveClientAndSuggestion } from "@/lib/payments"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/*
  SQL — run once in Supabase SQL editor:

  create table if not exists payments (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    email       text,
    amount      numeric(12,2) not null default 0,
    status      text not null default 'pendiente',
    description text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    -- agregadas en 20260820000001/3: idempotencia + reconciliación con crm_installments
    external_event_id        text,
    client_id                uuid references crm_clients(id) on delete set null,
    suggested_installment_id uuid references crm_installments(id) on delete set null
  );
  alter table payments enable row level security;
  create policy "service_role_all" on payments for all to service_role using (true) with check (true);
*/

async function requireAdmin(jwt: string | null) {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!isAdmin(profile?.role)) return null
  return user
}

/** GET — all payments ordered by created_at desc, con el cliente resuelto
 *  (si el webhook lo pudo matchear por email) y la cuota sugerida para
 *  conciliar, cuando hay una. */
export async function GET(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("payments")
      .select("id, name, email, amount, status, description, created_at, client_id, suggested_installment_id")
      .order("created_at", { ascending: false })
      .limit(1000)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const payments = data ?? []

    const clientIds = Array.from(new Set(payments.map((p: any) => p.client_id).filter(Boolean)))
    const installmentIds = Array.from(new Set(payments.map((p: any) => p.suggested_installment_id).filter(Boolean)))

    const [{ data: clients }, { data: installments }] = await Promise.all([
      clientIds.length
        ? supabase.from("crm_clients").select("id, name, nombre").in("id", clientIds)
        : Promise.resolve({ data: [] as any[] }),
      installmentIds.length
        ? supabase.from("crm_installments").select("id, installment_number, amount, due_date, paid_at").in("id", installmentIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const clientById = new Map((clients ?? []).map((c: any) => [c.id, (c as any).nombre || (c as any).name]))
    const installmentById = new Map((installments ?? []).map((i: any) => [i.id, i]))

    const enriched = payments.map((p: any) => ({
      ...p,
      client_name: p.client_id ? (clientById.get(p.client_id) ?? null) : null,
      suggested_installment: p.suggested_installment_id ? (installmentById.get(p.suggested_installment_id) ?? null) : null,
    }))

    return NextResponse.json({ payments: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** POST-like action embebida en PATCH: { id, confirm_installment: true }
 *  confirma la cuota sugerida — la marca paid_at y limpia la sugerencia.
 *  Se maneja en PATCH (no un método nuevo) para no duplicar el guard de
 *  admin ni el parseo de body. Si la cuota ya estaba pagada (alguien la
 *  tildó a mano mientras tanto), no la vuelve a marcar — solo limpia la
 *  sugerencia, que ya no tiene sentido mostrar. */
async function confirmSuggestedInstallment(supabase: ReturnType<typeof createServiceClient>, paymentId: string) {
  const { data: payment, error: paymentErr } = await supabase
    .from("payments")
    .select("suggested_installment_id")
    .eq("id", paymentId)
    .maybeSingle()
  if (paymentErr) return { error: paymentErr.message }
  const installmentId = (payment as any)?.suggested_installment_id
  if (!installmentId) return { error: "Este pago no tiene ninguna cuota sugerida" }

  const { data: installment } = await supabase
    .from("crm_installments")
    .select("paid_at")
    .eq("id", installmentId)
    .maybeSingle()

  if (!(installment as any)?.paid_at) {
    const { error: markErr } = await supabase
      .from("crm_installments")
      .update({ paid_at: new Date().toISOString() })
      .eq("id", installmentId)
    if (markErr) return { error: markErr.message }
  }

  await supabase.from("payments").update({ suggested_installment_id: null }).eq("id", paymentId)
  return { success: true }
}

/** POST — create a new payment */
export async function POST(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { name, email, amount, status, description, created_at } = body
    if (!name || amount == null) return NextResponse.json({ error: "name and amount are required" }, { status: 400 })

    const supabase = createServiceClient()
    const finalStatus = status ?? "pendiente"
    const { clientId, suggestedInstallmentId } = await resolveClientAndSuggestion(supabase, email || null, Number(amount), finalStatus)

    // Validate custom date if provided (YYYY-MM-DD or ISO)
    const insertRow: Record<string, any> = {
      name,
      email:       email       || null,
      amount:      Number(amount),
      status:      finalStatus,
      description: description || null,
      client_id:   clientId,
      suggested_installment_id: suggestedInstallmentId,
    }
    if (created_at) {
      const parsed = new Date(created_at)
      if (!isNaN(parsed.getTime())) insertRow.created_at = parsed.toISOString()
    }

    const { data, error } = await supabase
      .from("payments")
      .insert(insertRow)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ payment: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH — update status and/or description */
export async function PATCH(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()

    if (updates.confirm_installment === true) {
      const result = await confirmSuggestedInstallment(supabase, id)
      if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: 400 })
      return NextResponse.json(result)
    }

    const allowed: Record<string, any> = { updated_at: new Date().toISOString() }
    if (updates.status      !== undefined) allowed.status      = updates.status
    if (updates.description !== undefined) allowed.description = updates.description
    if (updates.amount      !== undefined) allowed.amount      = Number(updates.amount)

    const { error } = await supabase.from("payments").update(allowed).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** DELETE — remove a payment */
export async function DELETE(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase.from("payments").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
