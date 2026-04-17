"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { Loader2, RefreshCw, Download } from "lucide-react"

// ─── Metrics — all fields Ann actually fills ──────────────────────────────────

type Fmt = "money" | "number"

interface MetricRow  { kind: "metric";  key: string; label: string; format: Fmt }
interface SectionRow { kind: "section"; label: string }
type Row = MetricRow | SectionRow

const ROWS: Row[] = [
  { kind: "section", label: "💰 Revenue" },
  { kind: "metric",  key: "cash_collected",  label: "Cash Collected",   format: "money"  },
  { kind: "metric",  key: "total_revenue",   label: "Total Revenue",    format: "money"  },
  { kind: "metric",  key: "mrr",             label: "MRR",              format: "money"  },
  { kind: "metric",  key: "software_costs",  label: "Software Costs",   format: "money"  },
  { kind: "metric",  key: "variable_costs",  label: "Variable Costs",   format: "money"  },
  { kind: "metric",  key: "ad_spend",        label: "Ad Spend",         format: "money"  },

  { kind: "section", label: "📞 Ventas" },
  { kind: "metric",  key: "scheduled_calls",       label: "Calls Agendadas",      format: "number" },
  { kind: "metric",  key: "attended_calls",         label: "Calls Realizadas",     format: "number" },
  { kind: "metric",  key: "qualified_calls",        label: "Calls Calificadas",    format: "number" },
  { kind: "metric",  key: "inbound_messages",       label: "Mensajes Inbound",     format: "number" },
  { kind: "metric",  key: "aplications",            label: "Aplicaciones",         format: "number" },
  { kind: "metric",  key: "offer_docs_sent",        label: "Offer Docs Enviados",  format: "number" },
  { kind: "metric",  key: "offer_docs_responded",   label: "Offer Docs Resp.",     format: "number" },
  { kind: "metric",  key: "cierres_por_offerdoc",   label: "Cierres x OfferDoc",   format: "number" },
  { kind: "metric",  key: "new_clients",            label: "New Clients",          format: "number" },
  { kind: "metric",  key: "active_clients",         label: "Active Clients",       format: "number" },

  { kind: "section", label: "📸 Instagram" },
  { kind: "metric",  key: "short_followers", label: "Followers",    format: "number" },
  { kind: "metric",  key: "short_reach",     label: "Reach",        format: "number" },
  { kind: "metric",  key: "short_posts",     label: "Posts",        format: "number" },

  { kind: "section", label: "▶️ YouTube" },
  { kind: "metric",  key: "yt_subscribers",      label: "Subscribers",       format: "number" },
  { kind: "metric",  key: "yt_new_subscribers",  label: "New Subscribers",   format: "number" },
  { kind: "metric",  key: "yt_monthly_audience", label: "Audiencia Mensual", format: "number" },
  { kind: "metric",  key: "yt_views",            label: "Views",             format: "number" },
  { kind: "metric",  key: "yt_watch_time",       label: "Watch Time (min)",  format: "number" },
  { kind: "metric",  key: "yt_videos",           label: "Videos",            format: "number" },

  { kind: "section", label: "📧 Email" },
  { kind: "metric",  key: "email_subscribers",     label: "Subscribers",     format: "number" },
  { kind: "metric",  key: "email_new_subscribers", label: "New Subscribers", format: "number" },
]

const METRIC_ROWS = ROWS.filter((r): r is MetricRow => r.kind === "metric")

const ALL_FIELDS = METRIC_ROWS.map(r => r.key).join(", ")

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonthLabel(month: string) {
  const [year, mon] = String(month).slice(0, 7).split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${names[parseInt(mon, 10) - 1] ?? mon} '${year.slice(2)}`
}

