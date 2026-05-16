import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { calculateCashCollected } from "@/lib/calculations"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/setting/metrics/clients
 *
 * Drill-down view: List clients for a setter with revenue contribution
 *
 * Query params:
 *   setter_id  uuid   — required, setter to fetch clients for
 *   month      string — optional, YYYY-MM-01 format
 *   sort_by    string — optional, 'cash' | 'mrr' | 'name' (default: 'cash')
 *   limit      number — optional, max records (default: 50)
 *
 * Returns list of clients with their revenue contribution
 */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const caller = await requireInternal(jwt)
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const setterId = req.nextUrl.searchParams.get("setter_id")
    const month = req.nextUrl.searchParams.get("month")
    const sortBy = req.nextUrl.searchParams.get("sort_by") || "cash"
    const limitStr = req.nextUrl.searchParams.get("limit")
    const limit = limitStr ? parseInt(limitStr) : 50

    if (!setterId) {
      return NextResponse.json({ error: "setter_id is required" }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get all active clients for this setter
    const { data: clients, error: clientsErr } = await supabase
      .from("crm_clients")
      .select(
        `
        id,
        name,
        email,
        program_start,
        status,
        installment_amount,
        num_installments,
        is_monthly_subscription,
        program_duration
        `
      )
      .eq("closer_id", setterId)
      .eq("status", "activo")
      .limit(limit)

    if (clientsErr || !clients) {
      return NextResponse.json({ error: clientsErr?.message }, { status: 500 })
    }

    // Get cash collected for this month
    const currentMonth = month || new Date().toISOString().slice(0, 7) + "-01"
    const { payments: paymentsThisMonth } = await calculateCashCollected(setterId, currentMonth)

    // Enrich clients with revenue data
    const enrichedClients = clients.map((client) => {
      // Calculate MRR for this client
      const programStart = new Date(client.program_start)
      const now = new Date(currentMonth)
      const monthsElapsed =
        (now.getFullYear() - programStart.getFullYear()) * 12 +
        (now.getMonth() - programStart.getMonth())

      let monthlyAmount = 0
      if (client.is_monthly_subscription) {
        monthlyAmount = Number(client.installment_amount || 0)
      } else {
        const programDuration = client.program_duration || client.num_installments || 1
        const monthsRemaining = Math.max(0, programDuration - monthsElapsed)
        if (monthsRemaining > 0) {
          monthlyAmount =
            (Number(client.installment_amount || 0) * (client.num_installments || 1)) /
            programDuration
        }
      }

      // Calculate cash collected from this client this month
      const clientPayments = paymentsThisMonth.filter((p) => p.client_id === client.id)
      const cashThisMonth = clientPayments.reduce((sum, p) => sum + p.amount, 0)

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        status: client.status,
        program_start: client.program_start,
        mrr: Math.round(monthlyAmount * 100) / 100,
        cash_this_month: Math.round(cashThisMonth * 100) / 100,
        total_program_value: Number(client.installment_amount || 0) * (client.num_installments || 1),
      }
    })

    // Sort clients
    let sorted = [...enrichedClients]
    switch (sortBy) {
      case "mrr":
        sorted.sort((a, b) => b.mrr - a.mrr)
        break
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "cash":
      default:
        sorted.sort((a, b) => b.cash_this_month - a.cash_this_month)
        break
    }

    // Calculate summary stats
    const totalMRR = sorted.reduce((sum, c) => sum + c.mrr, 0)
    const totalCashThisMonth = sorted.reduce((sum, c) => sum + c.cash_this_month, 0)
    const totalProgramValue = sorted.reduce((sum, c) => sum + c.total_program_value, 0)

    return NextResponse.json({
      ok: true,
      month: currentMonth,
      clients: sorted,
      summary: {
        total_clients: sorted.length,
        total_mrr: Math.round(totalMRR * 100) / 100,
        total_cash_this_month: Math.round(totalCashThisMonth * 100) / 100,
        total_program_value: Math.round(totalProgramValue * 100) / 100,
        average_mrr: Math.round((totalMRR / Math.max(1, sorted.length)) * 100) / 100,
      },
    })
  } catch (err: any) {
    console.error("Error in /api/admin/setting/metrics/clients:", err)
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 })
  }
}
