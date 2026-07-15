"use client"

import { useEffect, useMemo, useState } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts"
import { cn } from "@/lib/utils"
import { useSelectedMonth, useGreetingName } from "@/components/layout/dashboard-layout"
import { useMonthlyReports, type MonthlyReport } from "@/hooks/use-monthly-reports"
import { useMarkPageReady } from "@/hooks/use-mark-page-ready"
import { useMinLoading } from "@/hooks/use-min-loading"
import { Sk } from "@/components/ui/skeleton"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(v: any) {
  const n = Number(v)
  if (v == null || v === "" || !Number.isFinite(n)) return "—"
  return `$${n.toLocaleString("en-US")}`
}
function fmtMoneyShort(n: number) {
  if (!Number.isFinite(n)) return "—"
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `$${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`
  return `$${n.toLocaleString("en-US")}`
}
function fmtNumber(v: any) {
  const n = Number(v)
  if (v == null || v === "" || !Number.isFinite(n)) return "—"
  return n.toLocaleString("en-US")
}
function monthShort(ym: string) {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y || 1970, (m || 1) - 1, 1)
  return `${d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")} ${String(y).slice(2)}`
}
function monthLong(ym: string) {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y || 1970, (m || 1) - 1, 1)
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

// Saludo según hora de Miami (America/New_York).
function computeGreeting(): string {
  const hStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23",
  }).format(new Date())
  const h = parseInt(hStr, 10)
  if (h >= 6 && h < 12) return "Buenos días"
  if (h >= 12 && h < 19) return "Buenas tardes"
  return "Buenas noches"
}
function useMiamiGreeting() {
  const [g, setG] = useState(computeGreeting)
  useEffect(() => {
    const id = setInterval(() => setG(computeGreeting()), 60_000)
    return () => clearInterval(id)
  }, [])
  return g
}

function delta(cur: number, prev: number | null) {
  if (prev == null || !Number.isFinite(cur) || !Number.isFinite(prev)) return { pct: null as number | null, diff: null as number | null }
  const diff = cur - prev
  const pct = prev === 0 ? null : (diff / prev) * 100
  return { pct, diff }
}

// ─── Delta pill ───────────────────────────────────────────────────────────────

function DeltaPill({ pct, diff, money, size = "sm" }: {
  pct: number | null; diff: number | null; money?: boolean; size?: "sm" | "lg"
}) {
  if (diff == null) return null
  const up = diff > 0, down = diff < 0
  const label = pct != null
    ? `${pct > 0 ? "+" : ""}${Math.round(pct)}%`
    : `${diff > 0 ? "+" : ""}${money ? fmtMoneyShort(Math.abs(diff)) : Math.abs(diff).toLocaleString("en-US")}`
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full font-bold",
      size === "lg" ? "px-2.5 py-1 text-[13px]" : "px-2 py-0.5 text-[11px]",
      up   ? "text-emerald-700 dark:text-emerald-400"
      : down ? "text-red-700 dark:text-red-400"
      :       "text-foreground/40"
    )}>
      {up && <TrendingUp className={size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3"} />}
      {down && <TrendingDown className={size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3"} />}
      {label}
    </span>
  )
}

// ─── Revenue chart ────────────────────────────────────────────────────────────

type Range = "6M" | "1A" | "all"
const RANGES: { id: Range; label: string; months: number }[] = [
  { id: "6M",  label: "6M",   months: 6 },
  { id: "1A",  label: "1A",   months: 12 },
  { id: "all", label: "Todo", months: 999 },
]

function RevenueTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-foreground/10 bg-popover px-3 py-2 shadow-xl">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">{monthLong(p.ym)}</p>
      <p className="text-[15px] font-bold text-foreground tabular-nums">{fmtMoney(p.v)}</p>
    </div>
  )
}

// ─── KPI secundarios ──────────────────────────────────────────────────────────

const SECONDARY: { key: keyof MonthlyReport; label: string; money: boolean; color: string }[] = [
  { key: "cash_collected",  label: "Cash Collected",      money: true,  color: "#dafc69" },
  { key: "mrr",             label: "MRR",                  money: true,  color: "#60a5fa" },
  { key: "ad_spend",        label: "Gasto Publicitario",   money: true,  color: "#ef4444" },
  { key: "new_clients",     label: "Nuevos Clientes",      money: false, color: "#4ade80" },
  { key: "short_followers", label: "Seguidores Instagram", money: false, color: "#818cf8" },
]

// Métricas de audiencia / canales — franja integrada full-width.
const CHANNELS: { key: keyof MonthlyReport; label: string }[] = [
  { key: "email_subscribers", label: "Suscriptores Email" },
  { key: "yt_subscribers",    label: "Suscriptores YouTube" },
  { key: "short_reach",       label: "Alcance Instagram" },
  { key: "yt_views",          label: "Vistas YouTube" },
]

// ─── Componente ───────────────────────────────────────────────────────────────

