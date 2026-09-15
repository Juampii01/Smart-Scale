import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { resolveInternalScope } from "@/lib/auth/internal-scope"
import { calculateCompanyMRR } from "@/lib/calculations/mrr"
import { calculateCompanyCashCollected } from "@/lib/calculations/cash-collected"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PrefillField =
  | { value: number; source: string }
  | { value: null; reason: string }

const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * GET /api/monthly-reports/prefill?month=YYYY-MM&client_id=<uuid>
 *
 * Trae, solo lectura, lo que la plataforma ya sabe para prellenar el
 * Reporte Mensual (Commit 3 del wizard de 5 pasos): cash_collected, mrr,
 * new_clients, active_clients — cada uno con su valor y de dónde salió, o
 * `null` con un motivo si no hay una fuente confiable.
 *
 * Auth: resolveInternalScope (no requireInternal) — el `client_id` pedido
 * se resuelve contra el tenant real del caller (solo el platform owner
 * puede pedir uno distinto al propio), igual que /api/admin/setting/commissions.
 * Esto es a propósito: los cuatro campos salen de crm_clients/crm_installments,
 * que son multi-tenant y viven aisladas por internal_tenant_id — un cliente
 * de portal sin sector interno propio (la inmensa mayoría) no tiene ninguna
 * fila ahí, así que para esas cuentas el prefill siempre va a volver
 * `null` con motivo y el campo se completa a mano, como corresponde.
 *
 * Reglas duras: solo lectura — ninguna escritura a crm_clients,
 * crm_installments ni payments.
 */
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveInternalScope(req, req.nextUrl.searchParams.get("client_id"))
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const month = req.nextUrl.searchParams.get("month")
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month (YYYY-MM) is required" }, { status: 400 })
    }

    const monthValue = `${month}-01`
    const [y, m] = month.split("-").map(Number)
    const monthStart = new Date(y, m - 1, 1)
    const monthEndExclusive = new Date(y, m, 1)
    const monthLabel = `${MONTH_NAMES_ES[m - 1]} ${y}`

    const supabase = createServiceClient()

    // ── ¿Este tenant tiene datos de CRM? ────────────────────────────────────
    // Si no tiene ninguna fila en crm_clients, ninguno de los cuatro campos
    // tiene de dónde salir — se devuelven los cuatro en null con el mismo
    // motivo, en vez de simular una fuente que no existe.
    const { count: crmClientCount, error: countErr } = await supabase
      .from("crm_clients")
      .select("id", { count: "exact", head: true })
      .eq("client_id", scope.tenantId)

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 })
    }

    if (!crmClientCount) {
      const reason = "Este cliente no tiene datos de CRM (crm_clients) asociados — queda manual."
      const empty: PrefillField = { value: null, reason }
      return NextResponse.json({
        cash_collected: empty,
        mrr: empty,
        new_clients: empty,
        active_clients: empty,
      })
    }

    // ── cash_collected ───────────────────────────────────────────────────────
    const { cash_collected } = await calculateCompanyCashCollected(monthValue, scope.tenantId)
    const cashCollectedField: PrefillField = {
      value: cash_collected,
      source: `Cuotas cobradas en ${monthLabel}`,
    }

    // ── mrr ───────────────────────────────────────────────────────────────────
    const { mrr } = await calculateCompanyMRR(monthValue, scope.tenantId)

    // Desglose de cuotas que VENCEN en el mes (no las que se cobraron) para
    // armar la línea "Cuotas que vencen en <mes>: N cobradas · N pendiente · N vencidas".
    const { data: tenantClients } = await supabase
      .from("crm_clients")
      .select("id")
      .eq("client_id", scope.tenantId)
    const tenantClientIds = (tenantClients ?? []).map((c: any) => c.id)

    let mrrField: PrefillField
    if (tenantClientIds.length === 0) {
      mrrField = { value: mrr, source: `Cuotas que vencen en ${monthLabel}: sin clientes activos` }
    } else {
      const { data: dueInstallments } = await supabase
        .from("crm_installments")
        .select("id, paid_at, due_date")
        .in("client_id", tenantClientIds)
        .gte("due_date", monthStart.toISOString().slice(0, 10))
        .lt("due_date", monthEndExclusive.toISOString().slice(0, 10))

      const now = new Date()
      let paidCount = 0, pendingCount = 0, overdueCount = 0
      for (const inst of dueInstallments ?? []) {
        if (inst.paid_at) { paidCount++; continue }
        const due = new Date(inst.due_date)
        if (due < now) overdueCount++
        else pendingCount++
      }

      mrrField = {
        value: mrr,
        source: `Cuotas que vencen en ${monthLabel}: ${pluralize(paidCount, "cobrada", "cobradas")} · ${pluralize(pendingCount, "pendiente", "pendientes")} · ${pluralize(overdueCount, "vencida", "vencidas")}`,
      }
    }

    // ── new_clients ───────────────────────────────────────────────────────────
    const { count: newClientsCount, error: newClientsErr } = await supabase
      .from("crm_clients")
      .select("id", { count: "exact", head: true })
      .eq("client_id", scope.tenantId)
      .gte("program_start", monthStart.toISOString().slice(0, 10))
      .lt("program_start", monthEndExclusive.toISOString().slice(0, 10))

    const newClientsField: PrefillField = newClientsErr
      ? { value: null, reason: newClientsErr.message }
      : { value: newClientsCount ?? 0, source: `Altas de CRM con program_start en ${monthLabel}` }

    // ── active_clients ───────────────────────────────────────────────────────
    // crm_clients.status no tiene historial — solo se puede confiar en el
    // estado ACTUAL, no en "cómo estaba al cierre de <mes>" para un mes
    // pasado. Solo se auto-completa cuando el mes pedido es el mes actual.
    const now = new Date()
    const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m

    let activeClientsField: PrefillField
    if (!isCurrentMonth) {
      activeClientsField = {
        value: null,
        reason: "crm_clients.status no guarda historial — solo se puede confiar en el estado actual, no en cómo estaba al cierre de un mes pasado.",
      }
    } else {
      const { count: activeCount, error: activeErr } = await supabase
        .from("crm_clients")
        .select("id", { count: "exact", head: true })
        .eq("client_id", scope.tenantId)
        .eq("status", "activo")

      activeClientsField = activeErr
        ? { value: null, reason: activeErr.message }
        : { value: activeCount ?? 0, source: "Clientes con status = 'activo' (estado actual)" }
    }

    return NextResponse.json({
      cash_collected: cashCollectedField,
      mrr: mrrField,
      new_clients: newClientsField,
      active_clients: activeClientsField,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
