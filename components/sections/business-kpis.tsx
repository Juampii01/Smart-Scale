"use client"

import { useMemo } from "react"
import { TrendingDown, TrendingUp, DollarSign, Wallet, Repeat, Megaphone, Users, UserPlus } from "lucide-react"
import { useSelectedMonth } from "@/components/layout/dashboard-layout"
import { useMonthlyReports } from "@/hooks/use-monthly-reports"
import { useMarkPageReady } from "@/hooks/use-mark-page-ready"
import { useMinLoading } from "@/hooks/use-min-loading"
import { KpiCardSkeleton, SectionHeaderSkeleton } from "@/components/ui/skeleton"
import { ResponsiveContainer, AreaChart, Area } from "recharts"

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({ values, color, up }: { values: number[]; color: string; up: boolean | null }) {
  const pts = values.map((v, i) => ({ i, v }))
  const stroke = up === true ? "#4ade80" : up === false ? "#f87171" : color
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={pts} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spk_${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={stroke} stopOpacity={0.25} />
            <stop offset="95%" stopColor={stroke} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={stroke}
          strokeWidth={1.5}
          fill={`url(#spk_${color.replace("#", "")})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(v: any) {
  if (v === null || v === undefined || v === "") return "—"
  const n = Number(v)
  if (!Number.isFinite(n)) return "—"
  return `$${n.toLocaleString()}`
}
function fmtNumber(v: any) {
  if (v === null || v === undefined || v === "") return "—"
  const n = Number(v)
  if (!Number.isFinite(n)) return "—"
  return n.toLocaleString()
}

// ─── KPI definitions ──────────────────────────────────────────────────────────

const KPI_DEFS = [
  { key: "cash_collected",  label: "Cash Collected",      money: true,  icon: Wallet,     color: "#ffde21" },
  { key: "total_revenue",   label: "Total Revenue",        money: true,  icon: DollarSign, color: "#fb923c" },
  { key: "mrr",             label: "MRR",                  money: true,  icon: Repeat,     color: "#60a5fa" },
  { key: "ad_spend",        label: "Gasto Publicitario",   money: true,  icon: Megaphone,  color: "#ef4444" },
  { key: "short_followers", label: "Seguidores Instagram", money: false, icon: Users,      color: "#818cf8" },
  { key: "new_clients",     label: "Nuevos Clientes",      money: false, icon: UserPlus,   color: "#4ade80" },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function BusinessKPIs({ selectedMonth: propMonth }: { selectedMonth?: string }) {
  const ctxMonth    = useSelectedMonth()
  const effectiveMonth = (propMonth ?? ctxMonth ?? "").slice(0, 7)

  const { reports, loading } = useMonthlyReports()
  const showSkeleton = useMinLoading(loading)
  useMarkPageReady(!showSkeleton)

  const { current, previous } = useMemo(() => {
    if (!reports.length) return { current: null, previous: null }
    let idx = effectiveMonth
      ? reports.findIndex(r => r.month === effectiveMonth)
      : -1
    if (idx === -1) idx = reports.length - 1
    return {
      current:  reports[idx]     ?? null,
      previous: reports[idx - 1] ?? null,
    }
  }, [reports, effectiveMonth])

  // Sparkline data: last 8 months of each metric (up to current index)
  const sparkData = useMemo(() => {
    const map: Record<string, number[]> = {}
    if (!reports.length || !current) return map
    const curIdx = reports.findIndex(r => r.month === current.month)
    const slice  = reports.slice(Math.max(0, curIdx - 7), curIdx + 1)
    KPI_DEFS.forEach(k => {
      map[k.key] = slice.map(r => (r as any)[k.key] as number)
    })
    return map
  }, [reports, current])

  const calcDelta = (key: string) => {
    if (!current || !previous) return { diff: null as number | null, pct: null as number | null }
    const cur  = Number((current  as any)[key])
    const prev = Number((previous as any)[key])
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) return { diff: null, pct: null }
    const diff = cur - prev
    const pct  = prev === 0 ? null : (diff / prev) * 100
    return { diff, pct }
  }

  const upCount   = KPI_DEFS.filter(k => (calcDelta(k.key).diff ?? 0) > 0).length
  const downCount = KPI_DEFS.filter(k => (calcDelta(k.key).diff ?? 0) < 0).length

  if (showSkeleton) {
    return (
      <section>
        <SectionHeaderSkeleton />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
      </section>
    )
  }

  return (
    <section>
      {/* Section header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Performance</h2>
          <p className="text-[13px] text-white/40 mt-0.5">Key metrics for the selected month</p>
        </div>
        {current && previous && (
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />{upCount} up
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
              <TrendingDown className="h-3.5 w-3.5" />{downCount} down
            </span>
          </div>
        )}
      </div>

      {!current && (
        <p className="text-white/40 mb-4 text-sm">No hay reporte cargado para este mes.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KPI_DEFS.map((kpi) => {
          const rawVal  = current ? (current as any)[kpi.key] : null
          const value   = kpi.money ? fmtMoney(rawVal) : fmtNumber(rawVal)
          const delta   = calcDelta(kpi.key)
          const isUp    = delta.diff !== null && delta.diff > 0
          const isDown  = delta.diff !== null && delta.diff < 0
          const spark   = sparkData[kpi.key] ?? []

          return (
            <div
              key={kpi.key}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] transition-all duration-200 hover:border-white/[0.12] hover:bg-[#141416]"
            >
              {/* Top accent */}
              <div className={`h-[2px] w-full ${isDown ? "bg-red-500/60" : isUp ? "bg-emerald-500/60" : "bg-white/[0.08]"}`} />

              <div className="flex-1 p-6 pb-3">
                {/* Icon + delta */}
                <div className="mb-5 flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl ring-1"
                    style={{ backgroundColor: `${kpi.color}15`, boxShadow: `0 0 0 1px ${kpi.color}25` }}
                  >
                    <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                  </div>

                  {current && previous && delta.diff !== null && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                      isUp   ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20"
                      : isDown ? "bg-red-500/10 text-red-300 ring-1 ring-red-500/20"
                      :           "bg-white/5 text-white/40 ring-1 ring-white/10"
                    }`}>
                      {isUp   && <TrendingUp   className="h-3 w-3" />}
                      {isDown && <TrendingDown className="h-3 w-3" />}
                      {delta.pct !== null
                        ? `${delta.pct > 0 ? "+" : ""}${Math.round(delta.pct)}%`
                        : `${delta.diff > 0 ? "+" : ""}${kpi.money ? fmtMoney(Math.abs(delta.diff)) : delta.diff.toLocaleString()}`}
                    </span>
                  )}
                </div>

                {/* Value */}
                <p className="text-[32px] font-bold tracking-tight text-white leading-none">
                  {value}
                </p>

                {/* Label */}
                <p className="mt-2 text-[13px] text-white/50">{kpi.label}</p>

                {/* Previous */}
                {previous && rawVal !== null && (() => {
                  const prev = (previous as any)[kpi.key]
                  if (prev == null) return null
                  const fmted = kpi.money ? fmtMoney(prev) : fmtNumber(prev)
                  return (
                    <p className="mt-1 text-[11px] text-white/25">
                      vs {fmted} mes anterior
                    </p>
                  )
                })()}
              </div>

              {/* Sparkline at bottom */}
              {spark.length >= 2 && (
                <div className="px-0 pt-0 pb-0 opacity-70">
                  <Sparkline values={spark} color={kpi.color} up={isUp ? true : isDown ? false : null} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
