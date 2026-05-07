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

// Agrupar las métricas por sección para el header con colspan
type SectionGroup = { label: string; metrics: MetricRow[] }
const SECTION_GROUPS: SectionGroup[] = (() => {
  const groups: SectionGroup[] = []
  let current: SectionGroup | null = null
  for (const row of ROWS) {
    if (row.kind === "section") {
      current = { label: row.label, metrics: [] }
      groups.push(current)
    } else if (current) {
      current.metrics.push(row)
    }
  }
  return groups
})()

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
  value, metricKey, month, clientId, format, onSaved, firstInGroup = false,
}: {
  value:        number | null
  metricKey:    string
  month:        string
  clientId:     string
  format:       Fmt
  onSaved:      (month: string, key: string, val: number | null) => void
  firstInGroup?: boolean
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

  const groupBorder = firstInGroup ? "border-l border-white/[0.04]" : ""

  if (saving) return (
    <td className={`whitespace-nowrap px-4 py-2.5 text-right ${groupBorder}`}>
      <Loader2 className="inline h-3 w-3 animate-spin text-[#ffde21]/40" />
    </td>
  )

  if (editing) return (
    <td className={`whitespace-nowrap px-2 py-1 ${groupBorder}`}>
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
      className={`group cursor-pointer whitespace-nowrap px-4 py-2.5 text-right transition-colors hover:bg-white/[0.04] ${groupBorder}`}
    >
      <span className={`text-[13px] tabular-nums group-hover:text-white transition-colors ${value != null ? "text-white/80" : "text-white/15"}`}>
        {fmtValue(value, format)}
      </span>
    </td>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ClientOption { id: string; name: string }

export function AdminDataView() {
  const [clients,  setClients]  = useState<ClientOption[]>([])
  const [clientId, setClientId] = useState<string>("")
  const [months,   setMonths]   = useState<string[]>([])
  const [pivot,    setPivot]    = useState<Record<string, Record<string, number | null>>>({})
  const [loading,  setLoading]  = useState(true)
  const [loadingClients, setLoadingClients] = useState(true)

  const activeClient = clients.find(c => c.id === clientId)

  // Cargar lista de clientes una vez
  useEffect(() => {
    (async () => {
      setLoadingClients(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch("/api/admin/clients", {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const json = await res.json()
        const list: ClientOption[] = (json.clients ?? []).map((c: any) => ({ id: c.id, name: c.name }))
        list.sort((a, b) => a.name.localeCompare(b.name))
        setClients(list)
        if (list.length > 0) setClientId(list[0].id)
      } finally { setLoadingClients(false) }
    })()
  }, [])

  const loadReports = useCallback(async (cid: string) => {
    if (!cid) { setMonths([]); setPivot({}); setLoading(false); return }
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
    const header = ["Mes", ...METRIC_ROWS.map(m => m.label)].join(",")
    const dataRows = months.map(m =>
      [fmtMonthLabel(m), ...METRIC_ROWS.map(metric => pivot[m]?.[metric.key] ?? "")].join(",")
    )
    const csv  = [header, ...dataRows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const filename = activeClient ? `smart-scale-${activeClient.name.toLowerCase().replace(/\s+/g, "-")}.csv` : "smart-scale-data.csv"
    Object.assign(document.createElement("a"), { href: url, download: filename }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Adquisition Stats</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {activeClient ? `Datos de ${activeClient.name}` : "Seleccioná un cliente"} · {months.length
              ? `${months.length} ${months.length === 1 ? "mes" : "meses"} · click en cualquier celda para editar`
              : "métricas mensuales"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            disabled={loadingClients || clients.length === 0}
            className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white hover:border-white/20 transition-all disabled:opacity-40 focus:outline-none focus:border-[#ffde21]/50 min-w-[180px]"
          >
            {loadingClients
              ? <option>Cargando…</option>
              : clients.length === 0
                ? <option>Sin clientes</option>
                : clients.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#1c1c1f] text-white">{c.name}</option>
                  ))}
          </select>
          <button
            onClick={() => clientId && loadReports(clientId)}
            disabled={loading || !clientId}
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
                {/* Fila 1: secciones agrupadas con colspan */}
                <tr className="border-b border-white/[0.04]">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 border-r-2 border-[#ffde21]/30 bg-[#1a1a1d] px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffde21]/70 align-bottom min-w-[140px]"
                  >
                    Mes
                  </th>
                  {SECTION_GROUPS.map(group => (
                    <th
                      key={group.label}
                      colSpan={group.metrics.length}
                      className="bg-white/[0.02] px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 border-l border-white/[0.06]"
                    >
                      {group.label}
                    </th>
                  ))}
                </tr>
                {/* Fila 2: labels de cada métrica */}
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {SECTION_GROUPS.map(group =>
                    group.metrics.map((metric, idx) => (
                      <th
                        key={metric.key}
                        className={`px-4 py-3 text-right text-[11px] font-semibold text-white/50 whitespace-nowrap min-w-[120px] ${idx === 0 ? "border-l border-white/[0.06]" : ""}`}
                      >
                        {metric.label}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {months.map(m => (
                  <tr key={m} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                    <td className="sticky left-0 z-10 border-r-2 border-[#ffde21]/30 bg-[#1a1a1d] px-5 py-2.5 text-[13px] font-bold text-[#ffde21] whitespace-nowrap group-hover:bg-[#1f1f23] transition-colors">
                      {fmtMonthLabel(m)}
                    </td>
                    {SECTION_GROUPS.map(group =>
                      group.metrics.map((metric, idx) => (
                        <EditableCell
                          key={metric.key}
                          value={pivot[m]?.[metric.key] ?? null}
                          metricKey={metric.key}
                          month={m}
                          clientId={clientId!}
                          format={metric.format}
                          onSaved={handleSaved}
                          firstInGroup={idx === 0}
                        />
                      ))
                    )}
                  </tr>
                ))}
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
