import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireSmartScaleInternal } from "@/lib/auth/api-guards"
import { getSmartScaleTenantId } from "@/lib/auth/internal-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Límites de un mes calendario (YYYY-MM) en UTC — endIso/endDate son el límite EXCLUSIVO
 *  (primer día del mes siguiente), lastDayDate es el último día real del mes (para mostrar). */
function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number)
  const start   = new Date(Date.UTC(y, m - 1, 1))
  const end     = new Date(Date.UTC(y, m, 1))
  const lastDay = new Date(Date.UTC(y, m, 0))
  return {
    startIso:    start.toISOString(),
    endIso:      end.toISOString(),
    startDate:   start.toISOString().slice(0, 10),
    endDate:     end.toISOString().slice(0, 10),
    lastDayDate: lastDay.toISOString().slice(0, 10),
  }
}

/**
 * GET /api/admin/executive-dashboard?month=YYYY-MM
 *
 * Devuelve 4 bloques consolidados para el Dashboard Ejecutivo, todos acotados
 * al mes calendario pedido (default: mes actual):
 *  1. new_cash     — clientes nuevos ese mes + sus cuotas cobradas/pendientes
 *  2. old_cash     — cuotas cobradas ese mes de clientes que ya existían antes
 *  3. setting      — métricas de setting diarias + cierres ese mes, por setter
 *  4. upcoming_quotas — vencido (cuotas sin pagar de ANTES del mes) + del mes (sin pagar, due_date dentro del mes)
 *
 * Solo admin.
 */
