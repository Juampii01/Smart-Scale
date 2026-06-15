"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useMonthlyReports, type MonthlyReport } from "@/hooks/use-monthly-reports"
import { useSelectedMonth } from "@/components/layout/dashboard-layout"
import { Sk } from "@/components/ui/skeleton"
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
} from "recharts"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtK(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
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

function fmtMonth(m: string) {
  const [y, mo] = m.split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${names[parseInt(mo, 10) - 1]} '${y.slice(2)}`
}

function delta(cur: number, prev: number) {
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}

function stageStatus(pct: number | null): { label: string; className: string } {
  if (pct === null) return { label: "Sin datos", className: "bg-foreground/[0.06] text-foreground/40" }
  if (pct >= 5)     return { label: "Saludable",  className: "bg-success-soft text-success" }
  if (pct >= -5)    return { label: "Estable",    className: "bg-foreground/[0.06] text-foreground/60" }
  return               { label: "Atención",    className: "bg-danger-soft text-danger" }
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, pct, noData,
}: {
  label: string
  value: string
  pct: number | null
  noData?: boolean
}) {
  const up = (pct ?? 0) > 0
  return (
    <div className="rounded-[14px] border border-foreground/[0.07] bg-card p-4 flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-foreground/40">{label}</p>
      <p className={cn(
        "text-[28px] font-bold tabular-nums leading-none",
        noData ? "text-foreground/25" : "text-foreground"
      )}>
        {value}
      </p>
      {pct !== null && (
        <p className={cn(
          "text-[12px] font-semibold",
          up ? "text-success" : "text-danger"
        )}>
          {up ? "+" : ""}{pct.toFixed(1)}%
        </p>
      )}
    </div>
  )
}

// ─── Mini trend chart ─────────────────────────────────────────────────────────

function MiniChart({
  data, dataKey, color, label,
}: {
  data: MonthlyReport[]
  dataKey: keyof MonthlyReport
  color: string
  label: string
}) {
  const points = data.slice(-8).map(r => ({
    month: fmtMonth(r.month),
    value: Number(r[dataKey]) || 0,
  }))
  if (points.every(p => p.value === 0)) return null

  return (
    <div className="rounded-[14px] border border-foreground/[0.07] bg-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-foreground/40 mb-4">{label}</p>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 700 }}
          />
          <Area type="monotone" dataKey="value" name={label} stroke={color} strokeWidth={2}
            fill={`url(#grad-${dataKey})`} dot={false} activeDot={{ r: 4, fill: color }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Tab content ──────────────────────────────────────────────────────────────

const TABS = [
  { id: "fascinate", label: "Fascinate" },
  { id: "educate",   label: "Educate"   },
  { id: "invite",    label: "Invite"    },
  { id: "transform", label: "Transform" },
] as const
type TabId = typeof TABS[number]["id"]

function FascinateTab({ cur, prev, all }: { cur: MonthlyReport | null; prev: MonthlyReport | null; all: MonthlyReport[] }) {
  const d = {
    ig:    delta(cur?.short_followers ?? 0, prev?.short_followers ?? 0),
    reach: delta(cur?.short_reach     ?? 0, prev?.short_reach     ?? 0),
    yt:    delta(cur?.yt_subscribers  ?? 0, prev?.yt_subscribers  ?? 0),
    ytv:   delta(cur?.yt_views        ?? 0, prev?.yt_views        ?? 0),
  }
  const status = stageStatus(d.ig)
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-[22px] font-bold text-foreground">Fascinate</h2>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.className)}>{status.label}</span>
        </div>
        <p className="text-[13px] text-foreground/50">Captar atención — crecer la audiencia que alimenta el motor.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Seguidores IG"   value={fmtK(cur?.short_followers)}  pct={d.ig}    noData={!cur?.short_followers} />
        <MetricCard label="Alcance IG"      value={fmtK(cur?.short_reach)}      pct={d.reach} noData={!cur?.short_reach} />
        <MetricCard label="Suscriptores YT" value={fmtK(cur?.yt_subscribers)}   pct={d.yt}    noData={!cur?.yt_subscribers} />
        <MetricCard label="Vistas YT"       value={fmtK(cur?.yt_views)}         pct={d.ytv}   noData={!cur?.yt_views} />
      </div>
      <MiniChart data={all} dataKey="short_followers" color="#818cf8" label="Seguidores IG — últimos 8 meses" />
    </div>
  )
}

