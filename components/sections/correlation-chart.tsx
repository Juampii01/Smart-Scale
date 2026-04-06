"use client"

import { useMemo } from "react"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"
import { useMonthlyReports } from "@/hooks/use-monthly-reports"

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
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}
function fmtNum(v: number) {
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

// ─── Tooltip personalizado ────────────────────────────────────────────────────

const tooltipBase = {
  contentStyle: {
    backgroundColor: "#0f0f10",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "14px",
    boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
    padding: "12px 16px",
  },
  labelStyle: { color: "#fff", fontWeight: 700, marginBottom: 6, fontSize: 12 },
}

// ─── Single Correlation Card ──────────────────────────────────────────────────

interface CorrCardProps {
  title: string
  insight: string
  data:   any[]
  barKey:    string
  barLabel:  string
  barColor:  string
  lineKey:   string
  lineLabel: string
  lineColor: string
  fmtBar:    (v: number) => string
  fmtLine:   (v: number) => string
}

function CorrCard({
  title, insight, data,
  barKey, barLabel, barColor,
  lineKey, lineLabel, lineColor,
  fmtBar, fmtLine,
}: CorrCardProps) {
  // Avg reference lines
  const avgBar  = data.length ? data.reduce((s, d) => s + d[barKey],  0) / data.length : 0
  const avgLine = data.length ? data.reduce((s, d) => s + d[lineKey], 0) / data.length : 0

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] hover:border-white/[0.12] transition-colors duration-200">
      <div className="h-[2px] w-full bg-gradient-to-r"
        style={{ background: `linear-gradient(90deg, ${barColor}90, ${lineColor}90)` }} />

      <div className="p-6">
        {/* Header */}
        <h3 className="text-[18px] font-bold text-white leading-tight">{title}</h3>
        <p className="text-[12px] text-white/40 mt-1 mb-5 leading-relaxed">{insight}</p>

        {/* Legend */}
        <div className="flex items-center gap-5 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: barColor }} />
            <span className="text-[11px] text-white/50 font-medium">{barLabel}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-[3px] w-5 rounded-full" style={{ backgroundColor: lineColor }} />
            <span className="text-[11px] text-white/50 font-medium">{lineLabel}</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id={`bar_${barKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={barColor}  stopOpacity={0.9} />
                <stop offset="100%" stopColor={barColor}  stopOpacity={0.6} />
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
            {/* Left Y: bar metric */}
            <YAxis
              yAxisId="bar"
              stroke="transparent"
              tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtBar}
              width={48}
            />
            {/* Right Y: line metric */}
            <YAxis
              yAxisId="line"
              orientation="right"
              stroke="transparent"
              tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtLine}
              width={48}
            />
            <Tooltip
              contentStyle={tooltipBase.contentStyle}
              labelStyle={tooltipBase.labelStyle}
              formatter={(v: number, name: string) => {
                if (name === barLabel)  return [fmtBar(v),  name]
                if (name === lineLabel) return [fmtLine(v), name]
                return [v, name]
              }}
              itemStyle={{ fontSize: 13, fontWeight: 600 }}
            />
            {/* Avg reference for bar */}
            {avgBar > 0 && (
              <ReferenceLine
                yAxisId="bar"
                y={avgBar}
                stroke={barColor}
                strokeDasharray="4 3"
                strokeOpacity={0.3}
                label={{ value: "avg", position: "insideTopLeft", fill: `${barColor}60`, fontSize: 9 }}
              />
            )}
            <Bar
              yAxisId="bar"
              dataKey={barKey}
              name={barLabel}
              fill={`url(#bar_${barKey})`}
              radius={[5, 5, 0, 0]}
              maxBarSize={44}
            />
            <Line
              yAxisId="line"
              type="monotone"
              dataKey={lineKey}
              name={lineLabel}
              stroke={lineColor}
              strokeWidth={2.5}
              dot={{ fill: lineColor, r: 3.5, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: lineColor, strokeWidth: 2, stroke: "#0a0a0b" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CorrelationChart() {
  const { reports, loading } = useMonthlyReports()

  const data = useMemo(() =>
    reports.map(r => ({
      month:    fmtMonthLabel(r.month),
      cash:     r.cash_collected,
      revenue:  r.total_revenue,
      mrr:      r.mrr,
      clients:  r.new_clients,
      ig:       r.short_followers,
      yt:       r.yt_subscribers,
      adspend:  r.ad_spend,
    })),
    [reports]
  )

  if (loading) {
    return (
      <section>
        <div className="grid gap-5 md:grid-cols-2">
          {[0,1,2,3].map(i => (
            <div key={i} className="h-[380px] animate-pulse rounded-2xl border border-white/[0.07] bg-[#111113]" />
          ))}
        </div>
      </section>
    )
  }

  if (data.length < 2) return null

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Correlaciones</h2>
        <p className="text-[13px] text-white/40 mt-0.5">
          ¿Qué acciones generan los resultados? Compará métricas en el mismo eje de tiempo.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* 1. Cash Collected vs Nuevos Clientes */}
        <CorrCard
          title="Cash vs Cierres"
          insight="¿Cada cliente que cerraste se refleja en el cash? Si los cierres suben pero el cash no, hay un problema de pricing o de condiciones."
          data={data}
          barKey="cash"    barLabel="Cash Collected" barColor="#ffde21"
          lineKey="clients" lineLabel="Nuevos Clientes" lineColor="#4ade80"
          fmtBar={fmtMoney}
          fmtLine={(v) => String(v)}
        />

        {/* 2. Cash Collected vs Seguidores Instagram */}
        <CorrCard
          title="Cash vs Instagram"
          insight="¿El crecimiento en seguidores precede al cash? Normalmente hay un lag de 1-3 meses entre la audiencia y los ingresos."
          data={data}
          barKey="cash"  barLabel="Cash Collected"      barColor="#ffde21"
          lineKey="ig"   lineLabel="Seguidores IG"       lineColor="#818cf8"
          fmtBar={fmtMoney}
          fmtLine={fmtNum}
        />

        {/* 3. Revenue vs Ad Spend */}
        <CorrCard
          title="Revenue vs Gasto en Ads"
          insight="¿El dinero invertido en ads se transforma en revenue? Si el gasto sube y el revenue no, revisá la eficiencia de las campañas."
          data={data}
          barKey="revenue"  barLabel="Total Revenue"      barColor="#fb923c"
          lineKey="adspend" lineLabel="Gasto en Ads"       lineColor="#ef4444"
          fmtBar={fmtMoney}
          fmtLine={fmtMoney}
        />

        {/* 4. MRR vs Total Revenue */}
        <CorrCard
          title="MRR vs Revenue Total"
          insight="¿Cuánto del revenue es recurrente? Un MRR alto y estable es la base de un negocio escalable. Si el total sube pero el MRR no, dependés de cierres únicos."
          data={data}
          barKey="revenue" barLabel="Total Revenue"  barColor="#fb923c"
          lineKey="mrr"    lineLabel="MRR"            lineColor="#60a5fa"
          fmtBar={fmtMoney}
          fmtLine={fmtMoney}
        />
      </div>
    </section>
  )
}
