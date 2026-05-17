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
  commission_earned: number
}

/** GET — fetch commission metrics for a single setter or all setters
 * ?setter_id={uuid} — optional, if provided returns only that setter
 * Requires team/admin role
 */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const setterId = req.nextUrl.searchParams.get("setter_id")

    const supabase = createServiceClient()

    // Query: aggregate client and installment data by setter
    let query = supabase.rpc("get_setter_commissions" as any, {})

    // For now, we'll do it manually via raw SQL since RPC may not exist
    // Use raw query via postgres
    const result = setterId
      ? await supabase.from("crm_clients")
          .select(
            `
            setter_id,
            profiles!crm_clients_setter_id_fkey(id, name),
            id,
            installment_amount,
            num_installments,
            crm_installments(client_id, amount, paid_at)
            `
          )
          .eq("setter_id", setterId)
      : await supabase.from("crm_clients")
          .select(
            `
            setter_id,
            profiles!crm_clients_setter_id_fkey(id, name),
            id,
            installment_amount,
            num_installments,
            crm_installments(client_id, amount, paid_at)
            `
          )

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    // Aggregate data manually
    const setterMap = new Map<string, SetterCommissions>()

    const clients = result.data ?? []
    for (const client of clients) {
      const sid = (client as any).setter_id
      if (!sid) continue

      const profile = (client as any).profiles
      const mrrValue = ((client as any).installment_amount ?? 0) * ((client as any).num_installments ?? 1)
      const installments = (client as any).crm_installments ?? []
      const paidAmount = installments
        .filter((inst: any) => inst.paid_at != null)
        .reduce((sum: number, inst: any) => sum + (Number(inst.amount) || 0), 0)

      if (!setterMap.has(sid)) {
        setterMap.set(sid, {
          setter_id: sid,
          setter_name: profile?.name ?? null,
          client_count: 0,
          mrr_total: 0,
          cash_collected: 0,
          commission_earned: 0,
        })
      }

      const record = setterMap.get(sid)!
      record.client_count += 1
      record.mrr_total += mrrValue
      record.cash_collected += paidAmount
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