export async function GET(req: NextRequest) {
  try {
    const jwt    = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const caller = await requireSmartScaleInternal(jwt)
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7)
    const { startIso, endIso, startDate, endDate, lastDayDate } = monthBounds(month)
    const today = new Date().toISOString().slice(0, 10)

    const supabase = createServiceClient()

    const smartScaleTenantId = await getSmartScaleTenantId(supabase)
    if (!smartScaleTenantId) {
      return NextResponse.json({ error: "No se encontró el tenant interno de Smart Scale" }, { status: 500 })
    }

    // ── Queries en paralelo ──────────────────────────────────────────────────
    // Todas acotadas a client_id = smartScaleTenantId (directo en crm_clients,
    // vía crm_clients!inner en crm_installments) — sin esto, el día que otro
    // tenant tenga sus propios crm_clients/crm_installments, este dashboard
    // (y el MRR de la empresa) mezclarían la facturación de Ann con la de
    // sus clientes.
    const [
      newClientsRes,
      paidInPeriodRes,
      settingLogsRes,
      setterProfilesRes,
      cierresRes,
      overdueRes,
      upcomingRes,
    ] = await Promise.all([
      // 1. Clientes creados en el mes
      supabase
        .from("crm_clients")
        .select("id, name, total_amount, installment_amount, num_installments, created_at, program_start, setter_id, programa")
        .eq("client_id", smartScaleTenantId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false }),

      // 2. Cuotas cobradas en el mes (con info del cliente)
      supabase
        .from("crm_installments")
        .select("id, client_id, amount, paid_at, installment_number, crm_clients!inner(id, name, created_at)")
        .eq("crm_clients.client_id", smartScaleTenantId)
        .gte("paid_at", startIso)
        .lt("paid_at", endIso)
        .order("paid_at", { ascending: false }),

      // 3. Logs de setting del mes
      supabase
        .from("setting_daily_logs")
        .select("setter_id, new_conversations_inbound, new_conversations_outbound, outbound_replies, qualified_leads, offer_docs_sent, offer_doc_responses, calls_done, cash_collected")
        .eq("client_id", smartScaleTenantId)
        .gte("date", startDate)
        .lt("date", endDate),

      // 4. Perfiles de setters
      supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "setter")
        .eq("internal_tenant_id", smartScaleTenantId),

      // 5. Cierres (clientes con setter asignado, creados en el mes)
      supabase
        .from("crm_clients")
        .select("id, setter_id, name, total_amount")
        .eq("client_id", smartScaleTenantId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .not("setter_id", "is", null),

      // 6. Vencido — cuotas sin pagar con due_date ANTES del mes (backlog)
      supabase
        .from("crm_installments")
        .select("id, client_id, amount, due_date, installment_number, crm_clients!inner(id, name)")
        .eq("crm_clients.client_id", smartScaleTenantId)
        .lt("due_date", startDate)
        .is("paid_at", null)
        .order("due_date", { ascending: true })
        .limit(100),

      // 7. Del mes — cuotas sin pagar con due_date DENTRO del mes
      supabase
        .from("crm_installments")
        .select("id, client_id, amount, due_date, installment_number, crm_clients!inner(id, name)")
        .eq("crm_clients.client_id", smartScaleTenantId)
        .gte("due_date", startDate)
        .lt("due_date", endDate)
        .is("paid_at", null)
        .order("due_date", { ascending: true })
        .limit(100),
    ])

    // ── Bloque 1: New Cash ───────────────────────────────────────────────────
    const newClients     = newClientsRes.data ?? []
    const newClientIdList = newClients.map(c => c.id)

    // Traer todas las cuotas de los clientes nuevos (pagadas y pendientes)
    let newClientInstallments: { client_id: string; amount: number; paid_at: string | null }[] = []
    if (newClientIdList.length > 0) {
      const { data } = await supabase
        .from("crm_installments")
        .select("client_id, amount, paid_at")
        .in("client_id", newClientIdList)
      newClientInstallments = (data ?? []).map(i => ({
        client_id: i.client_id,
        amount:    Number(i.amount),
        paid_at:   i.paid_at,
      }))
    }

    // Agrupar por cliente
    const instByClient: Record<string, { amount: number; paid_at: string | null }[]> = {}
    for (const inst of newClientInstallments) {
      if (!instByClient[inst.client_id]) instByClient[inst.client_id] = []
      instByClient[inst.client_id].push(inst)
    }

    let newCashTotalContracted = 0
    let newCashTotalPaid       = 0
    let newCashTotalPending    = 0

    const newCashClients = newClients.map(c => {
      const insts      = instByClient[c.id] ?? []
      const paid       = insts.filter(i => i.paid_at != null).reduce((s, i) => s + i.amount, 0)
      const pending    = insts.filter(i => i.paid_at == null).reduce((s, i) => s + i.amount, 0)
      const contracted = Number(c.total_amount ?? 0) || (Number(c.installment_amount) * Number(c.num_installments))
      newCashTotalContracted += contracted
      newCashTotalPaid       += paid
      newCashTotalPending    += pending
      return {
        id:             c.id,
        name:           c.name,
        total_amount:   contracted,
        paid_amount:    paid,
        pending_amount: pending,
        program_start:  c.program_start,
        created_at:     c.created_at,
        programa:       c.programa,
      }
    })

    // ── Bloque 2: Old Cash ───────────────────────────────────────────────────
    // Cuotas cobradas en el mes de clientes creados ANTES del mes
    const allPaidInPeriod = paidInPeriodRes.data ?? []
    const oldCashItems    = allPaidInPeriod.filter(i => {
      const clientCreatedAt = (i.crm_clients as any)?.created_at
      return clientCreatedAt && new Date(clientCreatedAt) < new Date(startIso)
    })
    const oldCashTotal = oldCashItems.reduce((s, i) => s + Number(i.amount), 0)

    // ── Bloque 3: Setting ────────────────────────────────────────────────────
    const settingLogs    = settingLogsRes.data    ?? []
    const setterProfiles = setterProfilesRes.data ?? []
    const cierresRaw     = cierresRes.data        ?? []

    const setterNameMap: Record<string, string> = {}
    for (const p of setterProfiles) setterNameMap[p.id] = p.name ?? "Sin nombre"

    type SetterAgg = {
      setter_id:                  string
      setter_name:                string
      new_conversations_inbound:  number
      new_conversations_outbound: number
      outbound_replies:           number
      total_conversations:        number   // inbound + outbound_replies
      qualified_leads:            number
      offer_docs_sent:            number
      offer_doc_responses:        number
      calls_done:                 number
      cash_collected:             number
      cierres:                    number
      cierre_amount:              number
    }
    const setterAgg: Record<string, SetterAgg> = {}

    const ensureSetter = (id: string) => {
      if (!setterAgg[id]) setterAgg[id] = {
        setter_id: id, setter_name: setterNameMap[id] ?? "Setter",
        new_conversations_inbound:  0,
        new_conversations_outbound: 0,
        outbound_replies:           0,
        total_conversations:        0,
        qualified_leads:            0,
        offer_docs_sent:            0,
        offer_doc_responses:        0,
        calls_done:                 0,
        cash_collected:             0,
        cierres:                    0,
        cierre_amount:              0,
      }
    }

    for (const log of settingLogs) {
      ensureSetter(log.setter_id)
      const a = setterAgg[log.setter_id]
      a.new_conversations_inbound  += log.new_conversations_inbound  ?? 0
      a.new_conversations_outbound += log.new_conversations_outbound ?? 0
      a.outbound_replies           += log.outbound_replies           ?? 0
      a.qualified_leads            += log.qualified_leads            ?? 0
      a.offer_docs_sent            += log.offer_docs_sent            ?? 0
      a.offer_doc_responses        += log.offer_doc_responses        ?? 0
      a.calls_done                 += log.calls_done                 ?? 0
      a.cash_collected             += Number(log.cash_collected ?? 0)
    }

    // Recompute total_conversations after aggregation
    for (const a of Object.values(setterAgg)) {
      a.total_conversations = a.new_conversations_inbound + a.outbound_replies
    }

    for (const c of cierresRaw) {
      if (!c.setter_id) continue
      ensureSetter(c.setter_id)
      setterAgg[c.setter_id].cierres       += 1
      setterAgg[c.setter_id].cierre_amount += Number(c.total_amount ?? 0)
    }

    const settingBySetter = Object.values(setterAgg).sort(
      (a, b) => b.cierres - a.cierres || b.total_conversations - a.total_conversations,
    )

    const zero: Omit<SetterAgg, "setter_id" | "setter_name"> = {
      new_conversations_inbound:  0,
      new_conversations_outbound: 0,
      outbound_replies:           0,
      total_conversations:        0,
      qualified_leads:            0,
      offer_docs_sent:            0,
      offer_doc_responses:        0,
      calls_done:                 0,
      cash_collected:             0,
      cierres:                    0,
      cierre_amount:              0,
    }
    const settingTotals = settingBySetter.reduce((t, s) => ({
      new_conversations_inbound:  t.new_conversations_inbound  + s.new_conversations_inbound,
      new_conversations_outbound: t.new_conversations_outbound + s.new_conversations_outbound,
      outbound_replies:           t.outbound_replies           + s.outbound_replies,
      total_conversations:        t.total_conversations        + s.total_conversations,
      qualified_leads:            t.qualified_leads            + s.qualified_leads,
      offer_docs_sent:            t.offer_docs_sent            + s.offer_docs_sent,
      offer_doc_responses:        t.offer_doc_responses        + s.offer_doc_responses,
      calls_done:                 t.calls_done                 + s.calls_done,
      cash_collected:             t.cash_collected             + s.cash_collected,
      cierres:                    t.cierres                    + s.cierres,
      cierre_amount:              t.cierre_amount              + s.cierre_amount,
    }), zero)

    // ── Bloque 4: Cuotas próximas ────────────────────────────────────────────
    const overdueRaw  = overdueRes.data  ?? []
    const upcomingRaw = upcomingRes.data ?? []
    const todayMs     = new Date(today + "T00:00:00Z").getTime()

    const overdue = overdueRaw.map(i => ({
      id:                 i.id,
      client_name:        (i.crm_clients as any)?.name ?? "—",
      client_id:          i.client_id,
      amount:             Number(i.amount),
      due_date:           i.due_date,
      installment_number: i.installment_number,
      days_overdue:       Math.max(0, Math.ceil((todayMs - new Date(i.due_date + "T00:00:00Z").getTime()) / 86400000)),
    }))

    const upcoming = upcomingRaw.map(i => ({
      id:                 i.id,
      client_name:        (i.crm_clients as any)?.name ?? "—",
      client_id:          i.client_id,
      amount:             Number(i.amount),
      due_date:           i.due_date,
      installment_number: i.installment_number,
      days_until_due:     Math.max(0, Math.ceil((new Date(i.due_date + "T00:00:00Z").getTime() - todayMs) / 86400000)),
    }))

    // MRR = cuotas sin pagar que vencen este mes (mismo total que "upcoming_quotas.upcoming_total"
    // más abajo) — antes usaba calculateCompanyMRR (un promedio amortizado de toda la cartera
    // activa), que no reflejaba lo que realmente se cobra en el mes y confundía en el dashboard.
    const mrr = upcomingRaw.reduce((s, i) => s + Number(i.amount), 0)

    return NextResponse.json({
      month,
      period_start: startDate,
      period_end:   lastDayDate,
      mrr,
      new_cash: {
        client_count:     newCashClients.length,
        total_contracted: newCashTotalContracted,
        total_paid:       newCashTotalPaid,
        total_pending:    newCashTotalPending,
        clients:          newCashClients,
      },
      old_cash: {
        installment_count: oldCashItems.length,
        total_collected:   oldCashTotal,
        installments:      oldCashItems.map(i => ({
          id:                 i.id,
          client_name:        (i.crm_clients as any)?.name ?? "—",
          client_id:          i.client_id,
          amount:             Number(i.amount),
          paid_at:            i.paid_at,
          installment_number: i.installment_number,
        })),
      },
      setting: {
        totals:    settingTotals,
        by_setter: settingBySetter,
      },
      upcoming_quotas: {
        overdue_count:  overdue.length,
        overdue_total:  overdueRaw.reduce((s, i) => s + Number(i.amount), 0),
        upcoming_count: upcoming.length,
        upcoming_total: upcomingRaw.reduce((s, i) => s + Number(i.amount), 0),
        overdue,
        upcoming,
      },
    })
  } catch (err: any) {
    console.error("executive-dashboard error:", err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
