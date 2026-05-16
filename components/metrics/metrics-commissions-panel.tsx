"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { AlertCircle, TrendingUp, DollarSign } from "lucide-react"

export interface MetricsCommissionsPanelProps {
  setterId: string
  month: string
}

interface CommissionRecord {
  id: string
  period: string
  cash_collected: number
  commission_percentage: number
  commission_amount: number
  created_at: string
}

interface CommissionsSummary {
  total_records: number
  total_cash_basis: number
  total_commissions: number
  average_commission: number
}

export function MetricsCommissionsPanel({
  setterId,
  month,
}: MetricsCommissionsPanelProps) {
  const [commissions, setCommissions] = useState<CommissionRecord[]>([])
  const [summary, setSummary] = useState<CommissionsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadCommissions = async () => {
      try {
        setLoading(true)
        const res = await fetch(
          `/api/admin/setting/metrics/commissions?setter_id=${setterId}&limit=12`
        )
        if (!res.ok) throw new Error("Failed to load commissions")
        const data = await res.json()
        setCommissions(data.commissions || [])
        setSummary(data.summary)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    loadCommissions()
  }, [setterId])

  if (error) {
    return (
      <Card className="p-6 bg-destructive/10 text-destructive border-destructive/20">
        <div className="flex gap-2">
          <AlertCircle className="mt-1 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Error loading commissions</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Cash Basis Card */}
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cash Collected (Basis)</p>
              <p className="text-2xl font-bold mt-2">
                $
                {(summary?.total_cash_basis || 0).toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <DollarSign className="h-5 w-5 text-blue-500 opacity-50" />
          </div>
        </Card>

        {/* Total Commissions Card */}
        <Card className="p-6 border-green-200 dark:border-green-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Commissions</p>
              <p className="text-2xl font-bold mt-2 text-green-600 dark:text-green-400">
                $
                {(summary?.total_commissions || 0).toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-green-500 opacity-50" />
          </div>
        </Card>

        {/* Average Commission Card */}
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Monthly Average</p>
              <p className="text-2xl font-bold mt-2">
                $
                {(summary?.average_commission || 0).toLocaleString("es-AR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="text-sm font-semibold text-muted-foreground">per month</div>
          </div>
        </Card>
      </div>

      {/* Commissions History Table */}
      <Card>
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-foreground">Commission History</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Last 12 months of commission records
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>Loading commissions...</p>
          </div>
        ) : commissions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No commission records yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Period
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground">
                    Cash Collected
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground">
                    Rate
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground">
                    Commission
                  </th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((comm, idx) => {
                  const periodDate = new Date(comm.period)
                  const periodLabel = periodDate.toLocaleDateString("es-AR", {
                    month: "long",
                    year: "numeric",
                  })

                  return (
                    <tr
                      key={comm.id}
                      className={`border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors ${
                        idx === 0 ? "bg-blue-50 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      <td className="px-6 py-3 font-medium">
                        {periodLabel}
                        {idx === 0 && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        $
                        {comm.cash_collected.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-3 text-right text-muted-foreground">
                        {comm.commission_percentage.toFixed(1)}%
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-green-600 dark:text-green-400 tabular-nums">
                        $
                        {comm.commission_amount.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Formula Explanation */}
      <Card className="p-6 bg-muted/30 border-dashed">
        <p className="text-sm font-semibold text-foreground mb-2">How commissions are calculated</p>
        <p className="text-sm text-muted-foreground">
          Commission = Cash Collected × {summary?.average_commission ? `${(
            (summary.average_commission / Math.max(1, summary.total_cash_basis)) * 100
          ).toFixed(1)}` : "5"}%
        </p>
      </Card>
    </div>
  )
}
