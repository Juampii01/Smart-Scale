"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useMonthlyReports, type MonthlyReport } from "@/hooks/use-monthly-reports"
import { useSelectedMonth } from "@/components/layout/dashboard-layout"
import { Sk } from "@/components/ui/skeleton"
import { SalesView } from "@/components/views/sales-view"
import { TrendingUp, TrendingDown, Eye, FileText, Instagram, Youtube, Mail } from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ComposedChart, Bar, ReferenceLine,
} from "recharts"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtK(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v)) || Number(v) === 0) return "—"
  const n = Number(v)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString("en-US")
}

function fmtMoney(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v)) || Number(v) === 0) return "—"
  const n = Number(v)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString("en-US")}`
}

function fmtMonthLabel(m: string) {
  const [y, mo] = m.split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${names[parseInt(mo, 10) - 1]} '${y.slice(2)}`
}

function pctDelta(cur: number, prev: number) {
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}

function stageStatus(pct: number | null): { label: string; className: string } {
  if (pct === null) return { label: "Sin datos",  className: "bg-foreground/[0.06] text-foreground/40" }
  if (pct >= 5)     return { label: "Saludable",  className: "bg-success-soft text-success" }
  if (pct >= -5)    return { label: "Estable",    className: "bg-foreground/[0.06] text-foreground/60" }
  return               { label: "Atención",    className: "bg-danger-soft text-danger" }
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--card)", border: "1px solid var(--border)",
    borderRadius: "14px", padding: "10px 14px",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 700, fontSize: 12 },
  itemStyle:  { fontSize: 12, fontWeight: 600 },
}

// ─── Stage metric card ────────────────────────────────────────────────────────

function MetricCard({ label, value, pct, noData }: {
  label: string; value: string; pct: number | null; noData?: boolean
}) {
  const up = (pct ?? 0) > 0
  const showDelta = pct !== null && !noData
  return (
    <div className="rounded-[14px] border border-foreground/[0.07] bg-card px-4 py-3.5 flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-foreground/40">{label}</p>
      <p className={cn("text-[26px] font-bold tabular-nums leading-none", noData ? "text-foreground/25" : "text-foreground")}>
        {value}
      </p>
      {showDelta && (
        <p className={cn("text-[12px] font-semibold", up ? "text-success" : "text-danger")}>
          {up ? "+" : ""}{pct!.toFixed(1)}%
        </p>
      )}
    </div>
  )
}

// ─── Stage mini chart ─────────────────────────────────────────────────────────

