"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabaseClient"
import { MetricsSection } from "@/components/metrics-section"
import { useSelectedMonth, useActiveClient } from "@/components/dashboard-layout"

type MonthlyReportRow = Record<string, any>

function normalizeMonthToDate(month: string) {
  // Accept either YYYY-MM or YYYY-MM-01 (or any ISO date).
  // monthly_reports.month is stored as a DATE, so we query with YYYY-MM-01.
  if (/^\d{4}-\d{2}$/.test(month)) return `${month}-01`
  if (/^\d{6}$/.test(month)) {
    const y = month.slice(0, 4)
    const m = month.slice(4, 6)
    return `${y}-${m}-01`
  }
  if (/^\d{8}$/.test(month)) {
    const y = month.slice(0, 4)
    const m = month.slice(4, 6)
    const d = month.slice(6, 8)
    return `${y}-${m}-${d}`
  }
  return month
}

export function MetricsView() {
  const [metrics, setMetrics] = useState<MonthlyReportRow | null>(null)
  const [annualMetrics, setAnnualMetrics] = useState<MonthlyReportRow | null>(null)
  const [annualRange, setAnnualRange] = useState<{ start: string; end: string; label: string } | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const ctxMonth = useSelectedMonth()
  const activeClientId = useActiveClient()
  // IMPORTANT: avoid SSR/CSR mismatch if ctxMonth comes from client-only storage
  const selectedMonth = hydrated ? (ctxMonth ?? "2025-12") : "2025-12"
  const monthValue = useMemo(() => normalizeMonthToDate(selectedMonth), [selectedMonth])

  const monthRange = useMemo(() => {
    // Compute an inclusive start and exclusive end for the selected month.
    // This works whether `month` is stored as DATE (YYYY-MM-DD) or text (YYYY-MM).
    const mm = String(selectedMonth)
    let y = mm.slice(0, 4)
    let m = mm.slice(5, 7)
    if (/^\d{6}$/.test(mm)) {
      y = mm.slice(0, 4)
      m = mm.slice(4, 6)
    }

    const start = `${y}-${m}-01`
    const nextMonth = new Date(`${start}T00:00:00Z`)
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    const endY = String(nextMonth.getUTCFullYear())
    const endM = String(nextMonth.getUTCMonth() + 1).padStart(2, "0")
    const end = `${endY}-${endM}-01`

    return { start, end }
  }, [selectedMonth])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const clientId = activeClientId
        if (!clientId) {
          // Wait until a client is selected; don't error or clear state
          return
        }
        setLoading(true)
        setError(null)

        const supabase = createClient()

        // 2a) determine the rolling 12-month window ending at the latest available report month
        const { data: latestRow, error: latestErr } = await supabase
          .from("monthly_reports")
          .select("month")
          .eq("client_id", clientId)
          .order("month", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestErr) throw latestErr
        const latestMonthRaw = (latestRow as any)?.month as string | undefined

        // Parse latest month into a Date at the first day of that month
        const latestMonthISO = latestMonthRaw
          ? /^\d{4}-\d{2}$/.test(latestMonthRaw)
            ? `${latestMonthRaw}-01`
            : latestMonthRaw
          : `${String(selectedMonth).slice(0, 7)}-01`

        const latestStart = new Date(`${latestMonthISO}T00:00:00Z`)
        // End is the first day of the month AFTER latest month (exclusive)
        const rollingEndDate = new Date(latestStart)
        rollingEndDate.setUTCMonth(rollingEndDate.getUTCMonth() + 1)
        // Start is 12 months before rollingEnd
        const rollingStartDate = new Date(rollingEndDate)
        rollingStartDate.setUTCMonth(rollingStartDate.getUTCMonth() - 12)

        const fmt = (d: Date) => {
          const y = String(d.getUTCFullYear())
          const m = String(d.getUTCMonth() + 1).padStart(2, "0")
          return `${y}-${m}-01`
        }

        const rollingStart = fmt(rollingStartDate)
        const rollingEnd = fmt(rollingEndDate)
        const latestLabel = `${String(latestMonthISO).slice(0, 7)}`
        const rangeLabel = `Últimos 12 meses (${rollingStart.slice(0, 7)} → ${latestLabel})`

        if (mounted) setAnnualRange({ start: rollingStart, end: rollingEnd, label: rangeLabel })

        // 2b) fetch annual (rolling 12-month) metrics and aggregate numeric fields
        const { data: annualRows, error: annualErr } = await supabase
          .from("monthly_reports")
          .select("*")
          .eq("client_id", clientId)
          .gte("month", rollingStart)
          .lt("month", rollingEnd)

        if (annualErr) throw annualErr

        const annual: Record<string, any> = {}
        const skipKeys = new Set(["id", "client_id", "created_at", "updated_at", "month"])
        const isAnnualSkippable = (k: string) => {
          const kk = k.toLowerCase()
          return (
            skipKeys.has(k) ||
            kk === "report_date" ||
            kk === "improvements" ||
            kk === "feedback" ||
            kk === "next_focus" ||
            kk === "support_needed" ||
            kk.startsWith("reflection")
          )
        }

        for (const row of (annualRows ?? []) as any[]) {
          for (const [k, v] of Object.entries(row ?? {})) {
            if (isAnnualSkippable(k)) continue
            if (typeof v === "number" && Number.isFinite(v)) {
              annual[k] = (Number.isFinite(annual[k]) ? annual[k] : 0) + v
              continue
            }
            if (typeof v === "string" && v.trim().length) {
              const n = Number(v)
              if (Number.isFinite(n)) {
                annual[k] = (Number.isFinite(annual[k]) ? annual[k] : 0) + n
              }
            }
          }
        }

        // 3) fetch selected month report using a month range (robust)
        let data: any = null
        const { data: rangeRows, error: rangeErr } = await supabase
          .from("monthly_reports")
          .select("*")
          .eq("client_id", clientId)
          .gte("month", monthRange.start)
          .lt("month", monthRange.end)
          .order("month", { ascending: true })
          .limit(1)

        if (rangeErr) throw rangeErr
        data = (rangeRows ?? [])[0] ?? null

        if (mounted) {
          setMetrics(data as MonthlyReportRow | null)
          setAnnualMetrics(Object.keys(annual).length ? (annual as MonthlyReportRow) : null)
        }
      } catch (e: any) {
        if (mounted) {
          console.error("Metrics load error:", e)
          setError(e?.message ?? "Failed to load metrics")
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [activeClientId, monthValue, monthRange.start, monthRange.end, selectedMonth])

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Metrics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Full monthly report snapshot</p>
        <p suppressHydrationWarning className="mt-1 text-xs text-white/50">
          Mes seleccionado: {selectedMonth}
        </p>
        <p className="mt-1 text-xs text-white/50">{annualRange?.label ?? "Últimos 12 meses: —"}</p>
      </div>

      <MetricsSection
        title="All Metrics"
        subtitle="Full monthly report snapshot"
        metrics={metrics}
        annualMetrics={annualMetrics}
        loading={loading}
        error={error}
      />
    </section>
  )
}
