"use client"

import { useMemo } from "react"
import Link from "next/link"
import { TrendingDown, TrendingUp, DollarSign, Wallet, Repeat, Megaphone, Users, UserPlus, BarChart3 } from "lucide-react"
import { useSelectedMonth, useActiveClient, useOwnClient } from "@/components/layout/dashboard-layout"
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
  { key: "cash_collected",  label: "Cash Collected",      money: true,  icon: Wallet,     color: "#dafc69" },
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

  const activeClientId = useActiveClient()
  const ownClientId    = useOwnClient()
  const isOwn = !ownClientId || !activeClientId || ownClientId === activeClientId

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
          <h2 className="text-xl font-bold text-foreground">Performance</h2>
          <p className="text-[13px] text-foreground/40 mt-0.5">Key metrics for the selected month</p>
        </div>
        {current && previous && (
          <div className="flex items-center gap-2 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />{upCount} up
            </span>
            <span className="h-3 w-px bg-foreground/15" />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
              <TrendingDown className="h-3.5 w-3.5" />{downCount} down
            </span>
          </div>
        )}
      </div>

      {!current && !showSkeleton && (
        <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-foreground/[0.07] bg-card py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-foreground/[0.07] bg-foreground/[0.03]">
            <BarChart3 className="h-5 w-5 text-foreground/20" />
          </div>
          <p className="text-sm text-foreground/40">
            {isOwn ? "No hay reporte cargado para este mes." : "Este cliente no tiene reporte para este mes."}
          </p>
          {isOwn && (
            <Link href="/report-input" className="text-sm font-medium text-[#dafc69] transition-colors hover:text-[#f2ffc0]">
              Cargar reporte mensual →
            </Link>
          )}
        </div>
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
              className="group relative flex flex-col overflow-hidden rounded-[14px] border border-foreground/[0.07] bg-card transition-all duration-200 hover:border-foreground/[0.12] hover:bg-card"
            >
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
                      isUp   ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
                      : isDown ? "bg-red-100 text-red-800 ring-1 ring-red-400 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20"
                      :           "bg-foreground/5 text-foreground/40 ring-1 ring-foreground/10"
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
                <p className="text-[32px] font-bold tracking-tight text-foreground leading-none">
                  {value}
                </p>

                {/* Label */}
                <p className="mt-2 text-[13px] text-foreground/50">{kpi.label}</p>

                {/* Previous */}
                {previous && rawVal !== null && (() => {
                  const prev = (previous as any)[kpi.key]
                  if (prev == null) return null
                  const fmted = kpi.money ? fmtMoney(prev) : fmtNumber(prev)
                  return (
                    <p className="mt-1 text-[11px] text-foreground/25">
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
