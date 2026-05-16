/**
 * Calculations Index
 * Central export for all metric calculation functions
 */

export * from "./mrr"
export * from "./cash-collected"
export * from "./commissions"

import { createServiceClient } from "@/lib/supabase-service"
import { calculateMRRForSetter, calculateTotalRevenueForSetter, countActiveClientsForSetter } from "./mrr"
import { calculateCashCollected } from "./cash-collected"
import { calculateCommissionForSetter } from "./commissions"

/**
 * Calculate all metrics for a setter in a given month (orchestrator function)
 */
export async function calculateAllMetricsForSetter(
  setterId: string,
  month: string  // YYYY-MM-01 format
) {
  const supabase = createServiceClient()
  const monthStart = new Date(month)
  const monthEnd = new Date(monthStart)
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0)

  // Calculate all metrics in parallel
  const [mrrResult, totalRevenue, activeClients, cashResult, commission, inboundOutbound] =
    await Promise.all([
      calculateMRRForSetter(setterId, month),
      calculateTotalRevenueForSetter(setterId),
      countActiveClientsForSetter(setterId),
      calculateCashCollected(setterId, month),
      calculateCommissionForSetter(setterId, month),
      // Get inbound/outbound from daily logs
      supabase
        .from("setting_daily_logs")
        .select("inbound_applications, outbound_leads")
        .eq("setter_id", setterId)
        .gte("date", month)
        .lt("date", monthEnd.toISOString().slice(0, 10)),
    ])

  // Aggregate inbound/outbound from daily logs
  let totalInbound = 0
  let totalOutbound = 0

  if (inboundOutbound[1]) {
    for (const log of inboundOutbound[1]) {
      totalInbound += log.inbound_applications || 0
      totalOutbound += log.outbound_leads || 0
    }
  }

  return {
    setter_id: setterId,
    month,
    cash_collected: cashResult.cash_collected,
    total_revenue: totalRevenue,
    mrr: mrrResult.mrr,
    inbound_applications: totalInbound,
    outbound_leads: totalOutbound,
    new_clients_added: 0,  // TODO: count clients created in this month
    active_clients: activeClients,
    total_commissions: commission.commission_amount,
    commission_breakdown: {
      percentage: commission.commission_percentage,
      amount: commission.commission_amount,
    },
    mrr_breakdown: mrrResult.breakdown,
  }
}
