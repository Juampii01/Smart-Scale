import React, { createContext, useContext, useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"

type AnnualMetrics = {
  total_revenue: number
  [key: string]: any
} | null

type AnnualMetricsContextType = {
  annualMetrics: AnnualMetrics
  loading: boolean
  error: string | null
}

const AnnualMetricsContext = createContext<AnnualMetricsContextType>({
  annualMetrics: null,
  loading: false,
  error: null,
})

export function useAnnualMetrics() {
  return useContext(AnnualMetricsContext)
}

export function AnnualMetricsProvider({ children }: { children: React.ReactNode }) {
  const activeClientId = useActiveClient()
  const [annualMetrics, setAnnualMetrics] = useState<AnnualMetrics>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeClientId) return
    async function fetchAnnualMetrics() {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        // Buscar el mes más reciente con datos para el cliente
        const { data: latestRow, error: latestErr } = await supabase
          .from("monthly_reports")
          .select("month")
          .eq("client_id", activeClientId)
          .order("month", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (latestErr) throw latestErr
        const latestMonthRaw = (latestRow as any)?.month as string | undefined
        if (!latestMonthRaw) {
          setAnnualMetrics(null)
          return
        }
        // Calcular rolling 12 meses igual que en metrics-view
        const latestMonthISO = /^\d{4}-\d{2}$/.test(latestMonthRaw)
          ? `${latestMonthRaw}-01`
          : latestMonthRaw
        const latestStart = new Date(`${latestMonthISO}T00:00:00Z`)
        const rollingEndDate = new Date(latestStart)
        rollingEndDate.setUTCMonth(rollingEndDate.getUTCMonth() + 1)
        const rollingStartDate = new Date(rollingEndDate)
        rollingStartDate.setUTCMonth(rollingStartDate.getUTCMonth() - 12)
        const fmt = (d: Date) => {
          const y = String(d.getUTCFullYear())
          const m = String(d.getUTCMonth() + 1).padStart(2, "0")
          return `${y}-${m}-01`
        }
        const rollingStart = fmt(rollingStartDate)
        const rollingEnd = fmt(rollingEndDate)
        // Traer todos los registros de los últimos 12 meses
        const { data: annualRows, error: annualErr } = await supabase
          .from("monthly_reports")
          .select("*")
          .eq("client_id", activeClientId)
          .gte("month", rollingStart)
          .lt("month", rollingEnd)
        if (annualErr) throw annualErr
        // Sumar todos los campos numéricos
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
        setAnnualMetrics(Object.keys(annual).length ? (annual as AnnualMetrics) : null)
      } catch (e: any) {
        setError(e?.message ?? "Error al cargar métricas anuales")
        setAnnualMetrics(null)
      } finally {
        setLoading(false)
      }
    }
    fetchAnnualMetrics()
  }, [activeClientId])

  if (!activeClientId) {
    // No renderizar nada hasta que haya clientId
    return null
  }

  return (
    <AnnualMetricsContext.Provider value={{ annualMetrics, loading, error }}>
      {children}
    </AnnualMetricsContext.Provider>
  )
}
