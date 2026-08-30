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

type MRRClientRow = {
  id: string
  name: string
  is_monthly_subscription: boolean | null
  installment_amount: number | null
  num_installments: number | null
  program_start: string
  program_duration: number | null
}

/** Lógica compartida de amortización — separada para poder calcularla tanto
 *  por setter (calculateMRRForSetter) como para toda la empresa
 *  (calculateCompanyMRR), sin duplicar el loop. */
function computeMRRFromClients(clients: MRRClientRow[], month: string): { mrr: number; breakdown: ClientMRRCalculation[] } {
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
 * Calculate MRR for a specific setter in a given month
 */
export async function calculateMRRForSetter(
  setterId: string,
  month: string  // YYYY-MM-01 format
): Promise<{ mrr: number; breakdown: ClientMRRCalculation[] }> {
  const supabase = createServiceClient()

  const { data: clients, error: clientsErr } = await supabase
    .from("crm_clients")
    .select("id, name, status, is_monthly_subscription, installment_amount, num_installments, program_start, program_duration")
    .eq("status", "activo")
    .eq("closer_id", setterId)

  if (clientsErr || !clients) {
    console.error("Error querying clients for MRR:", clientsErr)
    return { mrr: 0, breakdown: [] }
  }

  return computeMRRFromClients(clients as MRRClientRow[], month)
}

/**
 * Calculate MRR para TODA la empresa de UN tenant (todos sus clientes
 * activos, sin filtrar por setter) — usado en el Dashboard Ejecutivo y
 * para pre-llenar el MRR del Reporte Mensual. `tenantId` es obligatorio:
 * crm_clients ahora es multi-tenant (20260814000001), y "toda la empresa"
 * sin ese filtro mezclaría la facturación de todos los sectores internos
 * en un solo número — ambos callers (executive-dashboard, mrr) son
 * pantallas exclusivas del tenant de Smart Scale, así que siempre pasan
 * ese tenant, pero la función no asume cuál es.
 */
export async function calculateCompanyMRR(
  month: string,  // YYYY-MM-01 format
  tenantId: string,
): Promise<{ mrr: number; breakdown: ClientMRRCalculation[] }> {
  const supabase = createServiceClient()

  const { data: clients, error: clientsErr } = await supabase
    .from("crm_clients")
    .select("id, name, status, is_monthly_subscription, installment_amount, num_installments, program_start, program_duration")
    .eq("status", "activo")
    .eq("client_id", tenantId)

  if (clientsErr || !clients) {
    console.error("Error querying clients for company MRR:", clientsErr)
    return { mrr: 0, breakdown: [] }
  }

  return computeMRRFromClients(clients as MRRClientRow[], month)
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
