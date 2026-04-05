"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useSelectedMonth, useActiveClient } from "@/components/layout/dashboard-layout"
import { useMarkPageReady } from "@/hooks/use-mark-page-ready"
import { useMinLoading } from "@/hooks/use-min-loading"
import { ChannelBlockSkeleton, SectionHeaderSkeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Users, Eye, FileText } from "lucide-react"

type ReportRow = {
  month: string
  short_followers: number | null
  short_reach: number | null
  short_posts: number | null
  yt_subscribers: number | null
  yt_views: number | null
  yt_monthly_audience: number | null
  yt_videos: number | null
  email_subscribers: number | null
  email_new_subscribers: number | null
}

function toMonthDate(month: string) {
  if (/^\d{4}-\d{2}$/.test(month)) return `${month}-01`
  return month
}

function prevMonthYYYYMM(monthYYYYMM: string) {
  const [y, m] = monthYYYYMM.split("-").map((x) => Number(x))
  const d = new Date(y, m - 1, 1)
  d.setMonth(d.getMonth() - 1)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${yy}-${mm}`
}

function fmtCompact(v: number | null | undefined) {
  if (v === null || v === undefined) return "—"
  const n = Number(v)
  if (Number.isNaN(n)) return "—"
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function computeTrend(current: number | null | undefined, prev: number | null | undefined) {
  const c = current ?? null
  const p = prev ?? null
  if (c === null || p === null) return { trend: "up" as const, trendValue: "—" }
  if (p === 0) return { trend: c >= 0 ? ("up" as const) : ("down" as const), trendValue: "—" }
  const diff = (c - p) / Math.abs(p)
  const pct = (diff * 100).toFixed(1)
  return {
    trend: diff >= 0 ? ("up" as const) : ("down" as const),
    trendValue: `${diff >= 0 ? "+" : ""}${pct}%`,
  }
}

function StatRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <span className="text-sm font-semibold text-white tabular-nums">{value}</span>
    </div>
  )
}

function ChannelCard({
  title,
  data,
  hideContent,
}: {
  title: string
  data: { audience: string; reach: string; content: string; trend: "up" | "down"; trendValue: string }
  hideContent?: boolean
}) {
  const isUp = data.trend === "up"

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] transition-all duration-200 hover:border-white/15">
      <div className={`h-[2px] w-full ${isUp ? "bg-emerald-500/60" : "bg-red-500/60"}`} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.03),transparent_60%)]" />
      <div className="relative p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-white/80">{title}</p>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
            isUp
              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
              : "bg-red-500/10 text-red-400 ring-red-500/20"
          }`}>
            {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {data.trendValue}
          </span>
        </div>
        <div className="space-y-0">
          <StatRow icon={Users} label="Audiencia total" value={data.audience} />
          <StatRow icon={Eye} label="Alcance / Vistas" value={data.reach} />
          {!hideContent && <StatRow icon={FileText} label="Contenido publicado" value={data.content} />}
        </div>
      </div>
    </div>
  )
}

const TABS = ["Todos", "Formato corto", "Formato largo", "Email"] as const
type Tab = typeof TABS[number]

