"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingDown, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabaseClient"
import { useSelectedMonth, useActiveClient } from "@/components/dashboard-layout"

export function BusinessKPIs({ selectedMonth }: { selectedMonth?: string }) {
  const [report, setReport] = useState<any | null>(null)
  const [prevReport, setPrevReport] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ctxMonth = useSelectedMonth()
  const activeClientId = useActiveClient()
  const effectiveMonth = selectedMonth ?? ctxMonth ?? "2025-12"

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
        if (!user) {
          if (mounted) {
            setReport(null)
            setPrevReport(null)
            setLoading(false)
            setError("No hay sesión activa. Volvé a iniciar sesión.")
          }
          return
        }

        const clientId = activeClientId
        if (!clientId) {
          if (mounted) {
            setReport(null)
            setPrevReport(null)
            setLoading(false)
            setError("No hay cliente activo seleccionado.")
          }
          return
        }

        let monthValue: string | null = null

        // Accept YYYY-MM => YYYY-MM-01
        if (/^\d{4}-\d{2}$/.test(effectiveMonth)) {
          monthValue = `${effectiveMonth}-01`
        }

        // Accept YYYY-MM-DD as-is
        if (!monthValue && /^\d{4}-\d{2}-\d{2}$/.test(effectiveMonth)) {
          monthValue = effectiveMonth
        }

        if (!monthValue) {
          if (mounted) {
            setReport(null)
            setPrevReport(null)
            setLoading(false)
            setError(`Mes inválido: ${effectiveMonth}`)
          }
          return
        }

        // 4) fetch the current month AND previous month (latest 2 rows <= selected month)
        const { data: rows, error: rErr } = await supabase
          .from("monthly_reports")
          .select(
            "total_revenue,cash_collected,mrr,ad_spend,short_followers,new_clients,month,client_id"
          )
          .eq("client_id", clientId)
          .lte("month", monthValue)
          .order("month", { ascending: false })
          .limit(2)

        if (rErr) throw rErr

        const current = rows?.[0] ?? null
        const previous = rows?.[1] ?? null

        // If the newest row we found isn't exactly the selected month, treat as missing for this month
        const currentMonthStr = current?.month ? String(current.month).slice(0, 10) : null
        if (current && currentMonthStr !== monthValue) {
          if (mounted) {
            setReport(null)
            setPrevReport(previous)
            setLoading(false)
          }
          return
        }

        if (mounted) {
          setReport(current)
          setPrevReport(previous)
          setLoading(false)
        }
      } catch (e: any) {
        if (mounted) {
          setReport(null)
          setPrevReport(null)
          setLoading(false)
          setError(e?.message ?? "Error cargando métricas")
        }
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [effectiveMonth, activeClientId])

  const formatMoney = (v: any) => {
    if (v === null || v === undefined || v === "") return "—"
    const n = typeof v === "number" ? v : Number(v)
    if (!Number.isFinite(n)) return "—"
    return `$${n.toLocaleString()}`
  }

  const formatNumber = (v: any) => {
    if (v === null || v === undefined || v === "") return "—"
    const n = typeof v === "number" ? v : Number(v)
    if (!Number.isFinite(n)) return "—"
    return n.toLocaleString()
  }

  const calcDelta = (key: string) => {
    const curRaw = report?.[key]
    const prevRaw = prevReport?.[key]
    const cur = curRaw === null || curRaw === undefined ? null : Number(curRaw)
    const prev = prevRaw === null || prevRaw === undefined ? null : Number(prevRaw)

    if (!Number.isFinite(cur as any) || cur === null) return { diff: null as number | null, pct: null as number | null }
    if (!Number.isFinite(prev as any) || prev === null) return { diff: null as number | null, pct: null as number | null }

    const diff = cur - prev
    const pct = prev === 0 ? null : (diff / prev) * 100
    return { diff, pct }
  }

  const kpis = useMemo(
    () => [
      { key: "total_revenue", label: "Total Revenue", value: report ? formatMoney(report.total_revenue) : "—", money: true },
      { key: "cash_collected", label: "Cash Collected", value: report ? formatMoney(report.cash_collected) : "—", money: true },
      { key: "mrr", label: "MRR", value: report ? formatMoney(report.mrr) : "—", money: true },
      { key: "ad_spend", label: "Gasto Publicitario", value: report ? formatMoney(report.ad_spend) : "—", money: true },
      { key: "short_followers", label: "Seguidores de Instagram", value: report ? formatNumber(report.short_followers) : "—", money: false },
      { key: "new_clients", label: "Nuevos Clientes", value: report ? formatNumber(report.new_clients) : "—", money: false },
    ],
    [report, prevReport]
  )

  return (
    <section>
      {loading && <p className="text-white/60">Cargando métricas del mes…</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && !error && !report && (
        <p className="text-white/60">No hay reporte cargado para este mes.</p>
      )}
      <h2 className="mb-6 text-lg font-semibold text-foreground">Key Performance Indicators</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className={`group border-border bg-card transition-all duration-200 hover:border-muted-foreground/50 hover:shadow-lg hover:shadow-primary/5 border-l-4 ${
              (() => {
                const d = report ? calcDelta(kpi.key) : { diff: null as number | null }
                if (d.diff != null && d.diff < 0) return "border-l-red-500"
                if (d.diff != null && d.diff > 0) return "border-l-emerald-500"
                return "border-l-white/10"
              })()
            }`}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-3xl font-bold text-white">{kpi.value}</div>
                  <div className="mt-1 text-sm text-zinc-400">{kpi.label}</div>
                </div>
                {!loading && report && (
                  (() => {
                    const d = calcDelta(kpi.key)
                    const down = (d.diff ?? 0) < 0
                    const up = (d.diff ?? 0) > 0
                    const tone = down
                      ? "text-red-300"
                      : up
                        ? "text-emerald-300"
                        : "text-white/50"

                    const diffText = d.diff == null
                      ? ""
                      : `${d.diff > 0 ? "+" : ""}${d.diff.toLocaleString()}`

                    const pctText = d.pct == null
                      ? ""
                      : ` (${d.pct > 0 ? "+" : ""}${Math.round(d.pct)}%)`

                    return (
                      <div className={`flex items-center gap-1 text-xs font-medium ${tone}`}>
                        {down ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                        <span>{d.diff == null ? "" : `${diffText}${pctText}`}</span>
                      </div>
                    )
                  })()
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
