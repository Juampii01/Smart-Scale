import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface SetterCommissions {
  setter_id: string
  setter_name: string | null
  client_count: number
  mrr_total: number
  cash_collected: number
  old_cash: number          // cash from clients closed in previous months
  new_cash: number          // cash from clients closed this month
  commission_earned: number
}

/** GET — fetch commission metrics for a single setter or all setters
 * ?month=YYYY-MM — required, e.g., 2026-05 (groups by payment month)
 * ?setter_id={uuid} — optional, if provided returns only that setter
 * Requires team/admin role
 */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const month = req.nextUrl.searchParams.get("month") // e.g., "2026-05"
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month (YYYY-MM) is required" }, { status: 400 })
    }

    const setterId = req.nextUrl.searchParams.get("setter_id")

    const supabase = createServiceClient()

    // Query: get all active clients with their installments (exclude inactive/churned)
    let query = supabase
      .from("crm_clients")
      .select(`
        setter_id,
        id,
        total_amount,
        installment_amount,
        num_installments,
        status,
        crm_installments(client_id, amount, paid_at)
      `)
      .neq("status", "inactivo")

    if (setterId) {
      query = query.eq("setter_id", setterId)
    }

    const result = await query

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    // Fetch setter names separately from profiles
    const setterIds = new Set<string>()
    const clients = result.data ?? []
    for (const client of clients) {
      if ((client as any).setter_id) {
        setterIds.add((client as any).setter_id)
      }
    }

    const setterProfiles = new Map<string, string | null>()
    if (setterIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", Array.from(setterIds))

      if (profiles) {
        for (const p of profiles) {
          setterProfiles.set((p as any).id, (p as any).name ?? null)
        }
      }
    }

    // Parse month to filter installments
    const [targetYear, targetMonth] = month.split("-").map(Number)
    const monthStart = new Date(targetYear, targetMonth - 1, 1)
    const monthEnd = new Date(targetYear, targetMonth, 0)

    // Get month when client was created (for old_cash detection)
    const clientCreationMonths = new Map<string, string>()
    for (const client of clients) {
      const cid = (client as any).id
      const created = (client as any).created_at
      if (created) {
        const createdDate = new Date(created)
        const createdYm = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, "0")}`
        clientCreationMonths.set(cid, createdYm)
      }
    }

    // Aggregate data manually
    const setterMap = new Map<string, SetterCommissions>()

    for (const client of clients) {
      const sid = (client as any).setter_id
      if (!sid) continue

      const setterName = setterProfiles.get(sid) ?? null
      // Revenue = valor total del contrato (total_amount)
      const mrrValue = Number((client as any).total_amount ?? 0) ||
        ((client as any).installment_amount ?? 0) * ((client as any).num_installments ?? 1)
      const installments = (client as any).crm_installments ?? []

      // Filter installments paid in the target month
      const installmentsPaidThisMonth = installments.filter((inst: any) => {
        if (!inst.paid_at) return false
        const paidDate = new Date(inst.paid_at)
        return paidDate >= monthStart && paidDate <= monthEnd
      })

      if (installmentsPaidThisMonth.length === 0) continue

      const cashThisMonth = installmentsPaidThisMonth.reduce(
        (sum: number, inst: any) => sum + (Number(inst.amount) || 0),
        0
      )

      // Determine if this is old_cash (client closed in previous month)
      const clientCreatedMonth: string = clientCreationMonths.get((client as any).id) ?? month
      const isOldCash = clientCreatedMonth !== month

      if (!setterMap.has(sid)) {
        setterMap.set(sid, {
          setter_id: sid,
          setter_name: setterName,
          client_count: 0,
          mrr_total: 0,
          cash_collected: 0,
          old_cash: 0,
          new_cash: 0,
          commission_earned: 0,
        })
      }

      const record = setterMap.get(sid)!
      record.client_count += 1
      record.mrr_total += mrrValue
      record.cash_collected += cashThisMonth
      if (isOldCash) {
        record.old_cash += cashThisMonth
      } else {
        record.new_cash += cashThisMonth
      }
      record.commission_earned = record.cash_collected * 0.05
    }

    const commissions = Array.from(setterMap.values())

    if (setterId) {
      const single = commissions[0] ?? null
      return NextResponse.json({ commission: single })
    }

    return NextResponse.json({ commissions })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
