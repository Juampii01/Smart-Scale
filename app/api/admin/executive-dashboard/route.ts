import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getRangeDays(range: string): number {
  if (range === "7d")  return 7
  if (range === "14d") return 14
  return 30
}

/**
 * GET /api/admin/executive-dashboard?range=7d|14d|30d
 *
 * Devuelve 4 bloques consolidados para el Dashboard Ejecutivo:
 *  1. new_cash     — clientes nuevos + sus cuotas cobradas/pendientes en el período
 *  2. old_cash     — cuotas cobradas en el período de clientes que ya existían antes
 *  3. setting      — métricas de setting diarias + cierres, agrupadas por setter
 *  4. upcoming_quotas — cuotas vencidas (sin pagar) + próximas a vencer
 *
 * Solo admin.
 */
export async function GET(req: NextRequest) {
  try {
    const jwt    = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const caller = await requireAdmin(jwt)
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const range = searchParams.get("range") ?? "30d"
    const days  = getRangeDays(range)

    const now         = new Date()
    const periodStart = new Date(now)
    periodStart.setUTCDate(periodStart.getUTCDate() - days)
    const periodStartIso  = periodStart.toISOString()
    const periodStartDate = periodStart.toISOString().slice(0, 10)
    const today           = now.toISOString().slice(0, 10)
    const upcomingEnd     = new Date(now)
    upcomingEnd.setUTCDate(upcomingEnd.getUTCDate() + days)
    const upcomingEndStr  = upcomingEnd.toISOString().slice(0, 10)

    const supabase = createServiceClient()

    // ── Queries en paralelo ──────────────────────────────────────────────────
    const [
      newClientsRes,
      paidInPeriodRes,
      settingLogsRes,
      setterProfilesRes,
      cierresRes,
      overdueRes,
      upcomingRes,
    ] = await Promise.all([
      // 1. Clientes creados en el período
      supabase
        .from("crm_clients")
        .select("id, name, total_amount, installment_amount, num_installments, created_at, program_start, setter_id, programa")
        .gte("created_at", periodStartIso)
        .order("created_at", { ascending: false }),

      // 2. Cuotas cobradas en el período (con info del cliente)
      supabase
        .from("crm_installments")
        .select("id, client_id, amount, paid_at, installment_number, crm_clients!inner(id, name, created_at)")
        .gte("paid_at", periodStartIso)
        .order("paid_at", { ascending: false }),

      // 3. Logs de setting en el período
      supabase
        .from("setting_daily_logs")
        .select("setter_id, new_conversations, qualified_leads, offer_docs_sent, calls_done, cash_collected")
        .gte("date", periodStartDate),

      // 4. Perfiles de setters
      supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "setter"),

      // 5. Cierres (clientes con setter asignado en el período)
      supabase
        .from("crm_clients")
        .select("id, setter_id, name, total_amount")
        .gte("created_at", periodStartIso)
        .not("setter_id", "is", null),

      // 6. Cuotas vencidas sin pagar
      supabase
        .from("crm_installments")
        .select("id, client_id, amount, due_date, installment_number, crm_clients!inner(id, name)")
        .lt("due_date", today)
        .is("paid_at", null)
        .order("due_date", { ascending: true })
        .limit(100),

      // 7. Cuotas próximas sin pagar (dentro del rango)
      supabase
        .from("crm_installments")
        .select("id, client_id, amount, due_date, installment_number, crm_clients!inner(id, name)")
        .gte("due_date", today)
        .lte("due_date", upcomingEndStr)
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
    // Cuotas cobradas en el período de clientes creados ANTES del período
    const allPaidInPeriod = paidInPeriodRes.data ?? []
    const oldCashItems    = allPaidInPeriod.filter(i => {
      const clientCreatedAt = (i.crm_clients as any)?.created_at
      return clientCreatedAt && new Date(clientCreatedAt) < new Date(periodStartIso)
    })
    const oldCashTotal = oldCashItems.reduce((s, i) => s + Number(i.amount), 0)

    // ── Bloque 3: Setting ────────────────────────────────────────────────────
    const settingLogs    = settingLogsRes.data    ?? []
    const setterProfiles = setterProfilesRes.data ?? []
    const cierresRaw     = cierresRes.data        ?? []

    const setterNameMap: Record<string, string> = {}
    for (const p of setterProfiles) setterNameMap[p.id] = p.name ?? "Sin nombre"

    type SetterAgg = {
      setter_id:         string
      setter_name:       string
      new_conversations: number
      qualified_leads:   number
      offer_docs_sent:   number
      calls_done:        number
      cash_collected:    number
      cierres:           number
      cierre_amount:     number
    }
    const setterAgg: Record<string, SetterAgg> = {}

    const ensureSetter = (id: string) => {
      if (!setterAgg[id]) setterAgg[id] = {
        setter_id: id, setter_name: setterNameMap[id] ?? "Setter",
        new_conversations: 0, qualified_leads: 0,
        offer_docs_sent: 0,   calls_done: 0,
        cash_collected: 0,    cierres: 0, cierre_amount: 0,
      }
    }

    for (const log of settingLogs) {
      ensureSetter(log.setter_id)
      const a = setterAgg[log.setter_id]
      a.new_conversations += log.new_conversations ?? 0
      a.qualified_leads   += log.qualified_leads   ?? 0
      a.offer_docs_sent   += log.offer_docs_sent   ?? 0
      a.calls_done        += log.calls_done        ?? 0
      a.cash_collected    += Number(log.cash_collected ?? 0)
    }

    for (const c of cierresRaw) {
      if (!c.setter_id) continue
      ensureSetter(c.setter_id)
      setterAgg[c.setter_id].cierres       += 1
      setterAgg[c.setter_id].cierre_amount += Number(c.total_amount ?? 0)
    }

    const settingBySetter = Object.values(setterAgg).sort(
      (a, b) => b.cierres - a.cierres || b.new_conversations - a.new_conversations,
    )

    const zero = { new_conversations: 0, qualified_leads: 0, offer_docs_sent: 0, calls_done: 0, cash_collected: 0, cierres: 0, cierre_amount: 0 }
    const settingTotals = settingBySetter.reduce((t, s) => ({
      new_conversations: t.new_conversations + s.new_conversations,
      qualified_leads:   t.qualified_leads   + s.qualified_leads,
      offer_docs_sent:   t.offer_docs_sent   + s.offer_docs_sent,
      calls_done:        t.calls_done        + s.calls_done,
      cash_collected:    t.cash_collected    + s.cash_collected,
      cierres:           t.cierres           + s.cierres,
      cierre_amount:     t.cierre_amount     + s.cierre_amount,
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

    return NextResponse.json({
      range,
      period_start: periodStartDate,
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
