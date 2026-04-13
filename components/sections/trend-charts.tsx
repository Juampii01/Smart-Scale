"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import {
  Area, AreaChart, Bar, BarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { TrendingUp, TrendingDown } from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonthLabel(month: string) {
  const s = String(month).slice(0, 7)
  const [year, mon] = s.split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  const idx = parseInt(mon, 10) - 1
  return `${names[idx] ?? mon} '${year.slice(2)}`
}

function fmtMoney(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

function fmtNum(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

// ─── Chart configs ────────────────────────────────────────────────────────────

const CHARTS = [
  {
    key:      "cash_collected",
    label:    "Cash Collected",
    subtitle: "Total cash collected over time",
    type:     "bar"  as const,
    format:   "money" as const,
    color:    "#ffde21",
    gradId:   "grad_cash",
  },
  {
    key:      "mrr",
    label:    "MRR Growth",
    subtitle: "Monthly recurring revenue",
    type:     "area" as const,
    format:   "money" as const,
    color:    "#60a5fa",
    gradId:   "grad_mrr",
  },
  {
    key:      "new_clients",
    label:    "New Clients Signed",
    subtitle: "Clients signed per month",
    type:     "bar"  as const,
    format:   "number" as const,
    color:    "#4ade80",
    gradId:   "grad_clients",
  },
  {
    key:      "short_followers",
    label:    "Instagram Followers",
    subtitle: "Follower count over time",
    type:     "area" as const,
    format:   "number" as const,
    color:    "#818cf8",
    gradId:   "grad_ig",
  },
]

// ─── Single Chart Card ────────────────────────────────────────────────────────

function ChartCard({
  cfg,
  data,
}: {
  cfg: typeof CHARTS[number]
  data: Array<{ month: string; value: number }>
}) {
  const latest  = data[data.length - 1]?.value ?? 0
  const prev    = data[data.length - 2]?.value ?? null
  const diff    = prev !== null ? latest - prev : null
  const pct     = diff !== null && prev && prev !== 0 ? (diff / prev) * 100 : null
  const isUp    = diff !== null && diff > 0
  const isDown  = diff !== null && diff < 0

  const fmtVal  = (v: number) => cfg.format === "money" ? fmtMoney(v) : fmtNum(v)
  const tickFmt = (v: number) => cfg.format === "money" ? fmtMoney(v) : fmtNum(v)

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "#0f0f10",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px",
      boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
      padding: "10px 14px",
    },
    labelStyle:  { color: "#ffffff", fontWeight: 700, marginBottom: 4, fontSize: 12 },
    itemStyle:   { color: cfg.color, fontWeight: 600, fontSize: 13 },
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] hover:border-white/[0.12] transition-colors duration-200">
      {/* Subtle top accent */}
      <div className="h-[2px] w-full" style={{ backgroundColor: cfg.color, opacity: 0.6 }} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-[19px] font-bold text-white leading-tight tracking-tight">{cfg.label}</h3>
            <p className="text-[13px] text-white/45 mt-0.5">{cfg.subtitle}</p>
          </div>
          {diff !== null && (
            <span
              className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shrink-0 ml-3 ${
                isUp   ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                : isDown ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                :          "bg-white/5 text-white/40 ring-1 ring-white/10"
              }`}
            >
              {isUp && <TrendingUp className="h-3 w-3" />}
              {isDown && <TrendingDown className="h-3 w-3" />}
              {pct !== null
                ? `${pct > 0 ? "+" : ""}${Math.round(pct)}%`
                : `${diff > 0 ? "+" : ""}${fmtVal(Math.abs(diff))}`}
            </span>
          )}
        </div>

        {/* Latest value as big number */}
        {data.length > 0 && (
          <p className="mt-3 mb-5 text-3xl font-bold tracking-tight" style={{ color: cfg.color }}>
            {fmtVal(latest)}
          </p>
        )}

        {/* Chart */}
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            {cfg.type === "bar" ? (
              <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id={cfg.gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={cfg.color} stopOpacity={1}    />
                    <stop offset="100%" stopColor={cfg.color} stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="month"
                  stroke="transparent"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="transparent"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={tickFmt}
                  width={52}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={tooltipStyle.contentStyle}
                  labelStyle={tooltipStyle.labelStyle}
                  itemStyle={tooltipStyle.itemStyle}
                  formatter={(v: number) => [fmtVal(v), cfg.label]}
                />
                <Bar dataKey="value" fill={`url(#${cfg.gradId})`} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            ) : (
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id={cfg.gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.3}  />
                    <stop offset="95%" stopColor={cfg.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="month"
                  stroke="transparent"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="transparent"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={tickFmt}
                  width={52}
                />
                <Tooltip
                  cursor={{ stroke: `${cfg.color}40`, strokeWidth: 1 }}
                  contentStyle={tooltipStyle.contentStyle}
                  labelStyle={tooltipStyle.labelStyle}
                  itemStyle={tooltipStyle.itemStyle}
                  formatter={(v: number) => [fmtVal(v), cfg.label]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={cfg.color}
                  strokeWidth={2.5}
                  fill={`url(#${cfg.gradId})`}
                  dot={false}
                  activeDot={{ r: 5, fill: cfg.color, strokeWidth: 2, stroke: "#0a0a0b" }}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center">
            <p className="text-sm text-white/25">Sin datos</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TrendCharts() {
  const activeClientId = useActiveClient()
  const [rows, setRows]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    if (!activeClientId) { setLoading(true); setRows([]); return () => { mounted = false } }

    async function load() {
      try {
        if (mounted) { setLoading(true); setError(null); setRows([]) }
        const supabase = createClient()
        const { data: u, error: uErr } = await supabase.auth.getUser()
        if (uErr) throw uErr
        if (!u?.user) throw new Error("No session")
        const { data: profile, error: pErr } = await supabase
          .from("profiles").select("client_id").eq("id", u.user.id).single()
        if (pErr) throw pErr
        const cid = activeClientId || profile?.client_id
        if (!cid) return
        const { data: reports, error: rErr } = await supabase
          .from("monthly_reports")
          .select("month, cash_collected, total_revenue, mrr, new_clients, short_followers, yt_subscribers, ad_spend")
          .eq("client_id", cid)
          .order("month", { ascending: true })
        if (rErr) throw rErr
        if (mounted) setRows(Array.isArray(reports) ? reports : [])
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Error cargando métricas")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [activeClientId])

  const chartDataMap = useMemo(() => {
    const map: Record<string, Array<{ month: string; value: number }>> = {}
    CHARTS.forEach(cfg => {
      map[cfg.key] = rows.map(r => ({
        month: fmtMonthLabel(r.month),
        value: Number(r[cfg.key]) || 0,
      }))
    })
    return map
  }, [rows])

  if (loading) {
    return (
      <section>
        <div className="grid gap-5 md:grid-cols-2">
          {CHARTS.map(cfg => (
            <div key={cfg.key} className="rounded-2xl border border-white/[0.07] bg-[#111113] h-[380px] animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>
  }

  if (!rows.length) {
    return (
      <section>
        <p className="text-white/40 text-sm">Este cliente todavía no tiene reportes cargados.</p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Analytics</h2>
        <span className="ml-auto text-xs text-white/30 tabular-nums">{rows.length} meses</span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {CHARTS.map(cfg => (
          <ChartCard key={cfg.key} cfg={cfg} data={chartDataMap[cfg.key]} />
        ))}
      </div>
    </section>
  )
}
