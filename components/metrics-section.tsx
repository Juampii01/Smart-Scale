"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type MetricsSectionProps = {
  title?: string
  subtitle?: string
  /** Pass the full monthly report row (e.g. from Supabase monthly_reports) */
  metrics: Record<string, any> | null
  /** Optional aggregated (year-to-date) metrics object aligned to the same keys as metrics */
  annualMetrics?: Record<string, any> | null
  loading?: boolean
  error?: string | null
}

function isSkippableKey(key: string) {
  return (
    key === "id" ||
    key === "client_id" ||
    key === "created_at" ||
    key === "updated_at" ||
    key === "month"
  )
}

function formatValue(v: any): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return String(v)
    // Keep integers clean, decimals with 2
    if (Number.isInteger(v)) return v.toLocaleString()
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  if (typeof v === "string") return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function guessCategory(key: string): string {
  const k = key.toLowerCase()
  if (k.startsWith("yt_") || k.includes("youtube")) return "YouTube"
  if (k.startsWith("short_") || k.includes("short")) return "Short-form"
  if (k.startsWith("email_") || k.includes("email")) return "Email"
  if (k.includes("call") || k.includes("offer") || k.includes("deal") || k.includes("close")) return "Sales"
  if (k.includes("revenue") || k.includes("cash") || k.includes("mrr") || k.includes("expense") || k.includes("ad_spend") || k.includes("ads")) return "Business"
  if (k.includes("reflection") || k.includes("win") || k.includes("focus") || k.includes("support")) return "Reflection"
  return "Other"
}

export function MetricsSection({
  title = "All Metrics",
  subtitle = "Full monthly report snapshot",
  metrics,
  annualMetrics,
  loading,
  error,
}: MetricsSectionProps) {
  const [q, setQ] = useState("")

  const { grouped, totalCount, monthLabel } = useMemo(() => {
    const monthLabel = metrics?.month ? String(metrics.month).slice(0, 10) : "—"

    const keys = new Set<string>([
      ...Object.keys(metrics ?? {}),
      ...Object.keys(annualMetrics ?? {}),
    ])

    const entries = Array.from(keys)
      .filter((k) => !isSkippableKey(k))
      .map((k) => {
        const v = metrics?.[k]
        return {
          key: k,
          value: v,
          valueText: formatValue(v),
          annualValueText: annualMetrics ? formatValue(annualMetrics[k]) : "—",
          category: guessCategory(k),
        }
      })

    const qNorm = q.trim().toLowerCase()
    const filtered = qNorm
      ? entries.filter((e) =>
          e.key.toLowerCase().includes(qNorm) ||
          e.valueText.toLowerCase().includes(qNorm) ||
          e.category.toLowerCase().includes(qNorm)
        )
      : entries

    const grouped: Record<string, typeof filtered> = {}
    for (const item of filtered) {
      grouped[item.category] = grouped[item.category] ?? []
      grouped[item.category].push(item)
    }

    // Stable ordering
    const order = ["Business", "Sales", "Short-form", "YouTube", "Email", "Reflection", "Other"]
    const ordered: Record<string, typeof filtered> = {}
    for (const cat of order) {
      if (grouped[cat]?.length) ordered[cat] = grouped[cat]
    }
    for (const [cat, items] of Object.entries(grouped)) {
      if (!ordered[cat]) ordered[cat] = items
    }

    // Sort inside groups by key
    for (const cat of Object.keys(ordered)) {
      ordered[cat] = ordered[cat].sort((a, b) => a.key.localeCompare(b.key))
    }

    return { grouped: ordered, totalCount: filtered.length, monthLabel }
  }, [metrics, annualMetrics, q])

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {subtitle} <span className="text-white/40">•</span> Month: {monthLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white/80">
            {totalCount} fields
          </span>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search metrics…"
            className={cn(
              "w-full sm:w-[280px]",
              "bg-white/5 text-foreground placeholder:text-white/40",
              "border-border focus-visible:ring-2 focus-visible:ring-white/20"
            )}
          />
        </div>
      </div>

      {loading && <p className="text-white/60">Cargando métricas…</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && !metrics && (
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <p className="text-white/60">No hay métricas cargadas para este mes.</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && metrics && (
        <div className="grid gap-4">
          {Object.entries(grouped).map(([category, items]) => (
            <Card
              key={category}
              className="border-border bg-card transition-all duration-200 hover:border-muted-foreground/50 hover:shadow-lg hover:shadow-primary/5"
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base font-medium">
                  <span className="text-foreground">{category}</span>
                  <span className="text-xs text-white/50">{items.length} fields</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="max-h-[340px] overflow-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-background/70 backdrop-blur">
                        <tr className="border-b border-border">
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/60">Field</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-white/60">Mensual</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-white/60">Anual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.key} className="border-b border-border/60 last:border-b-0">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-foreground">{item.key}</div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="font-mono text-sm text-white/90">{item.valueText}</div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="font-mono text-sm text-white/90">{item.annualValueText}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="mt-3 text-xs text-white/40">
                  Tip: podés buscar por nombre de campo (ej: <span className="font-mono">ad_spend</span>) o por valor.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}