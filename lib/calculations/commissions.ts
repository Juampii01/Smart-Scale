/**
 * Commission Calculation
 *
 * Simple commission structure: 5% of cash collected
 * Configured via environment variable: COMMISSION_PERCENTAGE (default: 5)
 */

import { calculateCashCollected } from "./cash-collected"

const DEFAULT_COMMISSION_PCT = 5

function getCommissionPercentage(): number {
  const envPct = process.env.COMMISSION_PERCENTAGE
  if (envPct) {
    const parsed = parseFloat(envPct)
    return isNaN(parsed) ? DEFAULT_COMMISSION_PCT : parsed
  }
  return DEFAULT_COMMISSION_PCT
}

export interface CommissionBreakdown {
  setter_id: string
  period: string
  cash_collected_basis: number
  commission_percentage: number
  commission_amount: number
}

/**
 * Calculate commission for a setter in a given month
 * Commission = cash_collected × commission_percentage
 */
export async function calculateCommissionForSetter(
  setterId: string,
  month: string  // YYYY-MM-01 format
): Promise<CommissionBreakdown> {
  const { cash_collected } = await calculateCashCollected(setterId, month)

  const commissionPct = getCommissionPercentage()
  const commissionAmount = Math.round((cash_collected * commissionPct) / 100 * 100) / 100

  return {
    setter_id: setterId,
    period: month,
    cash_collected_basis: cash_collected,
    commission_percentage: commissionPct,
    commission_amount: commissionAmount,
  }
}

/**
 * Calculate year-to-date commissions for a setter
 */
export async function calculateYTDCommissions(setterId: string, year: number): Promise<number> {
  const currentMonth = new Date()
  currentMonth.setFullYear(year, 0, 1)  // January 1st of given year

  let totalCommissions = 0

  while (currentMonth.getFullYear() === year && currentMonth <= new Date()) {
    const monthStr = currentMonth.toISOString().slice(0, 7) + "-01"

    const commission = await calculateCommissionForSetter(setterId, monthStr)
    totalCommissions += commission.commission_amount

    currentMonth.setMonth(currentMonth.getMonth() + 1)
  }

  return Math.round(totalCommissions * 100) / 100
}

/**
 * Get commission percentage (for UI display)
 */
export function getCommissionPercentageForDisplay(): number {
  return getCommissionPercentage()
}