function fmtValue(v: number | null | undefined, format: Fmt): string {
  if (v == null || isNaN(Number(v))) return "—"
  const n = Number(v)
  if (format === "money") {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
    return `$${n.toLocaleString()}`
  }
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ─── Editable Cell ────────────────────────────────────────────────────────────

function EditableCell({
  value, metricKey, month, clientId, format, onSaved,
}: {
  value:     number | null
  metricKey: string
  month:     string
  clientId:  string
  format:    Fmt
  onSaved:   (month: string, key: string, val: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState("")
  const [saving,  setSaving]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setDraft(value != null ? String(value) : "")
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }
  const cancel = () => { setEditing(false); setDraft("") }

  const save = async () => {
    const num = draft.trim() === "" ? null : Number(draft.replace(/[$,KM]/g, ""))
    if (isNaN(num as number) && num !== null) { cancel(); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ client_id: clientId, month, field: metricKey, value: num }),
      })
      onSaved(month, metricKey, num)
    } finally { setSaving(false); setEditing(false) }
  }

  if (saving) return (
    <td className="whitespace-nowrap px-4 py-2.5 text-right">
      <Loader2 className="inline h-3 w-3 animate-spin text-[#ffde21]/40" />
    </td>
  )

  if (editing) return (
    <td className="whitespace-nowrap px-2 py-1">
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel() }}
        className="w-28 rounded-lg border border-[#ffde21]/40 bg-[#ffde21]/[0.07] px-2.5 py-1.5 text-right text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#ffde21]/60"
      />
    </td>
  )

  return (
    <td
      onClick={startEdit}
      title="Click para editar"
      className="group cursor-pointer whitespace-nowrap px-4 py-2.5 text-right transition-colors hover:bg-white/[0.04]"
    >
      <span className={`text-[13px] tabular-nums group-hover:text-white transition-colors ${value != null ? "text-white/80" : "text-white/15"}`}>
        {fmtValue(value, format)}
      </span>
    </td>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminDataView() {
  const [clientId, setClientId] = useState<string | null>(null)
  const [months,   setMonths]   = useState<string[]>([])
  const [pivot,    setPivot]    = useState<Record<string, Record<string, number | null>>>({})
  const [loading,  setLoading]  = useState(true)

  // Load Ann's own client_id from her profile
  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from("profiles").select("client_id").eq("id", user.id).maybeSingle()
      if (profile?.client_id) setClientId(profile.client_id)
    }
    loadProfile()
  }, [])

  const loadReports = useCallback(async (cid: string) => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from("monthly_reports")
        .select(`month, ${ALL_FIELDS}`)
        .eq("client_id", cid)
        .order("month", { ascending: true })

      const rows = data ?? []
      setMonths(rows.map((r: any) => String(r.month).slice(0, 7)))

      const pv: Record<string, Record<string, number | null>> = {}
      for (const row of rows) {
        const m = String(row.month).slice(0, 7)
        pv[m] = {}
        for (const metric of METRIC_ROWS) {
          pv[m][metric.key] = row[metric.key] != null ? Number(row[metric.key]) : null
        }
      }
      setPivot(pv)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (clientId) loadReports(clientId) }, [clientId, loadReports])

  const handleSaved = useCallback((month: string, key: string, val: number | null) => {
    setPivot(prev => ({ ...prev, [month]: { ...(prev[month] ?? {}), [key]: val } }))
  }, [])

  const exportCsv = () => {
    const header = ["Métrica", ...months.map(fmtMonthLabel)].join(",")
    const dataRows = METRIC_ROWS.map(m =>
      [m.label, ...months.map(mo => pivot[mo]?.[m.key] ?? "")].join(",")
    )
    const csv  = [header, ...dataRows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement("a"), { href: url, download: "smart-scale-data.csv" }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Tabla de Datos</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {months.length
              ? `${months.length} ${months.length === 1 ? "mes" : "meses"} · click en cualquier celda para editar`
              : "Métricas mensuales"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => clientId && loadReports(clientId)}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={exportCsv}
            disabled={!months.length}
            className="flex items-center gap-2 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-medium text-white/50 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/40" />
          </div>
        ) : !months.length ? (
          <div className="py-24 text-center">
            <p className="text-sm text-white/25">No hay reportes cargados todavía.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="sticky left-0 z-10 bg-[#111113] px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 min-w-[190px]">
                    Métrica
                  </th>
                  {months.map(m => (
                    <th key={m} className="px-4 py-3.5 text-right text-[11px] font-semibold text-white/50 whitespace-nowrap min-w-[120px]">
                      {fmtMonthLabel(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => {
                  if (row.kind === "section") {
                    return (
                      <tr key={`section-${i}`} className="border-t border-white/[0.06]">
                        <td
                          colSpan={months.length + 1}
                          className="sticky left-0 bg-white/[0.02] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35"
                        >
                          {row.label}
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={row.key} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="sticky left-0 z-10 bg-[#111113] px-5 py-2.5 text-[13px] text-white/55 whitespace-nowrap">
                        {row.label}
                      </td>
                      {months.map(m => (
                        <EditableCell
                          key={m}
                          value={pivot[m]?.[row.key] ?? null}
                          metricKey={row.key}
                          month={m}
                          clientId={clientId!}
                          format={row.format}
                          onSaved={handleSaved}
                        />
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && months.length > 0 && (
        <p className="text-[11px] text-white/20 text-center">
          Click en cualquier número para editar · Enter para guardar · Esc para cancelar
        </p>
      )}
    </div>
  )
}
