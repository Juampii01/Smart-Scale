"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabaseClient"
import { useSelectedMonth, useActiveClient } from "@/components/dashboard-layout"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Users, Eye, FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ReportRow = {
  month: string
  // short
  short_followers: number | null
  short_reach: number | null
  short_posts: number | null
  // youtube
  yt_subscribers: number | null
  yt_views: number | null
  yt_monthly_audience: number | null
  yt_videos: number | null
  // email
  email_subscribers: number | null
  email_new_subscribers: number | null
}

function toMonthDate(month: string) {
  // Accept YYYY-MM or YYYY-MM-DD
  if (/^\d{4}-\d{2}$/.test(month)) return `${month}-01`
  return month
}

function prevMonthYYYYMM(monthYYYYMM: string) {
  // monthYYYYMM is "YYYY-MM"
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

function ChannelCard({
  title,
  data,
  hideContent,
}: {
  title: string
  data: { audience: string; reach: string; content: string; trend: "up" | "down"; trendValue: string }
  hideContent?: boolean
}) {
  const TrendIcon = data.trend === "up" ? TrendingUp : TrendingDown
  const trendColor = data.trend === "up" ? "text-emerald-400" : "text-red-400"

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base font-medium">
          {title}
          <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {data.trendValue}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Users className="h-4 w-4" />
            Audiencia total
          </div>
          <div className="text-lg font-semibold text-white">{data.audience}</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Eye className="h-4 w-4" />
            Alcance / Vistas
          </div>
          <div className="text-lg font-semibold text-white">{data.reach}</div>
        </div>
        {!hideContent && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <FileText className="h-4 w-4" />
              Contenido publicado
            </div>
            <div className="text-lg font-semibold text-white">{data.content}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ChannelsView() {
  const ctxMonth = useSelectedMonth()
  const activeClientId = useActiveClient()
  const selectedMonth = ctxMonth ?? "2025-12"

  const [current, setCurrent] = useState<ReportRow | null>(null)
  const [prev, setPrev] = useState<ReportRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const monthYYYYMM = useMemo(() => {
    // Normalize to YYYY-MM for prev-month math
    if (/^\d{4}-\d{2}$/.test(selectedMonth)) return selectedMonth
    if (/^\d{4}-\d{2}-\d{2}$/.test(selectedMonth)) return selectedMonth.slice(0, 7)
    return "2025-12"
  }, [selectedMonth])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        if (mounted) {
          setLoading(true)
          setError(null)
        }

        const supabase = createClient()

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser()

        if (userErr) throw userErr
        if (!user) throw new Error("No session")

        const clientId = activeClientId
        if (!clientId) throw new Error("No hay cliente activo seleccionado")

        const monthValue = toMonthDate(monthYYYYMM)
        const prevMonthValue = toMonthDate(prevMonthYYYYMM(monthYYYYMM))

        const selectFields =
          "month,short_followers,short_reach,short_posts,yt_subscribers,yt_views,yt_monthly_audience,yt_videos,email_subscribers,email_new_subscribers"

        const { data: curRow, error: cErr } = await supabase
          .from("monthly_reports")
          .select(selectFields)
          .eq("client_id", clientId)
          .eq("month", monthValue)
          .maybeSingle()

        if (cErr) throw cErr

        const { data: prevRow, error: prErr } = await supabase
          .from("monthly_reports")
          .select(selectFields)
          .eq("client_id", clientId)
          .eq("month", prevMonthValue)
          .maybeSingle()

        if (prErr) throw prErr

        if (mounted) {
          setCurrent((curRow ?? null) as ReportRow | null)
          setPrev((prevRow ?? null) as ReportRow | null)
          setLoading(false)
        }
      } catch (e: any) {
        if (mounted) {
          setCurrent(null)
          setPrev(null)
          setLoading(false)
          setError(e?.message ?? "Error cargando métricas")
        }
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [monthYYYYMM, activeClientId])

  const shortTrend = computeTrend(current?.short_followers, prev?.short_followers)
  const longTrend = computeTrend(current?.yt_subscribers, prev?.yt_subscribers)
  const emailTrend = computeTrend(current?.email_subscribers, prev?.email_subscribers)

  const shortFormData = {
    audience: fmtCompact(current?.short_followers),
    reach: fmtCompact(current?.short_reach),
    content: fmtCompact(current?.short_posts),
    trend: shortTrend.trend,
    trendValue: shortTrend.trendValue,
  }

  const longFormData = {
    audience: fmtCompact(current?.yt_subscribers),
    // For YouTube, we treat Reach/Views as views (monthly audience is also available)
    reach: fmtCompact(current?.yt_views ?? current?.yt_monthly_audience),
    content: fmtCompact(current?.yt_videos),
    trend: longTrend.trend,
    trendValue: longTrend.trendValue,
  }

  const emailData = {
    audience: fmtCompact(current?.email_subscribers),
    // Best available "reach" proxy in schema is new subs
    reach: fmtCompact(current?.email_new_subscribers),
    // No "emails sent" field in schema; we keep this as dash
    content: "—",
    trend: emailTrend.trend,
    trendValue: emailTrend.trendValue,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Rendimiento por canal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Señales rápidas de cómo cada canal apoya el negocio</p>
        <p suppressHydrationWarning className="mt-1 text-xs text-white/50">Mes seleccionado: {monthYYYYMM}</p>
      </div>

      {loading && <p className="text-white/60">Cargando métricas del mes…</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && !error && !current && (
        <p className="text-white/60">No hay reporte cargado para este mes.</p>
      )}

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-4">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="short">Formato corto</TabsTrigger>
          <TabsTrigger value="long">Formato largo</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ChannelCard title="Contenido de formato corto" data={shortFormData} />
            <ChannelCard title="Formato largo (YouTube)" data={longFormData} />
            <ChannelCard title="Marketing por email" data={emailData} hideContent />
          </div>
        </TabsContent>

        <TabsContent value="short" className="mt-6">
          <ChannelCard title="Contenido de formato corto" data={shortFormData} />
        </TabsContent>

        <TabsContent value="long" className="mt-6">
          <ChannelCard title="Formato largo (YouTube)" data={longFormData} />
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <ChannelCard title="Marketing por email" data={emailData} hideContent />
        </TabsContent>
      </Tabs>
    </div>
  )
}
