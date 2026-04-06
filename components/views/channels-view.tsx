"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useSelectedMonth, useActiveClient } from "@/components/layout/dashboard-layout"
import { useMarkPageReady } from "@/hooks/use-mark-page-ready"
import { useMinLoading } from "@/hooks/use-min-loading"
import { useMonthlyReports } from "@/hooks/use-monthly-reports"
import { ChannelBlockSkeleton, SectionHeaderSkeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Eye, FileText, Instagram, Youtube, Mail } from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Bar,
  ReferenceLine,
} from "recharts"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCompact(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  const n = Number(v)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function fmtMonth(m: string) {
  const s = String(m).slice(0, 7)
  const [year, mon] = s.split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${names[parseInt(mon,10)-1] ?? mon} '${year.slice(2)}`
}

function calcDelta(cur: number | null | undefined, prev: number | null | undefined) {
  const c = Number(cur ?? 0), p = Number(prev ?? 0)
  if (!p) return { diff: 0, pct: null as number | null }
  const diff = c - p
  return { diff, pct: (diff / p) * 100 }
}

const tooltipBase = {
  contentStyle: {
    backgroundColor: "#0f0f10",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "14px",
    padding: "10px 14px",
  },
  labelStyle: { color: "#fff", fontWeight: 700, fontSize: 12 },
  itemStyle:  { fontSize: 12, fontWeight: 600 },
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function Sparkline({ data, color, isUp }: { data: number[]; color: string; isUp: boolean }) {
  const pts = data.map((v, i) => ({ i, v }))
  const stroke = isUp ? color : "#f87171"
  return (
    <ResponsiveContainer width="100%" height={52}>
      <AreaChart data={pts} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spk_ch_${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={stroke} stopOpacity={0.3} />
            <stop offset="95%" stopColor={stroke} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.5}
          fill={`url(#spk_ch_${color.replace("#","")})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Channel Card ─────────────────────────────────────────────────────────────

function ChannelCard({
  icon: Icon, title, color,
  audience, audienceLabel,
  rows,
  delta, sparkValues,
  noData,
}: {
  icon: React.ElementType; title: string; color: string
  audience: string; audienceLabel: string
  rows: { icon: React.ElementType; label: string; value: string }[]
  delta: { diff: number; pct: number | null }
  sparkValues: number[]
  noData?: boolean
}) {
  const isUp   = delta.diff >= 0
  const hasDelta = delta.pct !== null

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] hover:border-white/[0.12] transition-colors duration-200">
      <div className="h-[2px] w-full" style={{ backgroundColor: color, opacity: noData ? 0.2 : 0.7 }} />

      <div className="flex-1 p-5 pb-2">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl ring-1"
              style={{ backgroundColor: `${color}18`, boxShadow: `0 0 0 1px ${color}30` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <span className="text-[13px] font-bold text-white/90">{title}</span>
          </div>
          {hasDelta && !noData && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
              isUp
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                : "bg-red-500/10 text-red-300 ring-red-500/20"
            }`}>
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta.pct !== null ? `${delta.pct > 0 ? "+" : ""}${Math.round(delta.pct)}%` : "—"}
            </span>
          )}
        </div>

        {noData ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <p className="text-white/20 text-sm">Sin datos</p>
            <p className="text-white/15 text-xs">Cargá el reporte del mes</p>
          </div>
        ) : (
          <>
            <p className="text-[36px] font-bold tracking-tight leading-none text-white">{audience}</p>
            <p className="text-[11px] text-white/35 mt-1 mb-4">{audienceLabel}</p>
            <div className="space-y-0">
              {rows.map((row, i) => (
                <div key={i} className={`flex items-center justify-between py-2 ${i < rows.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
                  <div className="flex items-center gap-1.5 text-xs text-white/40">
                    <row.icon className="h-3.5 w-3.5" />{row.label}
                  </div>
                  <span className="text-sm font-semibold text-white tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sparkline */}
      {sparkValues.length >= 2 && !noData && (
        <div className="opacity-75">
          <Sparkline data={sparkValues} color={color} isUp={isUp} />
        </div>
      )}
    </div>
  )
}

// ─── Growth Index Chart ───────────────────────────────────────────────────────
// Normaliza todos los canales a base 100 en el primer mes con datos.
// Así podés comparar tasas de crecimiento aunque las escalas sean muy distintas.

function GrowthIndexChart({ reports }: { reports: any[] }) {
  if (reports.length < 2) return null

  const channels = [
    { key: "ig",    dataKey: "short_followers",   label: "Instagram", color: "#818cf8" },
    { key: "yt",    dataKey: "yt_subscribers",     label: "YouTube",   color: "#f87171" },
    { key: "email", dataKey: "email_subscribers",  label: "Email",     color: "#4ade80" },
  ]

  // Base = primer valor no-cero de cada canal
  const bases: Record<string, number> = {}
  for (const ch of channels) {
    const first = reports.find(r => (r[ch.dataKey] || 0) > 0)
    bases[ch.key] = first ? Number(first[ch.dataKey]) : 0
  }

  const hasAny = Object.values(bases).some(v => v > 0)
  if (!hasAny) return null

  const data = reports.map(r => {
    const row: Record<string, any> = { month: fmtMonth(r.month) }
    for (const ch of channels) {
      const base = bases[ch.key]
      const val  = Number(r[ch.dataKey]) || 0
      row[ch.key] = base > 0 && val > 0 ? Math.round((val / base) * 100) : null
    }
    return row
  })

  const activeChannels = channels.filter(ch => bases[ch.key] > 0)

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h4 className="text-[16px] font-bold text-white">Índice de Crecimiento</h4>
          <p className="text-xs text-white/35 mt-0.5">
            Base 100 = primer mes con datos. Muestra quién crece más rápido, sin importar la escala.
          </p>
        </div>
        {/* Tip */}
        <span className="text-[10px] text-white/25 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 ml-4 mt-0.5 whitespace-nowrap">
          200 = duplicó su audiencia
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-5 mt-4 mb-5">
        {activeChannels.map(ch => (
          <div key={ch.key} className="flex items-center gap-1.5">
            <span className="h-[3px] w-5 rounded-full" style={{ backgroundColor: ch.color }} />
            <span className="text-[11px] text-white/55 font-medium">{ch.label}</span>
            <span className="text-[10px] text-white/25">({fmtCompact(bases[ch.key])} base)</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" stroke="transparent"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis stroke="transparent" domain={[80, 'auto']}
            tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={v => `${v}`} width={36} />
          {/* Baseline 100 */}
          <ReferenceLine y={100} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 3" />
          <Tooltip {...tooltipBase}
            formatter={(v: number, name: string) => [`${v}`, name]}
          />
          {activeChannels.map(ch => (
            <Line key={ch.key} type="monotone" dataKey={ch.key} name={ch.label}
              stroke={ch.color} strokeWidth={2.5} connectNulls
              dot={{ fill: ch.color, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: ch.color, strokeWidth: 2, stroke: "#0a0a0b" }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Content vs Audience Chart ────────────────────────────────────────────────

function ContentVsAudience({ reports }: { reports: any[] }) {
  if (reports.length < 2) return null

  const hasPosts = reports.some(r => (r.short_posts || 0) > 0)
  if (!hasPosts) return null

  const data = reports.map(r => ({
    month:     fmtMonth(r.month),
    posts:     r.short_posts       || 0,
    followers: r.short_followers   || 0,
  }))

  const avgPosts = data.reduce((s, d) => s + d.posts, 0) / data.length

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
      <h4 className="text-[16px] font-bold text-white mb-1">Posts vs Seguidores Instagram</h4>
      <p className="text-xs text-white/35 mb-5">
        ¿Cuándo publicás más, la audiencia crece? Buscá el patrón entre las barras y la línea.
      </p>
      <div className="flex flex-wrap gap-5 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#ffde21]" />
          <span className="text-[11px] text-white/50">Posts publicados</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-[3px] w-5 rounded-full bg-[#818cf8]" />
          <span className="text-[11px] text-white/50">Seguidores IG</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" stroke="transparent"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="posts" stroke="transparent" width={28}
            tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10 }} tickLine={false} axisLine={false}
            domain={[0, 'auto']} />
          <YAxis yAxisId="followers" orientation="right" stroke="transparent" width={48}
            tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
            domain={[0, 'auto']} />
          {avgPosts > 0 && (
            <ReferenceLine yAxisId="posts" y={avgPosts} stroke="#ffde2140" strokeDasharray="4 3"
              label={{ value: "avg", position: "insideTopLeft", fill: "#ffde2150", fontSize: 9 }} />
          )}
          <Tooltip {...tooltipBase}
            formatter={(v: number, name: string) => [
              name === "Seguidores IG" ? fmtCompact(v) : String(v), name
            ]}
          />
          <Bar yAxisId="posts" dataKey="posts" name="Posts publicados"
            fill="#ffde21" fillOpacity={0.75} radius={[4,4,0,0]} maxBarSize={36} />
          <Line yAxisId="followers" type="monotone" dataKey="followers" name="Seguidores IG"
            stroke="#818cf8" strokeWidth={2.5}
            dot={{ fill: "#818cf8", r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── YouTube Trend ────────────────────────────────────────────────────────────

function YouTubeTrend({ reports }: { reports: any[] }) {
  if (reports.length < 2) return null
  const hasYT = reports.some(r => (r.yt_subscribers || 0) > 0)
  if (!hasYT) return null

  const data = reports.map(r => ({
    month: fmtMonth(r.month),
    subs:  r.yt_subscribers || 0,
    views: r.yt_views       || 0,
  }))

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
      <h4 className="text-[16px] font-bold text-white mb-1">YouTube — Suscriptores vs Vistas</h4>
      <p className="text-xs text-white/35 mb-5">¿Las vistas generan suscriptores o son independientes?</p>
      <div className="flex flex-wrap gap-5 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#f87171]" />
          <span className="text-[11px] text-white/50">Vistas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-[3px] w-5 rounded-full bg-[#fbbf24]" />
          <span className="text-[11px] text-white/50">Suscriptores</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" stroke="transparent"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="views" stroke="transparent" width={44}
            tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
            domain={[0, 'auto']} />
          <YAxis yAxisId="subs" orientation="right" stroke="transparent" width={44}
            tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
            domain={[0, 'auto']} />
          <Tooltip {...tooltipBase}
            formatter={(v: number, name: string) => [fmtCompact(v), name]} />
          <Bar yAxisId="views" dataKey="views" name="Vistas"
            fill="#f87171" fillOpacity={0.7} radius={[4,4,0,0]} maxBarSize={36} />
          <Line yAxisId="subs" type="monotone" dataKey="subs" name="Suscriptores"
            stroke="#fbbf24" strokeWidth={2.5}
            dot={{ fill: "#fbbf24", r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ChannelsView() {
  const ctxMonth       = useSelectedMonth()
  const activeClientId = useActiveClient()
  const selectedMonth  = ctxMonth ?? "2025-12"
  const { reports }    = useMonthlyReports()

  const [current, setCurrent] = useState<any | null>(null)
  const [prev,    setPrev]    = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const showSkeleton = useMinLoading(loading)
  useMarkPageReady(!showSkeleton)

  const monthYYYYMM = useMemo(() => {
    if (/^\d{4}-\d{2}$/.test(selectedMonth))     return selectedMonth
    if (/^\d{4}-\d{2}-\d{2}$/.test(selectedMonth)) return selectedMonth.slice(0, 7)
    return "2025-12"
  }, [selectedMonth])

  useEffect(() => {
    let alive = true
    if (!activeClientId) { setLoading(true); setCurrent(null); setPrev(null); return () => { alive = false } }
    async function load() {
      try {
        if (alive) { setLoading(true); setError(null) }
        const supabase = createClient()
        const { data: { user }, error: uErr } = await supabase.auth.getUser()
        if (uErr) throw uErr
        if (!user) throw new Error("No session")

        const monthDate     = /^\d{4}-\d{2}$/.test(monthYYYYMM) ? `${monthYYYYMM}-01` : monthYYYYMM
        const [y, m]        = monthYYYYMM.split("-").map(Number)
        const prevD         = new Date(y, m - 2, 1)
        const prevMonthDate = `${prevD.getFullYear()}-${String(prevD.getMonth()+1).padStart(2,"0")}-01`
        const fields        = "month,short_followers,short_reach,short_posts,yt_subscribers,yt_views,yt_monthly_audience,yt_videos,email_subscribers,email_new_subscribers"

        const [curRes, prevRes] = await Promise.all([
          supabase.from("monthly_reports").select(fields).eq("client_id", activeClientId).eq("month", monthDate).maybeSingle(),
          supabase.from("monthly_reports").select(fields).eq("client_id", activeClientId).eq("month", prevMonthDate).maybeSingle(),
        ])
        if (curRes.error)  throw curRes.error
        if (prevRes.error) throw prevRes.error
        if (alive) { setCurrent(curRes.data ?? null); setPrev(prevRes.data ?? null); setLoading(false) }
      } catch (e: any) {
        if (alive) { setCurrent(null); setPrev(null); setLoading(false); setError(e?.message ?? "Error") }
      }
    }
    load()
    return () => { alive = false }
  }, [monthYYYYMM, activeClientId])

  // Sparklines from hook
  const igSpark    = useMemo(() => reports.slice(-8).map(r => r.short_followers),   [reports])
  const ytSpark    = useMemo(() => reports.slice(-8).map(r => r.yt_subscribers),    [reports])
  const emlSpark   = useMemo(() => reports.slice(-8).map(r => r.email_subscribers), [reports])

  const igDelta    = calcDelta(current?.short_followers,   prev?.short_followers)
  const ytDelta    = calcDelta(current?.yt_subscribers,    prev?.yt_subscribers)
  const emlDelta   = calcDelta(current?.email_subscribers, prev?.email_subscribers)

  const noIG    = !current?.short_followers
  const noYT    = !current?.yt_subscribers
  const noEmail = !current?.email_subscribers

  if (showSkeleton) {
    return (
      <div className="space-y-6">
        <SectionHeaderSkeleton />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({length:3}).map((_,i) => <ChannelBlockSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Rendimiento por Canal</h2>
        <p className="text-[13px] text-white/40 mt-0.5">Señales de cada canal · {monthYYYYMM}</p>
      </div>

      {error    && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && !current && (
        <p className="text-white/40 text-sm">No hay reporte para este mes.</p>
      )}

      {/* ── Channel cards ── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-white">Este mes</h3>
          <p className="text-xs text-white/35 mt-0.5">vs mes anterior — sparkline = últimos 8 meses</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <ChannelCard
            icon={Instagram} title="Instagram / Short-form" color="#818cf8"
            audience={fmtCompact(current?.short_followers)} audienceLabel="Seguidores totales"
            rows={[
              { icon: Eye,      label: "Alcance",          value: fmtCompact(current?.short_reach) },
              { icon: FileText, label: "Posts publicados", value: fmtCompact(current?.short_posts) },
            ]}
            delta={igDelta} sparkValues={igSpark} noData={noIG}
          />
          <ChannelCard
            icon={Youtube} title="YouTube / Largo" color="#f87171"
            audience={fmtCompact(current?.yt_subscribers)} audienceLabel="Suscriptores"
            rows={[
              { icon: Eye,      label: "Vistas totales",   value: fmtCompact(current?.yt_views ?? current?.yt_monthly_audience) },
              { icon: FileText, label: "Videos subidos",   value: fmtCompact(current?.yt_videos) },
            ]}
            delta={ytDelta} sparkValues={ytSpark} noData={noYT}
          />
          <ChannelCard
            icon={Mail} title="Email Marketing" color="#4ade80"
            audience={fmtCompact(current?.email_subscribers)} audienceLabel="Suscriptores totales"
            rows={[
              { icon: Eye, label: "Nuevos suscriptores", value: fmtCompact(current?.email_new_subscribers) },
            ]}
            delta={emlDelta} sparkValues={emlSpark} noData={noEmail}
          />
        </div>
      </section>

      {/* ── Growth Index Chart ── */}
      {reports.length >= 2 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-base font-bold text-white">¿Quién está creciendo más rápido?</h3>
            <p className="text-xs text-white/35 mt-0.5">
              No importa la escala absoluta — lo que importa es la pendiente
            </p>
          </div>
          <GrowthIndexChart reports={reports} />
        </section>
      )}

      {/* ── Correlations ── */}
      {reports.length >= 2 && (
        <section className="space-y-3">
          <div>
            <h3 className="text-base font-bold text-white">Correlaciones</h3>
            <p className="text-xs text-white/35 mt-0.5">
              ¿El contenido que producís se traduce en audiencia?
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <ContentVsAudience reports={reports} />
            <YouTubeTrend reports={reports} />
          </div>
        </section>
      )}
    </div>
  )
}