export function ChannelsView() {
  const ctxMonth = useSelectedMonth()
  const activeClientId = useActiveClient()
  const selectedMonth = ctxMonth ?? "2025-12"
  const [activeTab, setActiveTab] = useState<Tab>("Todos")

  const [current, setCurrent] = useState<ReportRow | null>(null)
  const [prev, setPrev] = useState<ReportRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const showSkeleton = useMinLoading(loading)
  useMarkPageReady(!showSkeleton)

  const monthYYYYMM = useMemo(() => {
    if (/^\d{4}-\d{2}$/.test(selectedMonth)) return selectedMonth
    if (/^\d{4}-\d{2}-\d{2}$/.test(selectedMonth)) return selectedMonth.slice(0, 7)
    return "2025-12"
  }, [selectedMonth])

  useEffect(() => {
    let mounted = true
    if (!activeClientId) {
      setLoading(true)
      setCurrent(null)
      setPrev(null)
      return () => { mounted = false }
    }
    async function load() {
      try {
        if (mounted) { setLoading(true); setError(null) }
        const supabase = createClient()
        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!user) throw new Error("No session")
        const monthValue = toMonthDate(monthYYYYMM)
        const prevMonthValue = toMonthDate(prevMonthYYYYMM(monthYYYYMM))
        const selectFields = "month,short_followers,short_reach,short_posts,yt_subscribers,yt_views,yt_monthly_audience,yt_videos,email_subscribers,email_new_subscribers"
        const { data: curRow, error: cErr } = await supabase.from("monthly_reports").select(selectFields).eq("client_id", activeClientId).eq("month", monthValue).maybeSingle()
        if (cErr) throw cErr
        const { data: prevRow, error: prErr } = await supabase.from("monthly_reports").select(selectFields).eq("client_id", activeClientId).eq("month", prevMonthValue).maybeSingle()
        if (prErr) throw prErr
        if (mounted) {
          setCurrent((curRow ?? null) as ReportRow | null)
          setPrev((prevRow ?? null) as ReportRow | null)
          setLoading(false)
        }
      } catch (e: any) {
        if (mounted) { setCurrent(null); setPrev(null); setLoading(false); setError(e?.message ?? "Error cargando métricas") }
      }
    }
    load()
    return () => { mounted = false }
  }, [monthYYYYMM, activeClientId])

  const shortTrend = computeTrend(current?.short_followers, prev?.short_followers)
  const longTrend = computeTrend(current?.yt_subscribers, prev?.yt_subscribers)
  const emailTrend = computeTrend(current?.email_subscribers, prev?.email_subscribers)

  const shortFormData = { audience: fmtCompact(current?.short_followers), reach: fmtCompact(current?.short_reach), content: fmtCompact(current?.short_posts), trend: shortTrend.trend, trendValue: shortTrend.trendValue }
  const longFormData = { audience: fmtCompact(current?.yt_subscribers), reach: fmtCompact(current?.yt_views ?? current?.yt_monthly_audience), content: fmtCompact(current?.yt_videos), trend: longTrend.trend, trendValue: longTrend.trendValue }
  const emailData = { audience: fmtCompact(current?.email_subscribers), reach: fmtCompact(current?.email_new_subscribers), content: "—", trend: emailTrend.trend, trendValue: emailTrend.trendValue }

  if (showSkeleton) {
    return (
      <div className="space-y-6">
        <SectionHeaderSkeleton />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <ChannelBlockSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-white/70">Rendimiento por Canal</h1>
        </div>
        <p suppressHydrationWarning className="text-xs text-white/30 ml-[18px]">
          Señales de cada canal · {monthYYYYMM}
        </p>
      </div>

      {loading && <p className="text-white/40 text-sm">Cargando datos…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && !current && <p className="text-white/40 text-sm">No hay reporte cargado para este mes.</p>}

      {/* Tab selector */}
      <div className="inline-flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-1 gap-0.5">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
              activeTab === tab ? "bg-[#ffde21] text-black shadow-sm" : "text-white/45 hover:text-white/70"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={`grid gap-4 ${activeTab === "Todos" ? "md:grid-cols-2 lg:grid-cols-3" : "max-w-md"}`}>
        {(activeTab === "Todos" || activeTab === "Formato corto") && (
          <ChannelCard title="Formato corto" data={shortFormData} />
        )}
        {(activeTab === "Todos" || activeTab === "Formato largo") && (
          <ChannelCard title="Formato largo (YouTube)" data={longFormData} />
        )}
        {(activeTab === "Todos" || activeTab === "Email") && (
          <ChannelCard title="Marketing por email" data={emailData} hideContent />
        )}
      </div>
    </div>
  )
}
