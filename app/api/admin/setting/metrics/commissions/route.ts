import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/setting/metrics/commissions
 *
 * Fetch commission records for a setter with optional filtering
 *
 * Query params:
 *   setter_id  uuid   — required, setter to fetch commissions for
 *   period     string — optional, YYYY-MM-01 format
 *   limit      number — optional, max records (default 12)
 *
 * Returns all commission records ordered by period descending
 */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const caller = await requireInternal(jwt)
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const setterId = req.nextUrl.searchParams.get("setter_id")
    const period = req.nextUrl.searchParams.get("period")
    const limitStr = req.nextUrl.searchParams.get("limit")
    const limit = limitStr ? parseInt(limitStr) : 12

    if (!setterId) {
      return NextResponse.json({ error: "setter_id is required" }, { status: 400 })
    }

    const supabase = createServiceClient()

    let query = supabase
      .from("setter_commissions")
      .select("*")
      .eq("setter_id", setterId)
      .order("period", { ascending: false })
      .limit(Math.min(limit, 100))  // max 100 records

    if (period) {
      query = query.eq("period", period)
    }

    const { data: commissions, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate totals
    let totalCommissions = 0
    let totalCashBasis = 0

    for (const comm of commissions || []) {
      totalCommissions += Number(comm.commission_amount || 0)
      totalCashBasis += Number(comm.cash_collected_basis || 0)
    }

    return NextResponse.json({
      ok: true,
      commissions: (commissions || []).map((c) => ({
        id: c.id,
        period: c.period,
        cash_collected: Number(c.cash_collected_basis),
        commission_percentage: Number(c.commission_percentage),
        commission_amount: Number(c.commission_amount),
        created_at: c.created_at,
      })),
      summary: {
        total_records: commissions?.length || 0,
        total_cash_basis: totalCashBasis,
        total_commissions: totalCommissions,
        average_commission: commissions && commissions.length > 0
          ? totalCommissions / commissions.length
          : 0,
      },
    })
  } catch (err: any) {
    console.error("Error in /api/admin/setting/metrics/commissions:", err)
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 })
  }
}
