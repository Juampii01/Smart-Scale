import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { calculateAllMetricsForSetter } from "@/lib/calculations"

export const runtime = "nodejs"

/**
 * GET /api/cron/settle-monthly-metrics
 *
 * Daily cron job (scheduled at 12:00 UTC via Vercel)
 * Calculates and caches monthly metrics for all setters in the current month.
 *
 * This avoids expensive real-time calculations when the dashboard is accessed.
 * Runs once per day and updates the setter_monthly_metrics table.
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (optional, for security)
    const cronSecret = req.headers.get("x-vercel-cron-secret")
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get current month in YYYY-MM-01 format
    const now = new Date()
    const currentMonth = now.toISOString().slice(0, 7) + "-01"

    // Get all setters (users with role='setter')
    const { data: setters, error: settersErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "setter")

    if (settersErr || !setters) {
      console.error("Error fetching setters:", settersErr)
      return NextResponse.json({ error: "Failed to fetch setters" }, { status: 500 })
    }

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Calculate metrics for each setter
    for (const setter of setters) {
      try {
        const metrics = await calculateAllMetricsForSetter(setter.id, currentMonth)

        // Upsert metrics
        const { error: upsertErr } = await supabase.from("setter_monthly_metrics").upsert(
          {
            setter_id: setter.id,
            month: currentMonth,
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
          errors.push(`Setter ${setter.id}: ${upsertErr.message}`)
          errorCount++
        } else {
          // Also upsert commission record
          await supabase.from("setter_commissions").upsert(
            {
              setter_id: setter.id,
              period: currentMonth,
              cash_collected_basis: metrics.cash_collected,
              commission_percentage: metrics.commission_breakdown.percentage,
              commission_amount: metrics.commission_breakdown.amount,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "setter_id, period" }
          )

          successCount++
        }
      } catch (err: any) {
        errors.push(`Setter ${setter.id}: ${err?.message}`)
        errorCount++
      }
    }

    const message = `Cron job completed: ${successCount} setters processed, ${errorCount} errors`
    console.log(message, errors)

    return NextResponse.json({
      ok: errorCount === 0,
      message,
      summary: {
        total_setters: setters.length,
        success_count: successCount,
        error_count: errorCount,
      },
      month: currentMonth,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error("Error in cron job:", err)
    return NextResponse.json(
      { error: err?.message ?? "Internal error in cron job" },
      { status: 500 }
    )
  }
}