function EducateTab({ cur, prev, all }: { cur: MonthlyReport | null; prev: MonthlyReport | null; all: MonthlyReport[] }) {
  const d = {
    posts:  delta(cur?.short_posts      ?? 0, prev?.short_posts      ?? 0),
    ytv:    delta(cur?.yt_videos        ?? 0, prev?.yt_videos        ?? 0),
    email:  delta(cur?.email_subscribers ?? 0, prev?.email_subscribers ?? 0),
  }
  const status = stageStatus(d.posts)
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-[22px] font-bold text-foreground">Educate</h2>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.className)}>{status.label}</span>
        </div>
        <p className="text-[13px] text-foreground/50">Construir autoridad — convertir atención en audiencia comprometida.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Posts IG"         value={fmtK(cur?.short_posts)}       pct={d.posts} noData={!cur?.short_posts} />
        <MetricCard label="Videos YT"        value={fmtK(cur?.yt_videos)}         pct={d.ytv}   noData={!cur?.yt_videos} />
        <MetricCard label="Suscriptores Email" value={fmtK(cur?.email_subscribers)} pct={d.email} noData={!cur?.email_subscribers} />
        <MetricCard label="Canales activos"  value={[cur?.short_posts, cur?.yt_videos, cur?.email_subscribers].filter(Boolean).length.toString()} pct={null} />
      </div>
      <MiniChart data={all} dataKey="short_posts" color="#4ade80" label="Posts IG — últimos 8 meses" />
    </div>
  )
}

function InviteTab({ cur, prev, all }: { cur: MonthlyReport | null; prev: MonthlyReport | null; all: MonthlyReport[] }) {
  const d = {
    clients: delta(cur?.new_clients    ?? 0, prev?.new_clients    ?? 0),
    cash:    delta(cur?.cash_collected ?? 0, prev?.cash_collected ?? 0),
    mrr:     delta(cur?.mrr            ?? 0, prev?.mrr            ?? 0),
    rev:     delta(cur?.total_revenue  ?? 0, prev?.total_revenue  ?? 0),
  }
  const status = stageStatus(d.cash)
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-[22px] font-bold text-foreground">Invite</h2>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.className)}>{status.label}</span>
        </div>
        <p className="text-[13px] text-foreground/50">Conversión eficiente — convertir audiencia pre-calentada en clientes.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Nuevos clientes"  value={fmtK(cur?.new_clients)}    pct={d.clients} noData={!cur?.new_clients} />
        <MetricCard label="Cash collected"   value={fmtMoney(cur?.cash_collected)} pct={d.cash} noData={!cur?.cash_collected} />
        <MetricCard label="MRR"              value={fmtMoney(cur?.mrr)}        pct={d.mrr}  noData={!cur?.mrr} />
        <MetricCard label="Revenue total"    value={fmtMoney(cur?.total_revenue)} pct={d.rev} noData={!cur?.total_revenue} />
      </div>
      <MiniChart data={all} dataKey="cash_collected" color="#ffde21" label="Cash collected — últimos 8 meses" />
    </div>
  )
}

function TransformTab({ cur, prev, all }: { cur: MonthlyReport | null; prev: MonthlyReport | null; all: MonthlyReport[] }) {
  const d = {
    mrr:   delta(cur?.mrr      ?? 0, prev?.mrr      ?? 0),
    ad:    delta(cur?.ad_spend ?? 0, prev?.ad_spend ?? 0),
  }
  const roas = cur?.ad_spend && cur?.cash_collected
    ? (cur.cash_collected / cur.ad_spend).toFixed(1) + "x"
    : "—"
  const prevRoas = prev?.ad_spend && prev?.cash_collected
    ? prev.cash_collected / prev.ad_spend
    : null
  const curRoas  = cur?.ad_spend && cur?.cash_collected
    ? cur.cash_collected / cur.ad_spend
    : null
  const roasDelta = delta(curRoas ?? 0, prevRoas ?? 0)

  const status = stageStatus(d.mrr)
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-[22px] font-bold text-foreground">Transform</h2>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.className)}>{status.label}</span>
        </div>
        <p className="text-[13px] text-foreground/50">Retención y eficiencia — sostener y escalar lo que funciona.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="MRR"         value={fmtMoney(cur?.mrr)}      pct={d.mrr} noData={!cur?.mrr} />
        <MetricCard label="Gasto en ads" value={fmtMoney(cur?.ad_spend)} pct={d.ad}  noData={!cur?.ad_spend} />
        <MetricCard label="ROAS"        value={roas}                     pct={roasDelta} noData={roas === "—"} />
        <MetricCard label="Meses con datos" value={all.filter(r => r.cash_collected > 0).length.toString()} pct={null} />
      </div>
      <MiniChart data={all} dataKey="mrr" color="#38bdf8" label="MRR — últimos 8 meses" />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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
  const cur  = idx >= 0 ? reports[idx]     : reports[reports.length - 1] ?? null
  const prev = idx >= 1 ? reports[idx - 1] : reports[reports.length - 2] ?? null

  return (
    <div className="max-w-[860px] space-y-6 pb-10">
      {/* Header */}
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

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <Sk key={i} className="h-[100px] rounded-[14px]" />)}
          </div>
          <Sk className="h-[160px] rounded-[14px]" />
        </div>
      ) : (
        <>
          {tab === "fascinate"  && <FascinateTab  cur={cur} prev={prev} all={reports} />}
          {tab === "educate"    && <EducateTab    cur={cur} prev={prev} all={reports} />}
          {tab === "invite"     && <InviteTab     cur={cur} prev={prev} all={reports} />}
          {tab === "transform"  && <TransformTab  cur={cur} prev={prev} all={reports} />}
        </>
      )}
    </div>
  )
}
