"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"
import { MetricsSection } from "@/components/sections/metrics-section"
import { MoMPanel } from "@/components/sections/mom-panel"
import { useSelectedMonth, useActiveClient } from "@/components/layout/dashboard-layout"
import { useMarkPageReady } from "@/hooks/use-mark-page-ready"
import { useMinLoading } from "@/hooks/use-min-loading"
import { useMonthlyReports } from "@/hooks/use-monthly-reports"
import { StatCardSkeleton, SectionHeaderSkeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonth(m: string) {
  const s = String(m).slice(0, 7)
  const [year, mon] = s.split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${names[parseInt(mon,10)-1] ?? mon} '${year.slice(2)}`
}

function normalizeMonthToDate(month: string) {
  if (/^\d{4}-\d{2}$/.test(month)) return `${month}-01`
  return month
}

function fmtVal(v: any, isMoney: boolean) {
  const n = Number(v)
  if (!Number.isFinite(n)) return "—"
  if (isMoney) {
    if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n/1_000).toFixed(1)}K`
    return `$${n.toLocaleString()}`
  }
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n/1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Health Score Radar ───────────────────────────────────────────────────────

function HealthRadar({ reports }: { reports: any[] }) {
  if (reports.length < 2) return null

  const last  = reports[reports.length - 1]
  const prev  = reports[reports.length - 2]

  // Normalize each metric 0-100 relative to the max in history
  function norm(key: string) {
    const vals = reports.map(r => Number(r[key]) || 0)
    const max  = Math.max(...vals)
    if (!max) return 0
    return Math.round(((Number(last[key]) || 0) / max) * 100)
  }

  const data = [
    { subject: "Cash",      A: norm("cash_collected"),  fullMark: 100 },
    { subject: "Revenue",   A: norm("total_revenue"),   fullMark: 100 },
    { subject: "MRR",       A: norm("mrr"),             fullMark: 100 },
    { subject: "Clientes",  A: norm("new_clients"),     fullMark: 100 },
    { subject: "Instagram", A: norm("short_followers"), fullMark: 100 },
    { subject: "YouTube",   A: norm("yt_subscribers"),  fullMark: 100 },
  ]

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
      <h3 className="text-[16px] font-bold text-white mb-1">Health Score</h3>
      <p className="text-xs text-white/35 mb-4">
        Cada eje muestra qué tan cerca estás de tu mejor mes histórico (100 = tu máximo)
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "rgba(255,255,255,0.50)", fontSize: 11, fontWeight: 600 }}
          />
          <Radar
            name="Este mes"
            dataKey="A"
            stroke="#ffde21"
            fill="#ffde21"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Summary KPI strip ────────────────────────────────────────────────────────

const SUMMARY_KPIS = [
  { key: "cash_collected",  label: "Cash Collected",  money: true,  color: "#ffde21" },
  { key: "total_revenue",   label: "Total Revenue",    money: true,  color: "#fb923c" },
  { key: "mrr",             label: "MRR",              money: true,  color: "#60a5fa" },
  { key: "new_clients",     label: "Nuevos Clientes",  money: false, color: "#4ade80" },
  { key: "short_followers", label: "IG Seguidores",    money: false, color: "#818cf8" },
  { key: "ad_spend",        label: "Ad Spend",         money: true,  color: "#ef4444" },
]

function SummaryStrip({ current, previous }: { current: any; previous: any }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {SUMMARY_KPIS.map(kpi => {
        const cur  = Number(current?.[kpi.key]  ?? 0)
        const prev = Number(previous?.[kpi.key] ?? 0)
        const diff = cur - prev
        const pct  = prev ? (diff / prev) * 100 : null
        const isUp   = diff > 0
        const isDown = diff < 0

        return (
          <div key={kpi.key}
            className="rounded-xl border border-white/[0.07] bg-[#111113] p-4 flex flex-col gap-2 hover:border-white/[0.12] transition-colors">
            <div className="flex items-center justify-between">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: kpi.color }} />
              {pct !== null && (
                <span className={`text-[10px] font-bold ${isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-white/30"}`}>
                  {pct > 0 ? "+" : ""}{Math.round(pct)}%
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-white leading-none tabular-nums">
              {fmtVal(cur, kpi.money)}
            </p>
            <p className="text-[10px] text-white/40 leading-tight">{kpi.label}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Rolling 12m trend strip ──────────────────────────────────────────────────

function RollingTrend({ reports }: { reports: any[] }) {
  if (reports.length < 2) return null

  const data = reports.slice(-12).map(r => ({
    month:   fmtMonth(r.month),
    cash:    r.cash_collected,
    revenue: r.total_revenue,
    mrr:     r.mrr,
  }))

  const tooltipStyle = {
    contentStyle: { backgroundColor: "#0f0f10", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "10px 14px" },
    labelStyle: { color: "#fff", fontWeight: 700, fontSize: 12 },
    itemStyle: { fontSize: 12, fontWeight: 600 },
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
      <h3 className="text-[16px] font-bold text-white mb-1">Evolución financiera — 12 meses</h3>
      <p className="text-xs text-white/35 mb-5">Cash Collected, Total Revenue y MRR en el tiempo</p>
      <div className="flex flex-wrap gap-5 mb-4">
        {[
          { label: "Cash Collected", color: "#ffde21" },
          { label: "Total Revenue",  color: "#fb923c" },
          { label: "MRR",            color: "#60a5fa" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="h-[3px] w-5 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="text-[11px] text-white/50">{l.label}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <defs>
            {[["cash","#ffde21"],["revenue","#fb923c"],["mrr","#60a5fa"]].map(([key, color]) => (
              <linearGradient key={key} id={`grad_all_${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0}   />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis stroke="transparent" tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} width={48} />
          <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [fmtVal(v, true), name]} />
          <Area type="monotone" dataKey="cash"    name="Cash Collected" stroke="#ffde21" strokeWidth={2} fill="url(#grad_all_cash)"    dot={false} />
          <Area type="monotone" dataKey="revenue" name="Total Revenue"  stroke="#fb923c" strokeWidth={2} fill="url(#grad_all_revenue)" dot={false} />
          <Area type="monotone" dataKey="mrr"     name="MRR"           stroke="#60a5fa" strokeWidth={2} fill="url(#grad_all_mrr)"     dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function MetricsView() {
  const [metrics,       setMetrics]       = useState<any | null>(null)
  const [annualMetrics, setAnnualMetrics] = useState<any | null>(null)
  const [annualRange,   setAnnualRange]   = useState<{ label: string } | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const showSkeleton = useMinLoading(loading)
  useMarkPageReady(!showSkeleton)

  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const ctxMonth       = useSelectedMonth()
  const activeClientId = useActiveClient()
  const selectedMonth  = hydrated ? (ctxMonth ?? "2025-12") : "2025-12"
  const monthValue     = useMemo(() => normalizeMonthToDate(selectedMonth), [selectedMonth])

  const { reports } = useMonthlyReports()

  const monthRange = useMemo(() => {
    const mm = String(selectedMonth)
    const y  = mm.slice(0, 4), m = mm.slice(5, 7)
    const start = `${y}-${m}-01`
    const nextMonth = new Date(`${start}T00:00:00Z`)
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    const end = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth()+1).padStart(2,"0")}-01`
    return { start, end }
  }, [selectedMonth])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const clientId = activeClientId
        if (!clientId) return
        setLoading(true); setError(null)
        const supabase = createClient()

        const { data: latestRow } = await supabase
          .from("monthly_reports").select("month").eq("client_id", clientId)
          .order("month", { ascending: false }).limit(1).maybeSingle()
        const latestISO = latestRow?.month
          ? (/^\d{4}-\d{2}$/.test(latestRow.month) ? `${latestRow.month}-01` : latestRow.month)
          : `${selectedMonth.slice(0,7)}-01`

        const latestStart = new Date(`${latestISO}T00:00:00Z`)
        const rollingEnd  = new Date(latestStart); rollingEnd.setUTCMonth(rollingEnd.getUTCMonth()+1)
        const rollingStart = new Date(rollingEnd);  rollingStart.setUTCMonth(rollingStart.getUTCMonth()-12)
        const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-01`

        const [annualRes, rangeRes] = await Promise.all([
          supabase.from("monthly_reports").select("*").eq("client_id", clientId)
            .gte("month", fmt(rollingStart)).lt("month", fmt(rollingEnd))
            .order("month", { ascending: true }),
          supabase.from("monthly_reports").select("*").eq("client_id", clientId)
            .gte("month", monthRange.start).lt("month", monthRange.end)
            .order("month", { ascending: true }).limit(1),
        ])

        if (annualRes.error) throw annualRes.error
        if (rangeRes.error)  throw rangeRes.error

        const skipKeys = new Set(["id","client_id","created_at","updated_at","month","report_date","improvements","feedback","next_focus","support_needed"])
        const snapshotKeys = new Set(["short_followers","yt_subscribers","yt_monthly_audience","email_subscribers","active_clients","mrr"])
        const annual: Record<string, any> = {}
        for (const row of (annualRes.data ?? [])) {
          for (const [k, v] of Object.entries(row ?? {})) {
            if (skipKeys.has(k) || k.startsWith("reflection")) continue
            const n = Number.isFinite(Number(v)) ? Number(v) : null
            if (n === null) continue
            annual[k] = snapshotKeys.has(k) ? n : ((Number.isFinite(annual[k]) ? annual[k] : 0) + n)
          }
        }

        if (alive) {
          setMetrics((rangeRes.data ?? [])[0] ?? null)
          setAnnualMetrics(Object.keys(annual).length ? annual : null)
          setAnnualRange({ label: `${fmt(rollingStart).slice(0,7)} → ${latestISO.slice(0,7)}` })
          setLoading(false)
        }
      } catch (e: any) {
        if (alive) { setError(e?.message ?? "Error"); setLoading(false) }
      }
    }
    load()
    return () => { alive = false }
  }, [activeClientId, monthValue, monthRange.start, monthRange.end, selectedMonth])

  // For summary strip: find current & previous from reports
  const { current: curReport, previous: prevReport } = useMemo(() => {
    if (!reports.length) return { current: null, previous: null }
    const target = selectedMonth.slice(0, 7)
    let idx = reports.findIndex(r => r.month === target)
    if (idx === -1) idx = reports.length - 1
    return { current: reports[idx] ?? null, previous: reports[idx-1] ?? null }
  }, [reports, selectedMonth])

  if (showSkeleton) {
    return (
      <section className="space-y-6">
        <SectionHeaderSkeleton />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({length:9}).map((_,i) => <StatCardSkeleton key={i} />)}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">All Metrics</h2>
        <p suppressHydrationWarning className="text-[13px] text-white/40 mt-0.5">
          {selectedMonth} · {annualRange ? `Últimos 12 meses: ${annualRange.label}` : "—"}
        </p>
      </div>

      {/* 1. Summary KPI strip */}
      {(curReport || metrics) && (
        <section className="space-y-3">
          <h3 className="text-base font-bold text-white">Snapshot del mes</h3>
          <SummaryStrip current={curReport ?? metrics} previous={prevReport} />
        </section>
      )}

      {/* 2. MoM comparison — reutilizamos el panel del dashboard */}
      <MoMPanel />

      {/* 3. Evolución financiera */}
      {reports.length >= 2 && (
        <section className="space-y-4">
          <RollingTrend reports={reports} />
        </section>
      )}

      {/* 4. Health Score Radar */}
      {reports.length >= 2 && (
        <section className="grid gap-5 md:grid-cols-2">
          <HealthRadar reports={reports} />
          {/* Texto explicativo */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6 flex flex-col justify-center gap-4">
            <h3 className="text-[16px] font-bold text-white">¿Cómo leer el radar?</h3>
            <div className="space-y-3 text-sm text-white/50 leading-relaxed">
              <p>Cada eje representa una métrica clave. <span className="text-white/70 font-medium">100 = tu mejor mes histórico</span> en esa categoría.</p>
              <p>Un radar balanceado y grande → negocio saludable en todos los frentes.</p>
              <p>Un eje caído → ahí está el problema. Si Instagram cae y el cash cae, la correlación es clara.</p>
              <p className="text-white/35 text-xs">Los valores se normalizan automáticamente cada vez que hay un nuevo máximo histórico.</p>
            </div>
          </div>
        </section>
      )}

      {/* 5. Tabla completa de métricas */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-white">Tabla completa</h3>
          <p className="text-xs text-white/35 mt-0.5">Todos los campos del reporte mensual + acumulado 12 meses</p>
        </div>
        <MetricsSection
          metrics={metrics}
          annualMetrics={annualMetrics}
          loading={loading}
          error={error}
        />
      </section>
    </div>
  )
}
