"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabaseClient"
import { useSelectedMonth } from "@/components/dashboard-layout"

function pct(num: number, den: number) {
  if (!den) return "—"
  return `${((num / den) * 100).toFixed(2)}%`
}

export function SalesMetrics() {
  const ctxMonth = useSelectedMonth()
  const selectedMonth = ctxMonth ?? "2025-12"

  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const monthValue = useMemo(() => {
    if (/^\d{4}-\d{2}$/.test(selectedMonth)) return `${selectedMonth}-01`
    return selectedMonth
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

        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single()

        if (pErr) throw pErr
        if (!profile?.client_id) throw new Error("No client_id")

        const { data: report, error: rErr } = await supabase
          .from("monthly_reports")
          .select(
            "calls_scheduled,calls_attended,offers_presented,deals_closed,offer_docs_sent,offer_docs_responded,cierres_por_offerdoc"
          )
          .eq("client_id", profile.client_id)
          .eq("month", monthValue)
          .maybeSingle()

        if (rErr) throw rErr

        if (mounted) {
          setData(report ?? null)
          setLoading(false)
        }
      } catch (e: any) {
        if (mounted) {
          setData(null)
          setLoading(false)
          setError(e?.message ?? "Error cargando métricas")
        }
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [monthValue])

  const scheduled = data?.calls_scheduled ?? 0
  const attended = data?.calls_attended ?? 0
  const offers = data?.offers_presented ?? 0
  const closed = data?.deals_closed ?? 0
  const offerDocsSent = data?.offer_docs_sent ?? 0
  const offerDocsResponded = data?.offer_docs_responded ?? 0
  const closesPerOfferDoc = data?.cierres_por_offerdoc ?? 0

  const metrics = [
    { label: "Scheduled Calls", value: scheduled || "—" },
    { label: "Attended Calls", value: attended || "—" },
    { label: "Offers Presented", value: offers || "—" },
    { label: "Offer Docs Sent", value: offerDocsSent || "—" },
    { label: "Offer Docs Responded", value: offerDocsResponded || "—" },
    { label: "Offer Docs Response Rate", value: pct(offerDocsResponded, offerDocsSent) },
    { label: "Cierres por Offer Doc", value: closesPerOfferDoc || "—" },
    { label: "Show Up Rate", value: pct(attended, scheduled) },
    { label: "Offer Rate", value: pct(offers, attended) },
    { label: "Close Rate", value: pct(closed, offers) },
    { label: "Scheduled → Close %", value: pct(closed, scheduled) },
  ]

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Sales & Conversion Metrics</h2>

      {loading && <p className="mb-4 text-white/60">Cargando métricas del mes…</p>}
      {error && <p className="mb-4 text-red-400">{error}</p>}
      {!loading && !error && !data && (
        <p className="mb-4 text-white/60">No hay reporte cargado para este mes.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="border-border bg-card transition-colors hover:border-muted-foreground/50">
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-foreground">{metric.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{metric.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
