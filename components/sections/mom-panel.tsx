"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useMonthlyReports } from "@/hooks/use-monthly-reports"
import { useSelectedMonth } from "@/components/layout/dashboard-layout"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonthLong(month: string) {
  const s = String(month).slice(0, 7)
  const [year, mon] = s.split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  const idx = parseInt(mon, 10) - 1
  return `${names[idx] ?? mon} '${year.slice(2)}`
}

function fmtMoney(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`
  return `$${v}`
}
function fmtNum(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`
  return String(v)
}

// ─── Metric definitions ───────────────────────────────────────────────────────

const METRICS = [
  { key: "cash_collected",  label: "Cash Collected",      format: "money"  as const, color: "#ffde21", weight: 3 },
  { key: "total_revenue",   label: "Total Revenue",        format: "money"  as const, color: "#fb923c", weight: 2 },
  { key: "mrr",             label: "MRR",                  format: "money"  as const, color: "#60a5fa", weight: 2 },
  { key: "new_clients",     label: "Nuevos Clientes",      format: "number" as const, color: "#4ade80", weight: 2 },
  { key: "short_followers", label: "Seguidores Instagram", format: "number" as const, color: "#818cf8", weight: 1 },
  { key: "ad_spend",        label: "Gasto Publicitario",   format: "money"  as const, color: "#ef4444", weight: 1 },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function MoMPanel() {
  const { reports, loading } = useMonthlyReports()
  const selectedMonth = useSelectedMonth()

  const { current, previous } = useMemo(() => {
    if (!reports.length) return { current: null, previous: null }

    const target = (selectedMonth ?? "").slice(0, 7)
    let idx = target ? reports.findIndex(r => r.month === target) : -1
    if (idx === -1) idx = reports.length - 1

    return {
      current:  reports[idx]     ?? null,
      previous: reports[idx - 1] ?? null,
    }
  }, [reports, selectedMonth])

  if (loading) {
    return (
      <section>
        <div className="h-72 animate-pulse rounded-2xl border border-white/[0.07] bg-[#111113]" />
      </section>
    )
  }

  if (!current || !previous) return null

  // Score: weighted up vs down
  let totalUp = 0, totalDown = 0
  METRICS.forEach(m => {
    const cur  = (current  as any)[m.key] as number
    const prev = (previous as any)[m.key] as number
    const diff = cur - prev
    if (diff > 0) totalUp   += m.weight
    if (diff < 0) totalDown += m.weight
  })
  const scorePositive = totalUp > totalDown

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Month vs Month</h2>
          <p className="text-[13px] text-white/40 mt-0.5">
            {fmtMonthLong(current.month)} vs {fmtMonthLong(previous.month)} — ¿qué cambió?
          </p>
        </div>
        {/* Overall score badge */}
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 ${
          scorePositive
            ? "border-emerald-500/25 bg-emerald-500/10"
            : "border-red-500/25 bg-red-500/10"
        }`}>
          {scorePositive
            ? <TrendingUp   className="h-4 w-4 text-emerald-400" />
            : <TrendingDown className="h-4 w-4 text-red-400" />}
          <span className={`text-sm font-bold ${scorePositive ? "text-emerald-300" : "text-red-300"}`}>
            {scorePositive ? "Mes positivo" : "Mes para revisar"}
          </span>
          <span className="text-white/30 text-xs ml-1">
            {totalUp}↑ · {totalDown}↓
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
        {/* Column headers */}
        <div className="grid grid-cols-[1.4fr_1fr_1.6fr_1fr] border-b border-white/[0.06] px-6 py-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Métrica</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 text-right">{fmtMonthLong(previous.month)}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 text-center">Cambio</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 text-right">{fmtMonthLong(current.month)}</span>
        </div>

        {METRICS.map((metric) => {
          const cur  = (current  as any)[metric.key] as number
          const prev = (previous as any)[metric.key] as number
          const diff = cur - prev
          const pct  = prev !== 0 ? (diff / prev) * 100 : null
          const isUp   = diff > 0
          const isDown = diff < 0
          const fmtVal = (v: number) => metric.format === "money" ? fmtMoney(v) : fmtNum(v)
          const absPct = Math.min(100, Math.abs(pct ?? 0))

          return (
            <div
              key={metric.key}
              className={`grid grid-cols-[1.4fr_1fr_1.6fr_1fr] items-center border-b border-white/[0.04] last:border-0 px-6 py-4 transition-colors ${
                isUp   ? "hover:bg-emerald-500/[0.03]"
                : isDown ? "hover:bg-red-500/[0.03]"
                :           "hover:bg-white/[0.02]"
              }`}
            >
              {/* Metric name */}
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-black/40"
                  style={{ backgroundColor: metric.color }} />
                <span className="text-[13px] font-medium text-white/70">{metric.label}</span>
              </div>

              {/* Previous value */}
              <span className="text-[13px] font-medium text-white/35 text-right tabular-nums pr-2">
                {fmtVal(prev)}
              </span>

              {/* Change — THE KEY COLUMN */}
              <div className="flex flex-col items-center gap-1.5 px-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold ${
                  isUp   ? "bg-emerald-500/15 text-emerald-300"
                  : isDown ? "bg-red-500/15 text-red-300"
                  :           "bg-white/[0.06] text-white/40"
                }`}>
                  {isUp   && <TrendingUp   className="h-3 w-3 flex-shrink-0" />}
                  {isDown && <TrendingDown className="h-3 w-3 flex-shrink-0" />}
                  {!isUp && !isDown && <Minus className="h-3 w-3 flex-shrink-0" />}
                  {diff !== 0
                    ? `${diff > 0 ? "+" : ""}${fmtVal(Math.abs(diff))}${pct !== null ? ` (${pct > 0 ? "+" : ""}${Math.round(pct)}%)` : ""}`
                    : "Sin cambio"}
                </span>
                {/* Progress bar showing magnitude */}
                <div className="w-full h-1 rounded-full bg-white/[0.05] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isUp ? "bg-emerald-400" : isDown ? "bg-red-400" : "bg-white/20"}`}
                    style={{ width: `${absPct}%` }}
                  />
                </div>
              </div>

              {/* Current value — highlighted */}
              <div className="text-right">
                <span className={`text-[15px] font-bold tabular-nums ${
                  isUp   ? "text-emerald-300"
                  : isDown ? "text-red-300"
                  :           "text-white"
                }`}>
                  {fmtVal(cur)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
