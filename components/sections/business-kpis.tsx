"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingDown, TrendingUp, DollarSign, Wallet, Repeat, Megaphone, Users, UserPlus } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useSelectedMonth, useActiveClient } from "@/components/layout/dashboard-layout"
import { useMarkPageReady } from "@/hooks/use-mark-page-ready"
import { useMinLoading } from "@/hooks/use-min-loading"
import { KpiCardSkeleton, SectionHeaderSkeleton } from "@/components/ui/skeleton"

export function BusinessKPIs({ selectedMonth }: { selectedMonth?: string }) {
  const [report, setReport] = useState<any | null>(null)
  const [prevReport, setPrevReport] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const showSkeleton = useMinLoading(loading)
  useMarkPageReady(!showSkeleton)

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
          }
          return
        }

        let monthValue: string | null = null

        if (/^\d{4}-\d{2}$/.test(effectiveMonth)) {
          monthValue = `${effectiveMonth}-01`
        }

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
      { key: "total_revenue", label: "Total Revenue", value: report ? formatMoney(report.total_revenue) : "—", money: true, icon: DollarSign },
      { key: "cash_collected", label: "Cash Collected", value: report ? formatMoney(report.cash_collected) : "—", money: true, icon: Wallet },
      { key: "mrr", label: "MRR", value: report ? formatMoney(report.mrr) : "—", money: true, icon: Repeat },
      { key: "ad_spend", label: "Gasto Publicitario", value: report ? formatMoney(report.ad_spend) : "—", money: true, icon: Megaphone },
      { key: "short_followers", label: "Seguidores de Instagram", value: report ? formatNumber(report.short_followers) : "—", money: false, icon: Users },
      { key: "new_clients", label: "Nuevos Clientes", value: report ? formatNumber(report.new_clients) : "—", money: false, icon: UserPlus },
    ],
    [report, prevReport]
  )

  // Performance summary counts
  const { upCount, downCount } = useMemo(() => {
    if (!report) return { upCount: 0, downCount: 0 }
    let up = 0, down = 0
    kpis.forEach(k => {
      const d = calcDelta(k.key)
      if (d.diff != null && d.diff > 0) up++
      else if (d.diff != null && d.diff < 0) down++
    })
    return { upCount: up, downCount: down }
  }, [report, prevReport])

  if (showSkeleton) {
    return (
      <section>
        <SectionHeaderSkeleton />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
      </section>
    )
  }

  return (
    <section>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      {!error && !report && (
        <p className="text-white/40 mb-4 text-sm">No hay reporte cargado para este mes.</p>
      )}

      {/* Section header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">Key Performance Indicators</h2>
        </div>
        {report && prevReport && (
          <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              {upCount} alza
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
              <TrendingDown className="h-3.5 w-3.5" />
              {downCount} baja
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => {
          const delta = report ? calcDelta(kpi.key) : { diff: null as number | null, pct: null as number | null }
          const isUp = delta.diff != null && delta.diff > 0
          const isDown = delta.diff != null && delta.diff < 0

          return (
            <div
              key={kpi.key}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] transition-all duration-200 hover:border-white/15 hover:bg-[#141416]"
            >
              {/* Top accent bar */}
              <div className={`h-[2px] w-full ${isDown ? "bg-red-500/60" : isUp ? "bg-emerald-500/60" : "bg-white/10"}`} />

              {/* Subtle radial glow */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.04),transparent_60%)]" />

              <div className="relative p-5">
                {/* Top row */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffde21]/10 ring-1 ring-[#ffde21]/15">
                    <kpi.icon className="h-4 w-4 text-[#ffde21]" />
                  </div>

                  {!loading && report && delta.diff != null && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                        isUp
                          ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                          : isDown
                          ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                          : "bg-white/5 text-white/40 ring-1 ring-white/10"
                      }`}
                    >
                      {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : null}
                      {delta.pct != null
                        ? `${delta.pct > 0 ? "+" : ""}${Math.round(delta.pct)}%`
                        : `${delta.diff > 0 ? "+" : ""}${delta.diff.toLocaleString()}`}
                    </span>
                  )}
                </div>

                {/* Label */}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                  {kpi.label}
                </p>

                {/* Value */}
                <p className="mt-1.5 text-3xl font-bold tracking-tight text-white">
                  {kpi.value}
                </p>

                {/* Previous month */}
                {!loading && prevReport && (() => {
                  const prev = prevReport[kpi.key]
                  if (prev == null) return null
                  const formatted = kpi.money ? formatMoney(prev) : formatNumber(prev)
                  return (
                    <p className="mt-2 text-xs text-white/25">
                      vs {formatted} mes anterior
                    </p>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
