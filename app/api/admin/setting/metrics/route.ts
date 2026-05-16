import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { calculateAllMetricsForSetter } from "@/lib/calculations"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/setting/metrics
 *
 * Fetch monthly metrics for a setter
 *
 * Query params:
 *   setter_id  uuid   — setter to fetch metrics for
 *   month      string — YYYY-MM-01 format (defaults to current month)
 *
 * Returns cached metrics from setter_monthly_metrics table, or calculates on-demand.
 */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const caller = await requireInternal(jwt)
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Get query parameters
    const setterId = req.nextUrl.searchParams.get("setter_id")
    let month = req.nextUrl.searchParams.get("month")

    if (!setterId) {
      return NextResponse.json({ error: "setter_id is required" }, { status: 400 })
    }

    // Default to current month if not provided
    if (!month) {
      const now = new Date()
      month = now.toISOString().slice(0, 7) + "-01"
    }

    // Validate month format YYYY-MM-01
    if (!/^\d{4}-\d{2}-01$/.test(month)) {
      return NextResponse.json({ error: "Invalid month format (use YYYY-MM-01)" }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Try to get cached metrics first
    const { data: cached, error: cacheErr } = await supabase
      .from("setter_monthly_metrics")
      .select("*")
      .eq("setter_id", setterId)
      .eq("month", month)
      .maybeSingle()

    // If cached metrics exist and are recent, return them
    if (cached) {
      return NextResponse.json({
        ok: true,
        metrics: {
          cash_collected: Number(cached.cash_collected),
          total_revenue: Number(cached.total_revenue),
          mrr: Number(cached.mrr),
          inbound_applications: cached.inbound_applications,
          outbound_leads: cached.outbound_leads,
          new_clients_added: cached.new_clients_added,
          active_clients: cached.active_clients,
          total_commissions: Number(cached.total_commissions),
        },
        cached_at: cached.updated_at,
      })
    }

    // Otherwise, calculate on-demand
    const metrics = await calculateAllMetricsForSetter(setterId, month)

    return NextResponse.json({
      ok: true,
      metrics: {
        cash_collected: metrics.cash_collected,
        total_revenue: metrics.total_revenue,
        mrr: metrics.mrr,
        inbound_applications: metrics.inbound_applications,
        outbound_leads: metrics.outbound_leads,
        new_clients_added: metrics.new_clients_added,
        active_clients: metrics.active_clients,
        total_commissions: metrics.total_commissions,
        commission_percentage: metrics.commission_breakdown.percentage,
      },
      calculated_at: new Date().toISOString(),
      note: "Calculated on-demand (not cached)",
    })
  } catch (err: any) {
    console.error("Error in /api/admin/setting/metrics:", err)
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/setting/metrics
 *
 * Force recalculation and cache of metrics for a setter in a given month
 * Used by cron job or manual refresh
 *
 * Body:
 *   setter_id  uuid   — setter to calculate metrics for
 *   month      string — YYYY-MM-01 format
 */
export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const caller = await requireInternal(jwt)
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const setterId = body.setter_id?.toString?.().trim()
    let month = body.month?.toString?.().trim()

    if (!setterId) {
      return NextResponse.json({ error: "setter_id is required" }, { status: 400 })
    }

    // Default to current month
    if (!month) {
      const now = new Date()
      month = now.toISOString().slice(0, 7) + "-01"
    }

    if (!/^\d{4}-\d{2}-01$/.test(month)) {
      return NextResponse.json({ error: "Invalid month format (use YYYY-MM-01)" }, { status: 400 })
    }

    // Calculate metrics
    const metrics = await calculateAllMetricsForSetter(setterId, month)

    // Upsert into setter_monthly_metrics table
    const supabase = createServiceClient()
    const { error: upsertErr } = await supabase.from("setter_monthly_metrics").upsert(
      {
        setter_id: setterId,
        month,
        cash_collected: metrics.cash_collected,
        total_revenue: metrics.total_revenue,
        mrr: metrics.mrr,
        inbound_applications: metrics.inbound_applications,
        outbound_leads: metrics.outbound_leads,
        new_clients_added: metrics.new_clients_added,
        active_clients: metrics.active_clients,
        total_commissions: metrics.total_commissions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setter_id, month" }
    )

    if (upsertErr) {
      console.error("Error upserting metrics:", upsertErr)
      return NextResponse.json(
        { error: `Failed to cache metrics: ${upsertErr.message}` },
        { status: 500 }
      )
    }

    // Also upsert commission record
    const { error: commErr } = await supabase.from("setter_commissions").upsert(
      {
        setter_id: setterId,
        period: month,
        cash_collected_basis: metrics.cash_collected,
        commission_percentage: metrics.commission_breakdown.percentage,
        commission_amount: metrics.commission_breakdown.amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setter_id, period" }
    )

    if (commErr) {
      console.error("Error upserting commission:", commErr)
      // Don't fail the entire request if commission insert fails
    }

    return NextResponse.json({
      ok: true,
      metrics: {
        cash_collected: metrics.cash_collected,
        total_revenue: metrics.total_revenue,
        mrr: metrics.mrr,
        inbound_applications: metrics.inbound_applications,
        outbound_leads: metrics.outbound_leads,
        active_clients: metrics.active_clients,
        total_commissions: metrics.total_commissions,
      },
      message: "Metrics calculated and cached successfully",
    })
  } catch (err: any) {
    console.error("Error in POST /api/admin/setting/metrics:", err)
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 })
  }
}
