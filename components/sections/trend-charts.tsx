"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import { useActiveClient } from "@/components/layout/dashboard-layout"

function fmtMonthLabel(month: string) {
  const s = String(month).slice(0, 7) // "2025-01"
  const [year, mon] = s.split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  const idx = parseInt(mon, 10) - 1
  return `${names[idx] ?? mon} '${year.slice(2)}`
}

const TABS = [
  { key: "cash_collected",  label: "Cash Collected",  type: "bar",  format: "money"  },
  { key: "total_revenue",   label: "Total Revenue",   type: "bar",  format: "money"  },
  { key: "new_clients",     label: "Nuevos Clientes", type: "area", format: "number" },
  { key: "yt_subscribers",  label: "YouTube",         type: "area", format: "number" },
  { key: "short_followers", label: "Instagram",       type: "area", format: "number" },
] as const

type TabKey = typeof TABS[number]["key"]

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#111113",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
  },
  labelStyle: { color: "#ffffff", fontWeight: 700, marginBottom: 6, fontSize: 12 },
  itemStyle: { color: "#ffde21", fontWeight: 600 },
}

export function TrendCharts() {
  const activeClientId = useActiveClient()

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("cash_collected")

  useEffect(() => {
    let mounted = true
    if (!activeClientId) {
      setLoading(true)
      setData([])
      return () => { mounted = false }
    }
    async function load() {
      try {
        if (mounted) {
          setLoading(true)
          setError(null)
          setData([])
        }
        const supabase = createClient()
        const { data: u, error: uErr } = await supabase.auth.getUser()
        if (uErr) throw uErr
        if (!u?.user) throw new Error("No session")
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", u.user.id)
          .single()
        if (pErr) throw pErr
        const clientIdToUse = activeClientId || profile?.client_id
        if (!clientIdToUse) return
        const { data: reports, error: rErr } = await supabase
          .from("monthly_reports")
          .select("month, cash_collected, total_revenue, new_clients, yt_subscribers, short_followers")
          .eq("client_id", clientIdToUse)
          .order("month", { ascending: true })
        if (rErr) throw rErr
        if (mounted) setData(Array.isArray(reports) ? reports : [])
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Error cargando métricas")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [activeClientId])

  const activeConfig = TABS.find(t => t.key === activeTab) ?? TABS[0]

  const chartData = useMemo(
    () => data.map(r => ({ month: fmtMonthLabel(r.month), value: Number(r[activeConfig.key]) || 0 })),
    [data, activeConfig.key]
  )

  const avg = useMemo(
    () => chartData.length ? chartData.reduce((s, d) => s + d.value, 0) / chartData.length : 0,
    [chartData]
  )

  const formatTick = (v: number) =>
    activeConfig.format === "money"
      ? `$${(v / 1000).toFixed(0)}k`
      : v >= 1000
      ? `${(v / 1000).toFixed(0)}k`
      : String(v)

  const formatTooltipVal = (v: number) =>
    activeConfig.format === "money"
      ? [`$${Number(v).toLocaleString()}`, activeConfig.label]
      : [Number(v).toLocaleString(), activeConfig.label]

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">Trend Analysis</h2>
        </div>
        {!loading && data.length > 0 && (
          <span className="text-xs text-white/30 tabular-nums">{data.length} meses</span>
        )}
      </div>

      {/* Connected pill tab selector */}
      <div className="inline-flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-1 gap-0.5 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
              activeTab === tab.key
                ? "bg-[#ffde21] text-black shadow-sm"
                : "text-white/45 hover:text-white/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-white/40 text-sm">Cargando métricas…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && data.length === 0 && (
        <p className="text-white/40 text-sm">Este cliente todavía no tiene reportes cargados.</p>
      )}

      {!loading && data.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,222,33,0.04),transparent_60%)]" />
          <div className="relative border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{activeConfig.label}</p>
              {avg > 0 && (
                <span className="text-xs text-white/35 tabular-nums">
                  Promedio:{" "}
                  {activeConfig.format === "money"
                    ? `$${Math.round(avg).toLocaleString()}`
                    : Math.round(avg).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={320}>
              {activeConfig.type === "bar" ? (
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffde21" stopOpacity={1} />
                      <stop offset="100%" stopColor="#f5c800" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.08} />
                  <XAxis dataKey="month" stroke="#ffffff60" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff60" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatTick} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,222,33,0.05)" }}
                    contentStyle={tooltipStyle.contentStyle}
                    labelStyle={tooltipStyle.labelStyle}
                    itemStyle={tooltipStyle.itemStyle}
                    formatter={formatTooltipVal}
                  />
                  {avg > 0 && (
                    <ReferenceLine
                      y={avg}
                      stroke="#ffde21"
                      strokeDasharray="5 4"
                      strokeOpacity={0.35}
                      label={{ value: "avg", position: "insideTopRight", fill: "#ffde2166", fontSize: 10 }}
                    />
                  )}
                  <Bar dataKey="value" fill="url(#barGrad)" radius={[5, 5, 0, 0]} maxBarSize={48} />
                </BarChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ffde21" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ffde21" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.08} />
                  <XAxis dataKey="month" stroke="#ffffff60" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff60" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatTick} />
                  <Tooltip
                    cursor={{ stroke: "#ffde2140", strokeWidth: 1 }}
                    contentStyle={tooltipStyle.contentStyle}
                    labelStyle={tooltipStyle.labelStyle}
                    itemStyle={tooltipStyle.itemStyle}
                    formatter={formatTooltipVal}
                  />
                  {avg > 0 && (
                    <ReferenceLine
                      y={avg}
                      stroke="#ffde21"
                      strokeDasharray="5 4"
                      strokeOpacity={0.35}
                      label={{ value: "avg", position: "insideTopRight", fill: "#ffde2166", fontSize: 10 }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#ffde21"
                    strokeWidth={2.5}
                    fill="url(#areaGrad)"
                    dot={{ fill: "#ffde21", r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#ffde21", strokeWidth: 2, stroke: "#000" }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  )
}
