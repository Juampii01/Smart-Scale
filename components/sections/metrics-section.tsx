"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type MetricsSectionProps = {
  title?: string
  subtitle?: string
  /** Pass the full monthly report row (e.g. from Supabase monthly_reports) */
  metrics: Record<string, any> | null
  /** Optional aggregated (year-to-date) metrics object aligned to the same keys as metrics */
  annualMetrics?: Record<string, any> | null
  loading?: boolean
  error?: string | null
}

function isSkippableKey(key: string) {
  return (
    key === "id" ||
    key === "client_id" ||
    key === "client_id_text" ||
    key === "created_at" ||
    key === "updated_at" ||
    key === "month"
  )
}

function formatValue(v: any): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return String(v)
    // Keep integers clean, decimals with 2
    if (Number.isInteger(v)) return v.toLocaleString()
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  if (typeof v === "string") return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function guessCategory(key: string): string {
  const k = key.toLowerCase()
  if (k.startsWith("yt_") || k.includes("youtube")) return "YouTube"
  if (k.startsWith("short_") || k.includes("short")) return "Short-form"
  if (k.startsWith("email_") || k.includes("email")) return "Email"
  if (k.includes("call") || k.includes("offer") || k.includes("deal") || k.includes("close")) return "Sales"
  if (k.includes("revenue") || k.includes("cash") || k.includes("mrr") || k.includes("expense") || k.includes("ad_spend") || k.includes("ads")) return "Business"
  if (k.includes("reflection") || k.includes("win") || k.includes("focus") || k.includes("support")) return "Reflection"
  return "Other"
}

const FIELD_LABELS: Record<string, string> = {
  total_revenue: "Revenue",
  mrr: "MRR",
  cash_collected: "Cash Collected",
  software_costs: "Costos de Software",
  variable_costs: "Costos Variables",
  ad_spend: "Inversión en Ads",

  scheduled_calls: "Llamadas Agendadas",
  attended_calls: "Llamadas Asistidas",
  qualified_calls: "Llamadas Calificadas",

  inbound_messages: "Mensajes Entrantes",
  offers_presented: "Ofertas Presentadas",

  new_clients: "Nuevos Clientes en Llamada",
  active_clients: "Clientes Activos",

  offer_docs_sent: "OfferDocs Enviados",
  offer_docs_responded: "OfferDocs Respondidos",
  cierres_por_offerdoc: "Cierres por OfferDoc",

  short_followers: "Seguidores Short-form",
  short_reach: "Alcance Short-form",
  short_posts: "Posts Short-form",

  yt_subscribers: "Suscriptores YouTube",
  yt_monthly_audience: "Audiencia Mensual YouTube",
  yt_views: "Vistas YouTube",
  yt_watch_time: "Tiempo de Visualización YouTube",
  yt_new_subscribers: "Nuevos Suscriptores YouTube",
  yt_videos: "Videos YouTube",

  email_subscribers: "Suscriptores Email",
  email_new_subscribers: "Nuevos Suscriptores Email",

  biggest_win: "Mayor Logro del Mes",
  next_focus: "Próximo Enfoque",
  support_needed: "Soporte Necesario",
  improvements: "Mejoras",
  report_date: "Fecha de Reporte",
}

function getFieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key
}

export function MetricsSection({
  title = "All Metrics",
  subtitle = "Full monthly report snapshot",
  metrics,
  annualMetrics,
  loading,
  error,
}: MetricsSectionProps) {
  const [q, setQ] = useState("")

  const { grouped, totalCount, monthLabel } = useMemo(() => {
    const monthLabel = metrics?.month ? String(metrics.month).slice(0, 10) : "—"

    const keys = new Set<string>([
      ...Object.keys(metrics ?? {}),
      ...Object.keys(annualMetrics ?? {}),
    ])

    const entries = Array.from(keys)
      .filter((k) => !isSkippableKey(k))
      .map((k) => {
        const v = metrics?.[k]
        return {
          key: k,
          value: v,
          valueText: formatValue(v),
          annualValueText: annualMetrics ? formatValue(annualMetrics[k]) : "—",
          category: guessCategory(k),
        }
      })

    const qNorm = q.trim().toLowerCase()
    const filtered = qNorm
      ? entries.filter((e) =>
          e.key.toLowerCase().includes(qNorm) ||
          e.valueText.toLowerCase().includes(qNorm) ||
          e.category.toLowerCase().includes(qNorm)
        )
      : entries

    const grouped: Record<string, typeof filtered> = {}
    for (const item of filtered) {
      grouped[item.category] = grouped[item.category] ?? []
      grouped[item.category].push(item)
    }

    // Stable ordering
    const order = ["Business", "Sales", "Short-form", "YouTube", "Email", "Reflection", "Other"]
    const ordered: Record<string, typeof filtered> = {}
    for (const cat of order) {
      if (grouped[cat]?.length) ordered[cat] = grouped[cat]
    }
    for (const [cat, items] of Object.entries(grouped)) {
      if (!ordered[cat]) ordered[cat] = items
    }

    // Sort inside groups by key
    for (const cat of Object.keys(ordered)) {
      ordered[cat] = ordered[cat].sort((a, b) => a.key.localeCompare(b.key))
    }

    return { grouped: ordered, totalCount: filtered.length, monthLabel }
  }, [metrics, annualMetrics, q])

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs font-medium text-white/40">
          {totalCount} campos · {monthLabel}
        </span>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar métricas…"
          className={cn(
            "w-full sm:w-[260px] h-8 rounded-xl text-xs",
            "bg-white/[0.04] text-white placeholder:text-white/25 border-white/8",
            "focus-visible:ring-1 focus-visible:ring-[#ffde21]/30 focus-visible:border-[#ffde21]/30"
          )}
        />
      </div>

      {loading && <p className="text-white/40 text-sm">Cargando métricas…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && !metrics && (
        <p className="text-white/40 text-sm">No hay métricas cargadas para este mes.</p>
      )}

      {!loading && !error && metrics && (
        <div className="grid gap-4">
          {Object.entries(grouped).map(([category, items]) => (
            <div
              key={category}
              className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]"
            >
              {/* Category header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-[2px] rounded-full bg-[#ffde21]/60" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/50">{category}</span>
                </div>
                <span className="text-[10px] text-white/25 tabular-nums">{items.length} campos</span>
              </div>

              {/* Table */}
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#111113]/95 backdrop-blur-sm">
                    <tr className="border-b border-white/[0.05]">
                      <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/25">Campo</th>
                      <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-white/25">Mensual</th>
                      <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-white/25">Últ. 12 meses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr
                        key={item.key}
                        className={`border-b border-white/[0.04] last:border-b-0 transition-colors hover:bg-white/[0.02] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                      >
                        <td className="px-5 py-2.5">
                          <span className="text-xs font-medium text-white/55">
                            {getFieldLabel(item.key)}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <span className="font-mono text-sm font-semibold text-white/85">
                            {item.valueText}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <span className="font-mono text-xs text-white/35">{item.annualValueText}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}