"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useSelectedMonth, useActiveClient } from "@/components/layout/dashboard-layout"
import { useMarkPageReady } from "@/hooks/use-mark-page-ready"
import { useMinLoading } from "@/hooks/use-min-loading"
import { FunnelRowSkeleton, StatCardSkeleton, SectionHeaderSkeleton } from "@/components/ui/skeleton"

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5 transition-all duration-200 hover:border-white/15">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.03),transparent_60%)]" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1">{label}</p>
        <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
        {sub && <p className="mt-1.5 text-xs text-white/25">{sub}</p>}
      </div>
    </div>
  )
}

export function SalesView() {
  const ctxMonth = useSelectedMonth()
  const activeClientId = useActiveClient()
  const [mounted, setMounted] = useState(false)
  const selectedMonth = mounted ? (ctxMonth ?? "2025-12") : "2025-12"

  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const showSkeleton = useMinLoading(loading)
  useMarkPageReady(!showSkeleton)

  useEffect(() => { setMounted(true) }, [])

  const monthValue = useMemo(() => {
    if (/^\d{4}-\d{2}$/.test(selectedMonth)) return `${selectedMonth}-01`
    return selectedMonth
  }, [selectedMonth])

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        if (isMounted) { setLoading(true); setError(null) }
        const supabase = createClient()
        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!user) throw new Error("No session")
        const clientId = activeClientId
        if (!clientId) return
        const { data: report, error: rErr } = await supabase
          .from("monthly_reports")
          .select("scheduled_calls,attended_calls,aplications,new_clients,offer_docs_sent,offer_docs_responded,cierres_por_offerdoc")
          .eq("client_id", clientId)
          .eq("month", monthValue)
          .maybeSingle()
        if (rErr) throw rErr
        if (isMounted) { setData(report ?? null); setLoading(false) }
      } catch (e: any) {
        if (isMounted) { setData(null); setLoading(false); setError(e?.message ?? "Error cargando funnel") }
      }
    }
    load()
    return () => { isMounted = false }
  }, [monthValue, activeClientId])

  const scheduled = data?.scheduled_calls ?? 0
  const attended = data?.attended_calls ?? 0
  const aplications = data?.aplications ?? 0
  const closed = data?.new_clients ?? 0
  const offerDocsSent = data?.offer_docs_sent ?? 0
  const offerDocsResponded = data?.offer_docs_responded ?? 0
  const offerDocsRate = offerDocsSent > 0 ? (Number(offerDocsResponded) / Number(offerDocsSent)) * 100 : 0
  const closesPerOfferDoc = data?.cierres_por_offerdoc ?? 0
  const closesPerOfferDocRate = offerDocsResponded > 0 ? (Number(closesPerOfferDoc) / Number(offerDocsResponded)) * 100 : 0
  const callCloseRatePct = attended > 0 ? (Number(closed) / Number(attended)) * 100 : 0
  const callCloseRateLabel = attended > 0 ? `${callCloseRatePct.toFixed(1)}%` : "—"

  const funnelSteps = useMemo(() => {
    const top = Number(scheduled) || 0
    const steps = [
      { label: "Llamadas agendadas", count: Number(scheduled) || 0 },
      { label: "Llamadas atendidas", count: Number(attended) || 0 },
      { label: "Nuevos clientes por llamada", count: Number(closed) || 0 },
    ]
    const formatPct = (pct: number) => {
      if (!Number.isFinite(pct) || pct <= 0) return "0%"
      if (pct < 1) return `${pct.toFixed(1)}%`
      return `${Math.round(pct)}%`
    }
    return steps.map((s, idx) => {
      const prev = idx === 0 ? s.count : steps[idx - 1].count
      const conversionFromPrevPct = idx === 0 ? 100 : prev > 0 ? (s.count / prev) * 100 : 0
      const conversionFromTopPct = idx === 0 ? 100 : top > 0 ? (s.count / top) * 100 : 0
      return {
        label: s.label,
        value: s.count > 0 ? s.count : "—",
        conversionFromTopLabel: formatPct(conversionFromTopPct),
        conversionFromPrevLabel: formatPct(conversionFromPrevPct),
      }
    })
  }, [scheduled, attended, closed])

  if (showSkeleton) {
    return (
      <div className="space-y-6">
        <div>
          <SectionHeaderSkeleton />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <FunnelRowSkeleton key={i} />)}
          </div>
        </div>
        <div>
          <SectionHeaderSkeleton />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-white/70">Ventas y Conversión</h1>
        </div>
        <p suppressHydrationWarning className="text-xs text-white/30 ml-[18px]">
          Embudo de conversión mensual · {selectedMonth}
        </p>
      </div>

      {loading && <p className="text-white/40 text-sm">Cargando embudo del mes…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && !data && <p className="text-white/40 text-sm">No hay reporte cargado para este mes.</p>}

      <div className="grid max-w-5xl gap-8 md:grid-cols-2">
        {/* Funnel */}
        <div className="space-y-2">
          {funnelSteps.map((step, index) => (
            <div key={step.label}>
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] transition-all duration-200 hover:border-white/15">
                <div className="h-[2px] w-full bg-[#ffde21]/30" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.03),transparent_60%)]" />
                <div className="relative flex items-center justify-between p-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">{step.label}</p>
                    <p className="mt-1.5 text-3xl font-bold tracking-tight text-white">{step.value}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white/70">{step.conversionFromTopLabel}</p>
                    <p className="text-[10px] text-white/25 mt-0.5">vs agendadas</p>
                  </div>
                </div>
              </div>
              {index < funnelSteps.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <ChevronDown className="h-4 w-4 text-white/20" />
                </div>
              )}
            </div>
          ))}

          {/* Close rate */}
          <div className="relative overflow-hidden rounded-2xl border border-[#ffde21]/20 bg-[#ffde21]/[0.04] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Tasa de cierre vs atendidas</p>
            <p className="mt-1.5 text-3xl font-bold tracking-tight text-white">{callCloseRateLabel}</p>
            <p className="mt-1.5 text-xs text-white/25">clientes / atendidas</p>
          </div>
        </div>

        {/* Offer Docs */}
        <div className="space-y-4">
          <StatCard label="Aplicaciones" value={aplications > 0 ? aplications : "—"} />
          <StatCard label="Offer Docs enviados" value={offerDocsSent > 0 ? offerDocsSent : "—"} />
          <StatCard label="Offer Docs respondidos" value={offerDocsResponded > 0 ? offerDocsResponded : "—"} />
          <StatCard
            label="Response Rate Offer Docs"
            value={offerDocsSent > 0 ? `${offerDocsRate.toFixed(1)}%` : "—"}
            sub={`Cierres derivados: ${closed > 0 ? closed : "—"}`}
          />
          <StatCard
            label="Cierres por Offer Doc"
            value={closesPerOfferDoc > 0 ? closesPerOfferDoc : "—"}
            sub={`Tasa sobre respondidos: ${offerDocsResponded > 0 ? `${closesPerOfferDocRate.toFixed(1)}%` : "—"}`}
          />
        </div>
      </div>
    </div>
  )
}
