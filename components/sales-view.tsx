"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabaseClient"
import { useSelectedMonth, useActiveClient } from "@/components/dashboard-layout"

export function SalesView() {
  const ctxMonth = useSelectedMonth()
  const activeClientId = useActiveClient()
  const [mounted, setMounted] = useState(false)
  const selectedMonth = mounted ? (ctxMonth ?? "2025-12") : "2025-12"

  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const monthValue = useMemo(() => {
    if (/^\d{4}-\d{2}$/.test(selectedMonth)) return `${selectedMonth}-01`
    return selectedMonth
  }, [selectedMonth])

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        if (isMounted) {
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

        const { data: report, error: rErr } = await supabase
          .from("monthly_reports")
          .select("scheduled_calls,attended_calls,offers_presented,new_clients,offer_docs_sent,offer_docs_responded,cierres_por_offerdoc")
          .eq("client_id", clientId)
          .eq("month", monthValue)
          .maybeSingle()

        if (rErr) throw rErr

        if (isMounted) {
          setData(report ?? null)
          setLoading(false)
        }
      } catch (e: any) {
        if (isMounted) {
          setData(null)
          setLoading(false)
          setError(e?.message ?? "Error cargando funnel")
        }
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [monthValue, activeClientId])

  const scheduled = data?.scheduled_calls ?? 0
  const attended = data?.attended_calls ?? 0
  const offers = data?.offers_presented ?? 0
  const closed = data?.new_clients ?? 0

  const newClientsPerCall = Number(closed) || 0

  const offerDocsSent = data?.offer_docs_sent ?? 0
  const offerDocsResponded = data?.offer_docs_responded ?? 0
  const offerDocsRate =
    offerDocsSent > 0 ? (Number(offerDocsResponded) / Number(offerDocsSent)) * 100 : 0

  const closesPerOfferDoc = data?.cierres_por_offerdoc ?? 0
  const closesPerOfferDocRate =
    offerDocsResponded > 0
      ? (Number(closesPerOfferDoc) / Number(offerDocsResponded)) * 100
      : 0

  const funnelSteps = useMemo(() => {
    const top = Number(scheduled) || 0

    const steps = [
      { label: "Llamadas agendadas", count: Number(scheduled) || 0 },
      { label: "Llamadas atendidas", count: Number(attended) || 0 },
      { label: "Ofertas presentadas", count: Number(offers) || 0 },
      { label: "Nuevos clientes por llamada", count: newClientsPerCall },
    ]

    const formatPct = (pct: number) => {
      if (!Number.isFinite(pct) || pct <= 0) return "0%"
      if (pct < 0.1) return `${pct.toFixed(2)}%`
      if (pct < 1) return `${pct.toFixed(1)}%`
      if (pct < 10) return `${pct.toFixed(1)}%`
      return `${Math.round(pct)}%`
    }

    return steps.map((s, idx) => {
      const prev = idx === 0 ? s.count : steps[idx - 1].count
      const conversionFromPrevPct = idx === 0 ? 100 : prev > 0 ? (s.count / prev) * 100 : 0
      const conversionFromTopPct = idx === 0 ? 100 : top > 0 ? (s.count / top) * 100 : 0

      const width = 100

      return {
        label: s.label,
        value: s.count > 0 ? s.count : "—",
        conversionFromPrevPct,
        conversionFromTopPct,
        conversionFromPrevLabel: formatPct(conversionFromPrevPct),
        conversionFromTopLabel: formatPct(conversionFromTopPct),
        width,
      }
    })
  }, [scheduled, attended, offers, closed, newClientsPerCall])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Ventas y conversión</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualización del embudo de conversión mensual
        </p>
        <p className="mt-1 text-xs text-white/50">Mes seleccionado: {selectedMonth}</p>
      </div>

      {loading && <p className="text-white/60">Cargando embudo del mes…</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && !error && !data && (
        <p className="text-white/60">No hay reporte cargado para este mes.</p>
      )}

      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
        <div className="space-y-4">
          {funnelSteps.map((step, index) => (
            <div key={step.label} className="space-y-2">
              <Card
                className="group border-border bg-card transition-all duration-200 hover:border-muted-foreground/50 hover:shadow-lg hover:shadow-primary/5"
                style={{
                  width: "100%",
                }}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <div className="text-sm text-white/70">{step.label}</div>
                    <div className="mt-1 text-3xl font-bold text-white">
                      {step.value}
                    </div>
                  </div>

                  {/* Conversión vs TOP (agendadas) */}
                  <div className="text-right">
                    <div className="text-sm font-medium text-zinc-200">
                      {step.conversionFromTopLabel}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400">
                      vs agendadas: {step.conversionFromTopLabel}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {index < funnelSteps.length - 1 && (
                <div className="flex justify-center">
                  <ChevronDown className="h-5 w-5 text-muted-foreground/50" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="text-sm text-white/70">Offer Docs enviados</div>
              <div className="mt-1 text-3xl font-bold text-white">
                {offerDocsSent > 0 ? offerDocsSent : "—"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="text-sm text-white/70">Offer Docs respondidos</div>
              <div className="mt-1 text-3xl font-bold text-white">
                {offerDocsResponded > 0 ? offerDocsResponded : "—"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="text-sm text-white/70">Response Rate Offer Docs</div>
              <div className="mt-1 text-3xl font-bold text-white">
                {offerDocsSent > 0 ? `${offerDocsRate.toFixed(1)}%` : "—"}
              </div>
              <div className="mt-2 text-xs text-white/50">
                Cierres derivados: {closed > 0 ? closed : "—"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="text-sm text-white/70">Cierres por Offer Doc</div>
              <div className="mt-1 text-3xl font-bold text-white">
                {closesPerOfferDoc > 0 ? closesPerOfferDoc : "—"}
              </div>
              <div className="mt-2 text-xs text-white/50">
                Tasa sobre respondidos:{" "}
                {offerDocsResponded > 0
                  ? `${closesPerOfferDocRate.toFixed(1)}%`
                  : "—"}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}