import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COMMISSION_RATE = 0.05  // 5% sobre todo el cash cobrado (new + old)

interface SetterCommissions {
  setter_id: string
  setter_name: string | null
  new_count: number          // clientes que CERRARON este mes (program_start en el mes)
  paid_count: number         // clientes que pagaron alguna cuota este mes (nuevos + viejos)
  mrr_total: number          // Revenue = valor de contrato SOLO de los cierres nuevos del mes
  new_cash: number           // cash de este mes proveniente de cierres de este mes
  old_cash: number           // cash de este mes proveniente de cierres de meses anteriores
  cash_collected: number     // new_cash + old_cash (base de la comisión)
  commission_earned: number  // cash_collected * 5%
}

/** GET — métricas de comisión de un setter o de todos
 * ?month=YYYY-MM — requerido (ej: 2026-05)
 * ?setter_id={uuid} — opcional; si va, devuelve solo ese setter
 *
 * Semántica (definida con el equipo):
 *   • Un cliente es "nuevo" si su program_start (fecha de cierre) cae en el mes consultado.
 *   • Revenue   = valor de contrato de los cierres NUEVOS del mes.
 *   • New Cash  = cuotas pagadas este mes de esos cierres nuevos.
 *   • Old Cash  = cuotas pagadas este mes de clientes que cerraron en meses anteriores.
 *   • Comisión  = 5% de (New Cash + Old Cash).
 */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const month = req.nextUrl.searchParams.get("month") // "2026-05"
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month (YYYY-MM) is required" }, { status: 400 })
    }

    const setterId = req.nextUrl.searchParams.get("setter_id")
    const supabase = createServiceClient()

    // program_start = fecha de cierre (la pone el webhook desde "fecha_cierre")
    let query = supabase
      .from("crm_clients")
      .select(`
        setter_id,
        setter,
        id,
        program_start,
        total_amount,
        installment_amount,
        num_installments,
        status,
        crm_installments(client_id, amount, paid_at)
      `)
      .neq("status", "inactivo")

    if (setterId) query = query.eq("setter_id", setterId)

    const result = await query
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }
    const clients = result.data ?? []

    // Nombres de setters
    const setterIds = new Set<string>()
    for (const c of clients) if ((c as any).setter_id) setterIds.add((c as any).setter_id)

    const setterProfiles = new Map<string, string | null>()
    if (setterIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", Array.from(setterIds))
      for (const p of profiles ?? []) setterProfiles.set((p as any).id, (p as any).name ?? null)
    }

    // Ventana del mes [monthStart, monthEndExclusive)
    const [y, m] = month.split("-").map(Number)
    const monthStart = new Date(y, m - 1, 1)
    const monthEndExclusive = new Date(y, m, 1)

    const setterMap = new Map<string, SetterCommissions>()
    const ensure = (sid: string, name: string | null): SetterCommissions => {
      let rec = setterMap.get(sid)
      if (!rec) {
        rec = {
          setter_id: sid, setter_name: name,
          new_count: 0, paid_count: 0, mrr_total: 0,
          new_cash: 0, old_cash: 0, cash_collected: 0, commission_earned: 0,
        }
        setterMap.set(sid, rec)
      }
      return rec
    }

    for (const client of clients) {
      const rawSid = ((client as any).setter_id as string | null) || null
      const rawSetterText = (((client as any).setter as string | null) ?? "").trim() || null
      // Setters con perfil → se agrupan por uuid. Setters sin perfil (ej: Fabri, que
      // dejó el equipo pero sigue cobrando comisión) → se agrupan por crm_clients.setter (texto).
      const groupKey = rawSid ?? (rawSetterText ? `text:${rawSetterText}` : null)
      if (!groupKey) continue

      // ¿Cerró este mes? — por program_start (date "YYYY-MM-DD")
      const programStart: string | null = (client as any).program_start ?? null
      const closeYm = programStart ? String(programStart).slice(0, 7) : null
      const isNew = closeYm === month

      // Cash cobrado este mes (cuotas con paid_at dentro del mes)
      const installments = (client as any).crm_installments ?? []
      const cashThisMonth = installments.reduce((sum: number, inst: any) => {
        if (!inst.paid_at) return sum
        const paid = new Date(inst.paid_at)
        if (paid >= monthStart && paid < monthEndExclusive) return sum + (Number(inst.amount) || 0)
        return sum
      }, 0)

      // Solo cuenta si cerró este mes o pagó algo este mes
      if (!isNew && cashThisMonth === 0) continue

      const contractValue = Number((client as any).total_amount ?? 0) ||
        (Number((client as any).installment_amount ?? 0) * Number((client as any).num_installments ?? 1))

      const groupName = rawSid ? (setterProfiles.get(rawSid) ?? null) : rawSetterText
      const rec = ensure(groupKey, groupName)
      if (isNew) {
        rec.new_count += 1
        rec.mrr_total += contractValue
        rec.new_cash  += cashThisMonth
      } else {
        rec.old_cash  += cashThisMonth
      }
      if (cashThisMonth > 0) rec.paid_count += 1
    }

    // Totales finales por setter
    for (const rec of setterMap.values()) {
      rec.cash_collected = rec.new_cash + rec.old_cash
      rec.commission_earned = rec.cash_collected * COMMISSION_RATE
    }

    const commissions = Array.from(setterMap.values())

    if (setterId) {
      return NextResponse.json({ commission: commissions[0] ?? null })
    }
    return NextResponse.json({ commissions })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
