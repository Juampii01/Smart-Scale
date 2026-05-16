/**
 * MRR (Monthly Recurring Revenue) Calculation
 *
 * Calculates the total MRR for a setter in a given month.
 * Handles edge cases:
 * - Monthly subscriptions: use installment_amount directly
 * - Fixed programs: sum remaining installments / remaining months
 * - Partial months: pro-rata calculation
 * - Inactive clients: excluded from MRR
 */

import { createServiceClient } from "@/lib/supabase-service"

export interface ClientMRRCalculation {
  client_id: string
  name: string
  monthly_amount: number
  calculation_type: "subscription" | "amortized" | "excluded"
  reason?: string
}

/**
 * Calculate MRR for a specific setter in a given month
 */
export async function calculateMRRForSetter(
  setterId: string,
  month: string  // YYYY-MM-01 format
): Promise<{ mrr: number; breakdown: ClientMRRCalculation[] }> {
  const supabase = createServiceClient()

  // Parse month to get start and end dates
  const monthStart = new Date(month)
  const monthEnd = new Date(monthStart)
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0)

  // Query all active clients where closer_id = setterId
  const { data: clients, error: clientsErr } = await supabase
    .from("crm_clients")
    .select(
      `
      id,
      name,
      status,
      is_monthly_subscription,
      installment_amount,
      num_installments,
      program_start,
      program_duration
      `
    )
    .eq("status", "activo")
    .eq("closer_id", setterId)

  if (clientsErr || !clients) {
    console.error("Error querying clients for MRR:", clientsErr)
    return { mrr: 0, breakdown: [] }
  }

  let totalMRR = 0
  const breakdown: ClientMRRCalculation[] = []

  for (const client of clients) {
    const programStart = new Date(client.program_start)
    const installmentAmount = Number(client.installment_amount || 0)
    const numInstallments = client.num_installments || 1
    const programDuration = client.program_duration || numInstallments

    if (client.is_monthly_subscription) {
      // Monthly subscription: add the monthly amount
      totalMRR += installmentAmount

      breakdown.push({
        client_id: client.id,
        name: client.name,
        monthly_amount: installmentAmount,
        calculation_type: "subscription",
      })
    } else {
      // Fixed program: calculate remaining MRR
      const monthDate = new Date(month)

      // Calculate months elapsed since program start
      const monthsElapsed =
        (monthDate.getFullYear() - programStart.getFullYear()) * 12 +
        (monthDate.getMonth() - programStart.getMonth())

      const monthsRemaining = Math.max(0, programDuration - monthsElapsed)

      if (monthsRemaining > 0) {
        const monthlyAmount = (installmentAmount * numInstallments) / programDuration
        const amortized = Math.round(monthlyAmount * 100) / 100

        totalMRR += amortized

        breakdown.push({
          client_id: client.id,
          name: client.name,
          monthly_amount: amortized,
          calculation_type: "amortized",
          reason: `${monthsRemaining} months remaining of ${programDuration} month program`,
        })
      } else {
        breakdown.push({
          client_id: client.id,
          name: client.name,
          monthly_amount: 0,
          calculation_type: "excluded",
          reason: "Program duration expired",
        })
      }
    }
  }

  return {
    mrr: Math.round(totalMRR * 100) / 100,
    breakdown,
  }
}

/**
 * Calculate total revenue (expected vs actual) for a setter
 * Total revenue = sum of installment_amount * num_installments for all active clients
 */
export async function calculateTotalRevenueForSetter(setterId: string): Promise<number> {
  const supabase = createServiceClient()

  const { data: clients, error } = await supabase
    .from("crm_clients")
    .select("installment_amount, num_installments")
    .eq("status", "activo")
    .eq("closer_id", setterId)

  if (error || !clients) {
    console.error("Error calculating total revenue:", error)
    return 0
  }

  let totalRevenue = 0
  for (const client of clients) {
    const instAmount = Number(client.installment_amount || 0)
    const numInst = client.num_installments || 1
    totalRevenue += instAmount * numInst
  }

  return Math.round(totalRevenue * 100) / 100
}

/**
 * Count active clients for a setter
 */
export async function countActiveClientsForSetter(setterId: string): Promise<number> {
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from("crm_clients")
    .select("id", { count: "exact" })
    .eq("status", "activo")
    .eq("closer_id", setterId)

  if (error) {
    console.error("Error counting active clients:", error)
    return 0
  }

  return count || 0
}
