/**
 * Cash Collected Calculation
 *
 * Calculates the total cash collected (paid installments) for a setter in a given month.
 * Queries crm_installments where paid_at falls within the target month.
 */

import { createServiceClient } from "@/lib/supabase-service"

export interface InstallmentPayment {
  installment_id: string
  client_id: string
  client_name: string
  installment_number: number
  amount: number
  paid_at: string
}

/**
 * Calculate cash collected for a setter in a given month
 */
export async function calculateCashCollected(
  setterId: string,
  month: string  // YYYY-MM-01 format
): Promise<{ cash_collected: number; payments: InstallmentPayment[] }> {
  const supabase = createServiceClient()

  // Parse month to get date range
  const monthStart = new Date(month)
  const monthEnd = new Date(monthStart)
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0)

  // First, get all clients where closer_id = setterId
  const { data: clients, error: clientsErr } = await supabase
    .from("crm_clients")
    .select("id, name")
    .eq("closer_id", setterId)

  if (clientsErr || !clients || clients.length === 0) {
    return { cash_collected: 0, payments: [] }
  }

  const clientIds = clients.map((c) => c.id)

  // Query all paid installments for these clients in the target month
  const { data: paidInstallments, error: instErr } = await supabase
    .from("crm_installments")
    .select("id, client_id, installment_number, amount, paid_at")
    .in("client_id", clientIds)
    .gte("paid_at", monthStart.toISOString())
    .lte("paid_at", monthEnd.toISOString())

  if (instErr || !paidInstallments) {
    console.error("Error querying installments:", instErr)
    return { cash_collected: 0, payments: [] }
  }

  // Enrich payments with client names and calculate total
  let totalCash = 0
  const payments: InstallmentPayment[] = []

  for (const inst of paidInstallments) {
    const amount = Number(inst.amount || 0)
    totalCash += amount

    const client = clients.find((c) => c.id === inst.client_id)
    payments.push({
      installment_id: inst.id,
      client_id: inst.client_id,
      client_name: client?.name || "Unknown",
      installment_number: inst.installment_number || 0,
      amount,
      paid_at: inst.paid_at,
    })
  }

  return {
    cash_collected: Math.round(totalCash * 100) / 100,
    payments: payments.sort(
      (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
    ),
  }
}

/**
 * Get unpaid/overdue installments for a setter (useful for follow-ups)
 */
export async function getUnpaidInstallmentsForSetter(
  setterId: string,
  includeOverdueOnly: boolean = false
): Promise<
  Array<{
    client_id: string
    client_name: string
    installment_number: number
    amount: number
    due_date: string
    days_overdue?: number
  }>
> {
  const supabase = createServiceClient()

  // Get all clients for this setter
  const { data: clients, error: clientsErr } = await supabase
    .from("crm_clients")
    .select("id, name")
    .eq("closer_id", setterId)

  if (clientsErr || !clients) {
    return []
  }

  const clientIds = clients.map((c) => c.id)

  // Get unpaid installments
  const { data: unpaidInsts, error: instErr } = await supabase
    .from("crm_installments")
    .select("id, client_id, installment_number, amount, due_date, paid_at")
    .in("client_id", clientIds)
    .is("paid_at", null)  // NOT paid

  if (instErr || !unpaidInsts) {
    return []
  }

  const now = new Date()
  const result: typeof unpaidInsts = []

  for (const inst of unpaidInsts) {
    const dueDate = new Date(inst.due_date)
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    if (!includeOverdueOnly || daysOverdue >= 0) {
      result.push({
        ...inst,
        days_overdue: Math.max(0, daysOverdue),
      })
    }
  }

  // Enrich with client names
  return result.map((inst) => ({
    client_id: inst.client_id,
    client_name: clients.find((c) => c.id === inst.client_id)?.name || "Unknown",
    installment_number: inst.installment_number || 0,
    amount: Number(inst.amount || 0),
    due_date: inst.due_date,
    days_overdue: (inst as any).days_overdue,
  }))
}
