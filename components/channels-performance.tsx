"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabaseClient"
import { useSelectedMonth } from "@/components/dashboard-layout"

type MonthlyReportChannels = {
  short_followers: number | null
  short_reach: number | null
  short_posts: number | null
  confidence_short: number | null

  yt_subscribers: number | null
  yt_monthly_audience: number | null
  yt_views: number | null
  yt_watch_time: number | null
  yt_new_subscribers: number | null
  yt_videos: number | null
  confidence_long: number | null

  email_subscribers: number | null
  email_new_subscribers: number | null
  confidence_email: number | null
}

function fmtNumber(v: number | null | undefined) {
  if (v === null || v === undefined) return "—"
  return v.toLocaleString()
}

function fmtShortK(v: number | null | undefined) {
  if (v === null || v === undefined) return "—"
  // Match the previous UI feel (K/M) but using real numbers
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return v.toLocaleString()
}

function fmtWatchTimeHours(v: number | null | undefined) {
  if (v === null || v === undefined) return "—"
  // Your schema says numeric, assume hours (as per UI "h")
  return `${Number(v).toLocaleString()}h`
}

function fmtScore(v: number | null | undefined) {
  if (v === null || v === undefined) return "—"
  return `${v}/10`
}

export function ChannelsPerformance() {
  const ctxMonth = useSelectedMonth()
  const selectedMonth = ctxMonth ?? "2025-12"

  const [report, setReport] = useState<MonthlyReportChannels | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        if (mounted) {
          setLoading(true)
          setError(null)
        }

        const supabase = createClient()

        // 1) current user
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser()

        if (userErr) throw userErr
        if (!user) throw new Error("No session")

        // 2) client_id
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single()

        if (pErr) throw pErr
        if (!profile?.client_id) throw new Error("No encontramos tu client_id en profiles")

        // 3) month value (YYYY-MM => YYYY-MM-01)
        const monthValue = /^\d{4}-\d{2}$/.test(selectedMonth) ? `${selectedMonth}-01` : selectedMonth

        // 4) fetch report for that month
        const { data, error: rErr } = await supabase
          .from("monthly_reports")
          .select(
            [
              "short_followers",
              "short_reach",
              "short_posts",
              "confidence_short",
              "yt_subscribers",
              "yt_monthly_audience",
              "yt_views",
              "yt_watch_time",
              "yt_new_subscribers",
              "yt_videos",
              "confidence_long",
              "email_subscribers",
              "email_new_subscribers",
              "confidence_email",
            ].join(",")
          )
          .eq("client_id", profile.client_id)
          .eq("month", monthValue)
          .maybeSingle()

        if (rErr) throw rErr

        if (mounted) {
          setReport((data ?? null) as MonthlyReportChannels | null)
          setLoading(false)
        }
      } catch (e: any) {
        if (mounted) {
          setReport(null)
          setLoading(false)
          setError(e?.message ?? "Error cargando métricas")
        }
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [selectedMonth])

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Rendimiento por canal</h2>

      {loading && <p className="mb-4 text-white/60">Cargando métricas del mes…</p>}
      {error && <p className="mb-4 text-red-400">{error}</p>}
      {!loading && !error && !report && (
        <p className="mb-4 text-white/60">No hay reporte cargado para este mes.</p>
      )}

      <div className="space-y-6">
        {/* Short-form Channel */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-medium">Canal de formato corto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {fmtShortK(report?.short_followers)}
                </div>
                <div className="text-sm text-muted-foreground">Seguidores</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtShortK(report?.short_reach)}</div>
                <div className="text-sm text-muted-foreground">Alcance</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtNumber(report?.short_posts)}</div>
                <div className="text-sm text-muted-foreground">Publicaciones</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtScore(report?.confidence_short)}</div>
                <div className="text-sm text-muted-foreground">Puntaje de confianza</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Long-form (YouTube) */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-medium">Formato largo (YouTube)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtShortK(report?.yt_subscribers)}</div>
                <div className="text-sm text-muted-foreground">Suscriptores</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtShortK(report?.yt_monthly_audience)}</div>
                <div className="text-sm text-muted-foreground">Audiencia mensual</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtShortK(report?.yt_views)}</div>
                <div className="text-sm text-muted-foreground">Vistas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtWatchTimeHours(report?.yt_watch_time)}</div>
                <div className="text-sm text-muted-foreground">Tiempo de visualización</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtNumber(report?.yt_new_subscribers)}</div>
                <div className="text-sm text-muted-foreground">Nuevos suscriptores</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtNumber(report?.yt_videos)}</div>
                <div className="text-sm text-muted-foreground">Videos publicados</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtScore(report?.confidence_long)}</div>
                <div className="text-sm text-muted-foreground">Puntaje de confianza</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Marketing */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-medium">Marketing por email</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtNumber(report?.email_subscribers)}</div>
                <div className="text-sm text-muted-foreground">Suscriptores totales</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtNumber(report?.email_new_subscribers)}</div>
                <div className="text-sm text-muted-foreground">Nuevos suscriptores</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{fmtScore(report?.confidence_email)}</div>
                <div className="text-sm text-muted-foreground">Puntaje de confianza</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