export function OverviewHero() {
  const greeting = useMiamiGreeting()
  const rawName = useGreetingName()
  const firstName = (rawName ?? "").trim().split(/\s+/)[0] || ""

  const selectedMonth = useSelectedMonth()
  const effectiveMonth = String(selectedMonth ?? "").slice(0, 7)

  const { reports, loading } = useMonthlyReports()
  const showSkeleton = useMinLoading(loading)
  useMarkPageReady(!showSkeleton)

  const [range, setRange] = useState<Range>("1A")

  const { current, previous, curIdx } = useMemo(() => {
    if (!reports.length) return { current: null as MonthlyReport | null, previous: null as MonthlyReport | null, curIdx: -1 }
    let idx = effectiveMonth ? reports.findIndex(r => r.month === effectiveMonth) : -1
    if (idx === -1) idx = reports.length - 1
    return { current: reports[idx] ?? null, previous: reports[idx - 1] ?? null, curIdx: idx }
  }, [reports, effectiveMonth])

  const chartData = useMemo(() => {
    if (curIdx < 0) return [] as { ym: string; label: string; v: number }[]
    const months = RANGES.find(r => r.id === range)?.months ?? 12
    const slice = reports.slice(Math.max(0, curIdx - months + 1), curIdx + 1)
    return slice.map(r => ({ ym: r.month, label: monthShort(r.month), v: Number(r.total_revenue) || 0 }))
  }, [reports, curIdx, range])

  if (showSkeleton) {
    return (
      <section className="space-y-6">
        <Sk className="h-12 w-72 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Sk className="h-[320px] rounded-2xl lg:col-span-2" />
          <Sk className="h-[320px] rounded-2xl" />
        </div>
      </section>
    )
  }

  const revDelta = current ? delta(Number(current.total_revenue) || 0, previous ? Number(previous.total_revenue) || 0 : null) : { pct: null, diff: null }

  return (
    <section className="space-y-6">
      {/* Saludo */}
      <div>
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-foreground leading-tight" suppressHydrationWarning>
          {greeting}{firstName ? <>, {firstName}</> : ""} <span className="text-foreground/25">.</span>
        </h1>
        <p className="text-[13px] text-foreground/45 mt-1">
          {current ? `Tu resumen de ${monthLong(current.month)}` : "Cargá tu reporte mensual para ver tu resumen"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue feature */}
        <div className="lg:col-span-2 rounded-2xl border border-foreground/[0.08] bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/40">
              Revenue {current ? <span className="text-foreground/25">· {monthShort(current.month)}</span> : null}
            </p>
            {chartData.length > 1 && (
              <div className="flex items-center gap-0.5 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] p-0.5">
                {RANGES.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRange(r.id)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      range === r.id ? "bg-[#dafc69] text-black" : "text-foreground/45 hover:text-foreground/70"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <p className="text-[40px] sm:text-[44px] font-bold tracking-tight text-foreground leading-none tabular-nums">
              {current ? fmtMoney(current.total_revenue) : "—"}
            </p>
            {revDelta.diff != null && (
              <span className="mb-1 flex items-center gap-2">
                <DeltaPill pct={revDelta.pct} diff={revDelta.diff} money size="lg" />
                {previous && (
                  <span className="text-[12px] text-foreground/35">
                    vs {monthShort(previous.month)} · {fmtMoney(previous.total_revenue)}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Chart */}
          {chartData.length > 1 ? (
            <div className="mt-5 h-[200px] text-foreground/35">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ovh_rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#dafc69" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#dafc69" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label" tickLine={false} axisLine={false}
                    tick={{ fontSize: 11, fill: "currentColor" }} minTickGap={20} dy={6}
                  />
                  <YAxis hide domain={[0, "dataMax"]} />
                  <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "#dafc69", strokeOpacity: 0.3, strokeWidth: 1 }} />
                  <Area
                    type="monotone" dataKey="v" stroke="#dafc69" strokeWidth={2.5}
                    fill="url(#ovh_rev)" dot={false}
                    activeDot={{ r: 4, fill: "#dafc69", stroke: "var(--card)", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-5 flex h-[200px] items-center justify-center rounded-xl border border-dashed border-foreground/[0.08] text-[13px] text-foreground/35">
              Necesitás al menos 2 meses de datos para ver la tendencia.
            </div>
          )}
        </div>

        {/* Métricas clave — panel integrado */}
        <div className="rounded-2xl border border-foreground/[0.08] bg-card overflow-hidden flex flex-col">
          <div className="border-b border-foreground/[0.06] px-5 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/40">Métricas clave</p>
          </div>
          <div className="flex-1 divide-y divide-foreground/[0.06]">
            {SECONDARY.map(kpi => {
              const cur = current ? Number((current as any)[kpi.key]) : null
              const prev = previous ? Number((previous as any)[kpi.key]) : null
              const d = cur != null ? delta(cur, prev) : { pct: null, diff: null }
              const val = kpi.money ? fmtMoney(cur) : fmtNumber(cur)
              return (
                <div key={String(kpi.key)} className="flex items-center justify-between gap-3 px-5 py-[14px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: kpi.color }} />
                    <span className="truncate text-[12.5px] text-foreground/55">{kpi.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[15px] font-bold text-foreground tabular-nums">{val}</span>
                    <DeltaPill pct={d.pct} diff={d.diff} money={kpi.money} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Audiencia & canales — toda la data visible, panel integrado */}
      {current && (
        <div className="rounded-2xl border border-foreground/[0.08] bg-card overflow-hidden">
          <div className="border-b border-foreground/[0.06] px-5 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/40">Audiencia & canales</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/[0.06]">
            {CHANNELS.map(ch => {
              const cur = Number((current as any)[ch.key])
              const prev = previous ? Number((previous as any)[ch.key]) : null
              const d = delta(cur, prev)
              return (
                <div key={String(ch.key)} className="bg-card px-5 py-4">
                  <p className="text-[11.5px] text-foreground/45">{ch.label}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[20px] font-bold text-foreground tabular-nums leading-none">{fmtNumber(cur)}</span>
                    <DeltaPill pct={d.pct} diff={d.diff} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