function MiniChart({ data, dataKey, color, label, className }: {
  data: MonthlyReport[]; dataKey: keyof MonthlyReport; color: string; label: string; className?: string
}) {
  const points = data.slice(-8).map(r => ({ month: fmtMonthLabel(r.month), value: Number(r[dataKey]) || 0 }))
  if (points.every(p => p.value === 0)) return null
  return (
    <div className={cn("rounded-[14px] border border-foreground/[0.07] bg-card p-5 flex flex-col", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-foreground/40 mb-4">{label}</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${String(dataKey)}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="value" name={label} stroke={color} strokeWidth={2}
              fill={`url(#grad-${String(dataKey)})`} dot={false} activeDot={{ r: 4, fill: color }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Channel card (Redes tab) ─────────────────────────────────────────────────

function ChannelCard({ icon: Icon, title, color, audience, audienceLabel, rows, deltaPct, sparkValues, noData }: {
  icon: React.ElementType; title: string; color: string
  audience: string; audienceLabel: string
  rows: { icon: React.ElementType; label: string; value: string }[]
  deltaPct: number | null; sparkValues: number[]; noData?: boolean
}) {
  const isUp = (deltaPct ?? 0) >= 0
  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-foreground/[0.07] bg-card hover:border-foreground/[0.12] transition-colors">
      <div className="flex-1 p-5 pb-2">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${color}18`, boxShadow: `0 0 0 1px ${color}30` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <span className="text-[13px] font-bold text-foreground/90">{title}</span>
          </div>
          {deltaPct !== null && !noData && (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
              isUp
                ? "bg-success-soft text-success"
                : "bg-danger-soft text-danger"
            )}>
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {`${deltaPct > 0 ? "+" : ""}${Math.round(deltaPct)}%`}
            </span>
          )}
        </div>

        {noData ? (
          <div className="flex flex-col items-center justify-center py-6 gap-1">
            <p className="text-foreground/20 text-sm">Sin datos</p>
            <p className="text-foreground/15 text-xs">Cargá el reporte del mes</p>
          </div>
        ) : (
          <>
            <p className="text-[34px] font-bold tabular-nums leading-none text-foreground">{audience}</p>
            <p className="text-[11px] text-foreground/35 mt-1 mb-4">{audienceLabel}</p>
            <div>
              {rows.map((row, i) => (
                <div key={i} className={cn("flex items-center justify-between py-2", i < rows.length - 1 && "border-b border-foreground/[0.05]")}>
                  <div className="flex items-center gap-1.5 text-xs text-foreground/40">
                    <row.icon className="h-3.5 w-3.5" />{row.label}
                  </div>
                  <span className="text-sm font-semibold text-foreground tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {sparkValues.length >= 2 && !noData && (
        <div className="opacity-60 px-0 pb-0">
          <ResponsiveContainer width="100%" height={48}>
            <AreaChart data={sparkValues.map((v, i) => ({ i, v }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spk-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
                fill={`url(#spk-${title})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Redes charts ─────────────────────────────────────────────────────────────

function GrowthIndexChart({ reports }: { reports: MonthlyReport[] }) {
  if (reports.length < 2) return null
  const channels = [
    { key: "ig",    dataKey: "short_followers"  as keyof MonthlyReport, label: "Instagram", color: "#818cf8" },
    { key: "yt",    dataKey: "yt_subscribers"   as keyof MonthlyReport, label: "YouTube",   color: "#f87171" },
    { key: "email", dataKey: "email_subscribers"as keyof MonthlyReport, label: "Email",     color: "#4ade80" },
  ]
  const bases: Record<string, number> = {}
  for (const ch of channels) {
    const first = reports.find(r => (Number(r[ch.dataKey]) || 0) > 0)
    bases[ch.key] = first ? Number(first[ch.dataKey]) : 0
  }
  if (!Object.values(bases).some(v => v > 0)) return null

  const data = reports.map(r => {
    const row: Record<string, any> = { month: fmtMonthLabel(r.month) }
    for (const ch of channels) {
      const base = bases[ch.key], val = Number(r[ch.dataKey]) || 0
      row[ch.key] = base > 0 && val > 0 ? Math.round((val / base) * 100) : null
    }
    return row
  })
  const active = channels.filter(ch => bases[ch.key] > 0)

  return (
    <div className="rounded-[14px] border border-foreground/[0.07] bg-card p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-[15px] font-bold text-foreground">Índice de crecimiento</p>
          <p className="text-[11px] text-foreground/40 mt-0.5">Base 100 = primer mes con datos — quién crece más rápido</p>
        </div>
        <span className="text-[10px] text-foreground/30 bg-foreground/[0.04] border border-foreground/[0.06] rounded-lg px-2 py-1 ml-4 whitespace-nowrap">200 = duplicó</span>
      </div>
      <div className="flex flex-wrap gap-5 mt-4 mb-4">
        {active.map(ch => (
          <div key={ch.key} className="flex items-center gap-1.5">
            <span className="h-[3px] w-5 rounded-full" style={{ backgroundColor: ch.color }} />
            <span className="text-[11px] text-foreground/55">{ch.label}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" stroke="transparent" tick={{ fill: "var(--text-3)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis stroke="transparent" domain={[80, "auto"]} tick={{ fill: "var(--text-3)", fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
          <ReferenceLine y={100} stroke="rgba(255,255,255,0.10)" strokeDasharray="4 3" />
          <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`${v}`, name]} />
          {active.map(ch => (
            <Line key={ch.key} type="monotone" dataKey={ch.key} name={ch.label}
              stroke={ch.color} strokeWidth={2.5} connectNulls
              dot={{ fill: ch.color, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: ch.color, strokeWidth: 2, stroke: "var(--background)" }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function PostsVsFollowers({ reports, className }: { reports: MonthlyReport[]; className?: string }) {
  if (reports.length < 2 || !reports.some(r => r.short_posts > 0)) return null
  const data = reports.map(r => ({ month: fmtMonthLabel(r.month), posts: r.short_posts || 0, followers: r.short_followers || 0 }))
  const avg = data.reduce((s, d) => s + d.posts, 0) / data.length
  return (
    <div className={cn("rounded-[14px] border border-foreground/[0.07] bg-card p-5", className)}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-foreground/40">Contenido vs Audiencia</p>
          <p className="text-[15px] font-bold text-foreground mt-0.5">Posts vs Seguidores IG</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#ffde21]" /><span className="text-[11px] text-foreground/50">Posts</span></div>
          <div className="flex items-center gap-1.5"><span className="h-[3px] w-5 rounded-full bg-[#818cf8]" /><span className="text-[11px] text-foreground/50">Seguidores</span></div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="month" stroke="transparent" tick={{ fill: "var(--text-3)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="posts" stroke="transparent" width={28} tick={{ fill: "var(--text-3)", fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="followers" orientation="right" stroke="transparent" width={44}
            tick={{ fill: "var(--text-3)", fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
          {avg > 0 && <ReferenceLine yAxisId="posts" y={avg} stroke="#ffde2130" strokeDasharray="4 3" />}
          <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [name === "Seguidores" ? fmtK(v) : String(v), name]} />
          <Bar yAxisId="posts" dataKey="posts" name="Posts" fill="#ffde21" fillOpacity={0.8} radius={[4,4,0,0]} maxBarSize={32} />
          <Line yAxisId="followers" type="monotone" dataKey="followers" name="Seguidores"
            stroke="#818cf8" strokeWidth={2} dot={{ fill: "#818cf8", r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function YouTubeTrend({ reports }: { reports: MonthlyReport[] }) {
  if (reports.length < 2 || !reports.some(r => r.yt_subscribers > 0)) return null
  const data = reports.map(r => ({ month: fmtMonthLabel(r.month), subs: r.yt_subscribers || 0, views: r.yt_views || 0 }))
  return (
    <div className="rounded-[14px] border border-foreground/[0.07] bg-card p-5">
      <p className="text-[15px] font-bold text-foreground mb-0.5">YouTube — Suscriptores vs Vistas</p>
      <p className="text-[11px] text-foreground/40 mb-4">¿Las vistas generan suscriptores o son independientes?</p>
      <div className="flex flex-wrap gap-5 mb-4">
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#f87171]" /><span className="text-[11px] text-foreground/50">Vistas</span></div>
        <div className="flex items-center gap-1.5"><span className="h-[3px] w-5 rounded-full bg-[#fbbf24]" /><span className="text-[11px] text-foreground/50">Suscriptores</span></div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="month" stroke="transparent" tick={{ fill: "var(--text-3)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="views" stroke="transparent" width={44} tick={{ fill: "var(--text-3)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
          <YAxis yAxisId="subs" orientation="right" stroke="transparent" width={44} tick={{ fill: "var(--text-3)", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => [fmtK(v)]} />
          <Bar yAxisId="views" dataKey="views" name="Vistas" fill="#f87171" fillOpacity={0.7} radius={[4,4,0,0]} maxBarSize={36} />
          <Line yAxisId="subs" type="monotone" dataKey="subs" name="Suscriptores" stroke="#fbbf24" strokeWidth={2.5} dot={{ fill: "#fbbf24", r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Tab contents ─────────────────────────────────────────────────────────────

function FascinateTab({ cur, prev, all }: { cur: MonthlyReport | null; prev: MonthlyReport | null; all: MonthlyReport[] }) {
  const igDelta    = pctDelta(cur?.short_followers   ?? 0, prev?.short_followers   ?? 0)
  const ytDelta    = pctDelta(cur?.yt_subscribers    ?? 0, prev?.yt_subscribers    ?? 0)
  const emailDelta = pctDelta(cur?.email_subscribers ?? 0, prev?.email_subscribers ?? 0)
  const status = stageStatus(igDelta)
  return (
    <div className="space-y-5">
      <div className="pb-4 border-b border-foreground/[0.07]">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-[22px] font-bold text-foreground">Fascinate</h2>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.className)}>{status.label}</span>
        </div>
        <p className="text-[13px] text-foreground/50">Captar atención — crecer la audiencia que alimenta el motor.</p>
      </div>

      {/* Channel cards: la audiencia por canal ES Fascinate */}
      <div className="grid gap-4 md:grid-cols-3">
        <ChannelCard
          icon={Instagram} title="Instagram" color="#818cf8"
          audience={fmtK(cur?.short_followers)} audienceLabel="Seguidores totales"
          rows={[
            { icon: Eye,      label: "Alcance", value: fmtK(cur?.short_reach) },
            { icon: FileText, label: "Posts",   value: fmtK(cur?.short_posts) },
          ]}
          deltaPct={igDelta}
          sparkValues={all.slice(-8).map(r => r.short_followers)}
          noData={!cur?.short_followers}
        />
        <ChannelCard
          icon={Youtube} title="YouTube" color="#f87171"
          audience={fmtK(cur?.yt_subscribers)} audienceLabel="Suscriptores"
          rows={[
            { icon: Eye,      label: "Vistas",  value: fmtK(cur?.yt_views || cur?.yt_monthly_audience) },
            { icon: FileText, label: "Videos",  value: fmtK(cur?.yt_videos) },
          ]}
          deltaPct={ytDelta}
          sparkValues={all.slice(-8).map(r => r.yt_subscribers)}
          noData={!cur?.yt_subscribers}
        />
        <ChannelCard
          icon={Mail} title="Email" color="#4ade80"
          audience={fmtK(cur?.email_subscribers)} audienceLabel="Suscriptores totales"
          rows={[
            { icon: Eye, label: "Nuevos subs", value: fmtK(cur?.email_new_subscribers) },
          ]}
          deltaPct={emailDelta}
          sparkValues={all.slice(-8).map(r => r.email_subscribers)}
          noData={!cur?.email_subscribers}
        />
      </div>

      {/* Índice de crecimiento comparado entre canales */}
      <GrowthIndexChart reports={all} />
    </div>
  )
}

function EducateTab({ cur, prev, all }: { cur: MonthlyReport | null; prev: MonthlyReport | null; all: MonthlyReport[] }) {
  const d = {
    posts:  pctDelta(cur?.short_posts            ?? 0, prev?.short_posts            ?? 0),
    ytv:    pctDelta(cur?.yt_videos              ?? 0, prev?.yt_videos              ?? 0),
    email:  pctDelta(cur?.email_subscribers      ?? 0, prev?.email_subscribers      ?? 0),
    enew:   pctDelta(cur?.email_new_subscribers  ?? 0, prev?.email_new_subscribers  ?? 0),
  }
  const status = stageStatus(d.posts)
  return (
    <div className="space-y-5">
      <div className="pb-4 border-b border-foreground/[0.07]">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-[22px] font-bold text-foreground">Educate</h2>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.className)}>{status.label}</span>
        </div>
        <p className="text-[13px] text-foreground/50">Construir autoridad — convertir atención en audiencia comprometida.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Posts IG"    value={fmtK(cur?.short_posts)}           pct={d.posts} noData={!cur?.short_posts} />
        <MetricCard label="Videos YT"   value={fmtK(cur?.yt_videos)}             pct={d.ytv}   noData={!cur?.yt_videos} />
        <MetricCard label="Email subs"  value={fmtK(cur?.email_subscribers)}     pct={d.email} noData={!cur?.email_subscribers} />
        <MetricCard label="Email nuevos" value={fmtK(cur?.email_new_subscribers)} pct={d.enew}  noData={!cur?.email_new_subscribers} />
      </div>
      <PostsVsFollowers reports={all} />
    </div>
  )
}

function InviteTab({ cur, prev, all }: { cur: MonthlyReport | null; prev: MonthlyReport | null; all: MonthlyReport[] }) {
  const d = {
    clients: pctDelta(cur?.new_clients    ?? 0, prev?.new_clients    ?? 0),
    cash:    pctDelta(cur?.cash_collected ?? 0, prev?.cash_collected ?? 0),
    mrr:     pctDelta(cur?.mrr            ?? 0, prev?.mrr            ?? 0),
    rev:     pctDelta(cur?.total_revenue  ?? 0, prev?.total_revenue  ?? 0),
  }
  const status = stageStatus(d.cash)
  return (
    <div className="space-y-4">
      <div className="pb-4 border-b border-foreground/[0.07]">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-[22px] font-bold text-foreground">Invite</h2>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.className)}>{status.label}</span>
        </div>
        <p className="text-[13px] text-foreground/50">Conversión eficiente — convertir audiencia pre-calentada en clientes.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-stretch">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Nuevos clientes" value={fmtK(cur?.new_clients)}        pct={d.clients} noData={!cur?.new_clients} />
          <MetricCard label="Cash collected"  value={fmtMoney(cur?.cash_collected)} pct={d.cash}    noData={!cur?.cash_collected} />
          <MetricCard label="MRR"             value={fmtMoney(cur?.mrr)}            pct={d.mrr}     noData={!cur?.mrr} />
          <MetricCard label="Revenue total"   value={fmtMoney(cur?.total_revenue)}  pct={d.rev}     noData={!cur?.total_revenue} />
        </div>
        <MiniChart data={all} dataKey="cash_collected" color="#ffde21" label="Cash collected — últimos 8 meses" className="min-h-[220px]" />
      </div>

      {/* Sales: el embudo de conversión vive dentro de Invite */}
      <div className="pt-4 mt-2 border-t border-foreground/[0.07]">
        <SalesView />
      </div>
    </div>
  )
}

function TransformTab({ cur, prev, all }: { cur: MonthlyReport | null; prev: MonthlyReport | null; all: MonthlyReport[] }) {
  const d = {
    mrr: pctDelta(cur?.mrr      ?? 0, prev?.mrr      ?? 0),
    ad:  pctDelta(cur?.ad_spend ?? 0, prev?.ad_spend ?? 0),
  }
  const curRoas  = cur?.ad_spend  ? (cur.cash_collected  / cur.ad_spend)  : null
  const prevRoas = prev?.ad_spend ? (prev.cash_collected / prev.ad_spend) : null
  const status = stageStatus(d.mrr)
  return (
    <div className="space-y-4">
      <div className="pb-4 border-b border-foreground/[0.07]">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-[22px] font-bold text-foreground">Transform</h2>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.className)}>{status.label}</span>
        </div>
        <p className="text-[13px] text-foreground/50">Retención y eficiencia — sostener y escalar lo que funciona.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-stretch">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="MRR"             value={fmtMoney(cur?.mrr)}      pct={d.mrr} noData={!cur?.mrr} />
          <MetricCard label="Gasto en ads"    value={fmtMoney(cur?.ad_spend)} pct={d.ad}  noData={!cur?.ad_spend} />
          <MetricCard label="ROAS"            value={curRoas ? `${curRoas.toFixed(1)}x` : "—"} pct={pctDelta(curRoas ?? 0, prevRoas ?? 0)} noData={!curRoas} />
          <MetricCard label="Meses con datos" value={all.filter(r => r.cash_collected > 0).length.toString()} pct={null} />
        </div>
        <MiniChart data={all} dataKey="mrr" color="#38bdf8" label="MRR — últimos 8 meses" className="min-h-[220px]" />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "fascinate", label: "Fascinate" },
  { id: "educate",   label: "Educate"   },
  { id: "invite",    label: "Invite"    },
  { id: "transform", label: "Transform" },
] as const
type TabId = typeof TABS[number]["id"]

export function PerformanceView() {
  const [tab, setTab] = useState<TabId>("fascinate")
  const { reports, loading } = useMonthlyReports()
  const selectedMonth = useSelectedMonth()

  const month = (() => {
    const m = String(selectedMonth ?? "")
    if (/^\d{4}-\d{2}$/.test(m))     return m
    if (/^\d{4}-\d{2}-\d{2}$/.test(m)) return m.slice(0, 7)
    return reports[reports.length - 1]?.month ?? ""
  })()

  const idx  = reports.findIndex(r => r.month === month)
  const cur  = idx >= 0 ? reports[idx]     : (reports[reports.length - 1] ?? null)
  const prev = idx >= 1 ? reports[idx - 1] : (reports[reports.length - 2] ?? null)

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-[22px] font-bold text-foreground leading-tight">Performance</h1>
        <p className="text-[13px] text-foreground/50 mt-0.5">Tu pulso a través de las 4 etapas del modelo</p>
      </div>

      {/* Tab bar — underline style */}
      <div className="border-b border-foreground/[0.07]">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative pb-3 px-4 text-[14px] font-semibold transition-colors",
                tab === t.id
                  ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#ffde21] after:rounded-full"
                  : "text-foreground/40 hover:text-foreground/70"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Sk key={i} className="h-[100px] rounded-[14px]" />)}
          </div>
          <Sk className="h-[160px] rounded-[14px]" />
        </div>
      ) : (
        <>
          {tab === "fascinate" && <FascinateTab cur={cur} prev={prev} all={reports} />}
          {tab === "educate"   && <EducateTab   cur={cur} prev={prev} all={reports} />}
          {tab === "invite"    && <InviteTab    cur={cur} prev={prev} all={reports} />}
          {tab === "transform" && <TransformTab cur={cur} prev={prev} all={reports} />}
        </>
      )}
    </div>
  )
}
