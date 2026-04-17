"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { ChevronDown, Loader2, RefreshCw, Download } from "lucide-react"

// ─── Metrics definition ───────────────────────────────────────────────────────

const METRICS: Array<{ key: string; label: string; format: "money" | "number" }> = [
  { key: "cash_collected",  label: "Cash Collected",  format: "money"  },
  { key: "total_revenue",   label: "Total Revenue",   format: "money"  },
  { key: "mrr",             label: "MRR",             format: "money"  },
  { key: "new_clients",     label: "New Clients",     format: "number" },
  { key: "ad_spend",        label: "Ad Spend",        format: "money"  },
  { key: "short_followers", label: "Followers IG",    format: "number" },
  { key: "yt_subscribers",  label: "Subs YouTube",    format: "number" },
  { key: "nps_score",       label: "NPS",             format: "number" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonthLabel(month: string) {
  const [year, mon] = String(month).slice(0, 7).split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${names[parseInt(mon, 10) - 1] ?? mon} '${year.slice(2)}`
}

function fmtValue(v: number | null | undefined, format: "money" | "number"): string {
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
  value,
  metricKey,
  month,
  clientId,
  onSaved,
}: {
  value: number | null
  metricKey: string
  month: string
  clientId: string
  onSaved: (month: string, key: string, val: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState("")
  const [saving,  setSaving]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const metric = METRICS.find(m => m.key === metricKey)!

  const startEdit = () => {
    setDraft(value != null ? String(value) : "")
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const cancel = () => { setEditing(false); setDraft("") }

  const save = async () => {
    const num = draft.trim() === "" ? null : Number(draft.replace(/[$,K]/g, ""))
    if (isNaN(num as number) && num !== null) { cancel(); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ client_id: clientId, month, field: metricKey, value: num }),
      })
      onSaved(month, metricKey, num)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (saving) {
    return (
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <span className="inline-flex items-center gap-1 text-[13px] text-[#ffde21]/50">
          <Loader2 className="h-3 w-3 animate-spin" />
        </span>
      </td>
    )
  }

  if (editing) {
    return (
      <td className="whitespace-nowrap px-2 py-1.5">
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === "Enter")  save()
            if (e.key === "Escape") cancel()
          }}
          className="w-28 rounded-lg border border-[#ffde21]/40 bg-[#ffde21]/[0.07] px-2.5 py-1.5 text-right text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-[#ffde21]/60"
        />
      </td>
    )
  }

  return (
    <td
      onClick={startEdit}
      title="Click para editar"
      className="group cursor-pointer whitespace-nowrap px-4 py-3 text-right transition-colors hover:bg-white/[0.04]"
    >
      <span className={`text-[13px] tabular-nums ${value != null ? "text-white/80" : "text-white/20"} group-hover:text-white`}>
        {fmtValue(value, metric.format)}
      </span>
    </td>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminDataView() {
  const [clients,          setClients]          = useState<Array<{ id: string; name: string }>>([])
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [months,           setMonths]           = useState<string[]>([])
  // pivot[month][metricKey] = value
  const [pivot,            setPivot]            = useState<Record<string, Record<string, number | null>>>({})
  const [loading,          setLoading]          = useState(false)
  const [clientsLoading,   setClientsLoading]   = useState(true)

  // ── Load all clients ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("profiles")
          .select("id, client_id, name")
          .order("name", { ascending: true })

        const list = (data ?? []).filter((p: any) => p.client_id)
        const mapped = list.map((p: any) => ({
          id:   p.client_id as string,
          name: p.name ?? `Cliente ${String(p.client_id).slice(0, 8)}`,
        }))
        // Dedupe by client_id
        const seen = new Set<string>()
        const unique = mapped.filter((c: any) => { if (seen.has(c.id)) return false; seen.add(c.id); return true })
        setClients(unique)
        if (unique.length) setSelectedClientId(unique[0].id)
      } finally {
        setClientsLoading(false)
      }
    }
    load()
  }, [])

  // ── Load reports for selected client ─────────────────────────────────────
  const loadReports = useCallback(async (clientId: string) => {
    if (!clientId) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from("monthly_reports")
        .select("month, cash_collected, total_revenue, mrr, new_clients, ad_spend, short_followers, yt_subscribers, nps_score")
        .eq("client_id", clientId)
        .order("month", { ascending: true })

      const rows = data ?? []
      const mths = rows.map((r: any) => String(r.month).slice(0, 7))
      setMonths(mths)

      const pv: Record<string, Record<string, number | null>> = {}
      for (const row of rows) {
        const m = String(row.month).slice(0, 7)
        pv[m] = {}
        for (const metric of METRICS) {
          pv[m][metric.key] = row[metric.key] != null ? Number(row[metric.key]) : null
        }
      }
      setPivot(pv)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedClientId) loadReports(selectedClientId)
  }, [selectedClientId, loadReports])

  // ── Optimistic cell update ────────────────────────────────────────────────
  const handleSaved = useCallback((month: string, key: string, val: number | null) => {
    setPivot(prev => ({
      ...prev,
      [month]: { ...(prev[month] ?? {}), [key]: val },
    }))
  }, [])

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const clientName = clients.find(c => c.id === selectedClientId)?.name ?? "cliente"
    const header = ["Métrica", ...months.map(fmtMonthLabel)].join(",")
    const rows = METRICS.map(m =>
      [m.label, ...months.map(mo => pivot[mo]?.[m.key] ?? "")].join(",")
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement("a"), { href: url, download: `${clientName}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedName = clients.find(c => c.id === selectedClientId)?.name ?? ""

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Tabla de Datos</h1>
          <p className="text-sm text-white/40 mt-0.5">Métricas mensuales por cliente · click en cualquier celda para editar</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Client selector */}
          <div className="relative">
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              disabled={clientsLoading}
              className="h-9 appearance-none cursor-pointer rounded-xl border border-white/[0.08] bg-[#1c1c1f] pl-4 pr-9 text-sm font-medium text-white focus:border-white/20 focus:outline-none disabled:opacity-50"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          </div>

          {/* Refresh */}
          <button
            onClick={() => loadReports(selectedClientId)}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Export CSV */}
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
        {loading || clientsLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/40" />
          </div>
        ) : !months.length ? (
          <div className="flex flex-col items-center gap-2 py-24 text-center">
            <p className="text-sm text-white/30">
              {selectedName ? `${selectedName} no tiene reportes cargados todavía.` : "Seleccioná un cliente."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {/* Sticky metric name column */}
                  <th className="sticky left-0 z-10 bg-[#111113] px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 min-w-[160px]">
                    Métrica
                  </th>
                  {months.map(m => (
                    <th key={m} className="px-4 py-3.5 text-right text-[11px] font-semibold text-white/50 whitespace-nowrap min-w-[110px]">
                      {fmtMonthLabel(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric, i) => (
                  <tr
                    key={metric.key}
                    className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                  >
                    {/* Sticky metric label */}
                    <td className="sticky left-0 z-10 bg-[#111113] px-5 py-3 text-[13px] font-semibold text-white/60 whitespace-nowrap">
                      {metric.label}
                    </td>
                    {months.map(m => (
                      <EditableCell
                        key={m}
                        value={pivot[m]?.[metric.key] ?? null}
                        metricKey={metric.key}
                        month={m}
                        clientId={selectedClientId}
                        onSaved={handleSaved}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-white/20 text-center">
        Click en cualquier número para editarlo · Enter para guardar · Esc para cancelar
      </p>
    </div>
  )
}
