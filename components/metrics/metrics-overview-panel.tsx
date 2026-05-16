"use client"

import { useState, useEffect } from "react"
import { MetricCard, MetricCardGrid } from "./metric-card"
import { Card } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, TrendingUp, Users } from "lucide-react"

export interface MetricsOverviewPanelProps {
  setterId: string
  month: string
}

interface MetricsData {
  cash_collected: number
  total_revenue: number
  mrr: number
  inbound_applications: number
  outbound_leads: number
  active_clients: number
  total_commissions: number
  commission_percentage?: number
}

export function MetricsOverviewPanel({ setterId, month }: MetricsOverviewPanelProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoading(true)
        const res = await fetch(
          `/api/admin/setting/metrics?setter_id=${setterId}&month=${month}`
        )
        if (!res.ok) throw new Error("Failed to load metrics")
        const data = await res.json()
        setMetrics(data.metrics)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    loadMetrics()
  }, [setterId, month])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-24 animate-pulse bg-muted" />
        ))}
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <Card className="p-6 bg-destructive/10 text-destructive border-destructive/20">
        <div className="flex gap-2">
          <AlertCircle className="mt-1 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Error loading metrics</p>
            <p className="text-sm">{error || "Unknown error"}</p>
          </div>
        </div>
      </Card>
    )
  }

  // Calculate collection rate (cash vs revenue)
  const collectionRate = metrics.total_revenue > 0
    ? (metrics.cash_collected / metrics.total_revenue) * 100
    : 0

  // Calculate conversion rate (new clients from applications + leads)
  const totalLeadActivity = metrics.inbound_applications + metrics.outbound_leads
  const conversionRate = totalLeadActivity > 0 ? metrics.active_clients : 0

  return (
    <MetricCardGrid columns={4}>
      {/* Cash Collected Card */}
      <MetricCard
        title="Cash Collected"
        value={`$${metrics.cash_collected.toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        subtitle={`${collectionRate.toFixed(1)}% of projected revenue`}
        icon="💰"
        className={
          collectionRate >= 100
            ? "border-green-200 dark:border-green-800"
            : collectionRate >= 80
              ? "border-yellow-200 dark:border-yellow-800"
              : "border-red-200 dark:border-red-800"
        }
      >
        <p className="text-xs text-muted-foreground">
          Projected: ${metrics.total_revenue.toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </MetricCard>

      {/* MRR Card */}
      <MetricCard
        title="Monthly Recurring Revenue"
        value={`$${metrics.mrr.toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        subtitle={`From ${metrics.active_clients} active clients`}
        icon={<TrendingUp className="h-6 w-6" />}
        className="border-blue-200 dark:border-blue-800"
      />

      {/* Commissions Card */}
      <MetricCard
        title="Commissions Earned"
        value={`$${metrics.total_commissions.toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        subtitle={`${metrics.commission_percentage || 5}% of cash collected`}
        icon={<CheckCircle2 className="h-6 w-6" />}
        className="border-green-200 dark:border-green-800"
      />

      {/* Active Clients Card */}
      <MetricCard
        title="Active Clients"
        value={metrics.active_clients}
        subtitle={`${totalLeadActivity} lead activities`}
        icon={<Users className="h-6 w-6" />}
        className="border-purple-200 dark:border-purple-800"
      />

      {/* Inbound Applications Card */}
      <MetricCard
        title="Inbound Applications"
        value={metrics.inbound_applications}
        subtitle={`${(
          (metrics.inbound_applications / Math.max(1, totalLeadActivity)) * 100
        ).toFixed(1)}% of leads`}
        icon="📥"
      />

      {/* Outbound Leads Card */}
      <MetricCard
        title="Outbound Leads"
        value={metrics.outbound_leads}
        subtitle={`${(
          (metrics.outbound_leads / Math.max(1, totalLeadActivity)) * 100
        ).toFixed(1)}% of leads`}
        icon="📤"
      />

      {/* Revenue Growth Card */}
      <MetricCard
        title="Revenue per Client"
        value={`$${(
          metrics.total_revenue / Math.max(1, metrics.active_clients)
        ).toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        subtitle="Average per active client"
        icon="📊"
      />

      {/* Collection Health Card */}
      <MetricCard
        title="Collection Health"
        value={`${collectionRate.toFixed(1)}%`}
        subtitle={`${collectionRate >= 100 ? "✅ Excellent" : collectionRate >= 80 ? "⚠️ Good" : "❌ Needs attention"}`}
        className={
          collectionRate >= 100
            ? "border-green-200 dark:border-green-800"
            : collectionRate >= 80
              ? "border-yellow-200 dark:border-yellow-800"
              : "border-red-200 dark:border-red-800"
        }
      />
    </MetricCardGrid>
  )
}
