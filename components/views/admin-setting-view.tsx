"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { Loader2, RefreshCw, Download, ChevronLeft, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { SetterCommissionPanel } from "@/components/admin/setter-commission-panel"

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldKey =
  | "new_conversations_inbound"
  | "new_conversations_outbound"
  | "conversations_replied"
  | "qualified_leads"
  | "offer_docs_sent"
  | "offer_doc_responses"
  | "calls_done"

interface LogEntry {
  id: string
  date: string
  setter_id: string
  setter_name?: string | null
  new_conversations_inbound?: number | null
  new_conversations_outbound?: number | null
  conversations_replied: number | null
  qualified_leads: number | null
  offer_docs_sent: number | null
  offer_doc_responses: number | null
  calls_done: number | null
}

const COLUMNS: { key: FieldKey; label: string; short: string }[] = [
  { key: "new_conversations_inbound",   label: "Inbound",     short: "INBOUND" },
  { key: "new_conversations_outbound",  label: "Outbound",    short: "OUTBOUND" },
  { key: "conversations_replied",       label: "Respondidas", short: "RESPONDIDAS" },
  { key: "qualified_leads",             label: "Leads 4-5",   short: "LEADS" },
  { key: "offer_docs_sent",             label: "Docs Sent",   short: "DOCS" },
  { key: "offer_doc_responses",         label: "Doc Resp.",   short: "DOC RESP" },
  { key: "calls_done",                  label: "Llamadas",    short: "LLAMADAS" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentMonthISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-")
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" }).toUpperCase()
}

function dateLabel(iso: string): string {
  const date = new Date(iso + "T00:00:00")
  const dayName = date.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")
  const dayNum = date.getDate()
  const monthName = date.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")
  return `${dayName} ${dayNum} ${monthName}`
}

function pct(num: number, den: number): string {
  if (!den) return "—"
  return `${Math.round((num / den) * 100)}%`
}

// ─── Editable Cell ────────────────────────────────────────────────────────────

function EditableCell({
  value,
  fieldKey,
  logId,
  onSaved,
}: {
  value: number | null
  fieldKey: FieldKey
  logId: string
  onSaved: (logId: string, field: FieldKey, val: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setDraft(value != null ? String(value) : "")
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const cancel = () => {
    setEditing(false)
    setDraft("")
  }

  const save = async () => {
    const num = draft.trim() === "" ? null : Number(draft)
    if (isNaN(num as number) && num !== null) {
      cancel()
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch("/api/admin/setting/log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: logId, [fieldKey]: num }),
      })
      onSaved(logId, fieldKey, num)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (saving) {
    return (
      <td className="whitespace-nowrap px-3 py-2.5 text-center">
        <Loader2 className="inline h-3 w-3 animate-spin text-[#ffde21]/40" />
      </td>
    )
  }

  if (editing) {
    return (
      <td className="whitespace-nowrap px-2 py-1">
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === "Enter") save()
            if (e.key === "Escape") cancel()
          }}
          className="w-16 rounded-lg border border-[#ffde21]/40 bg-[#ffde21]/[0.07] px-2 py-1.5 text-center text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-[#ffde21]/60"
        />
      </td>
    )
  }

  return (
    <td
      onClick={startEdit}
      title="Click para editar"
      className="group cursor-pointer whitespace-nowrap px-3 py-2.5 text-center transition-colors hover:bg-foreground/[0.04]"
    >
      <span className={`text-[13px] tabular-nums group-hover:text-foreground transition-colors font-medium ${value != null ? "text-foreground/80" : "text-foreground/20"}`}>
        {value != null ? String(value) : "—"}
      </span>
    </td>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminSettingView() {
  const [month, setMonth] = useState(currentMonthISO())
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>("")

  // Cargar los logs del mes seleccionado
  const loadLogs = useCallback(async (ym: string) => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }
      const res = await fetch(`/api/admin/setting/log?month=${encodeURIComponent(ym)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      setLogs(res.ok ? (json.logs ?? []) : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs(month)
  }, [month, loadLogs])

  // Load user profile
  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()
        setUserRole((profile as any)?.role ?? null)
      }
    }
    loadUser()
  }, [])

  // Calcular totales mensuales
  const monthTotals = useMemo(() => {
    const totals: Record<FieldKey, number> = {
      new_conversations_inbound: 0,
      new_conversations_outbound: 0,
      conversations_replied: 0,
      qualified_leads: 0,
      offer_docs_sent: 0,
      offer_doc_responses: 0,
      calls_done: 0,
    }
    for (const log of logs) {
      for (const col of COLUMNS) {
        const val = log[col.key]
        if (val != null) totals[col.key] += val
      }
    }
    return totals
  }, [logs])

  // Calcular rates
  const rates = useMemo(() => {
    const inbound = monthTotals.new_conversations_inbound
    const outbound = monthTotals.new_conversations_outbound
    const replied = monthTotals.conversations_replied
    const leads = monthTotals.qualified_leads
    const docs = monthTotals.offer_docs_sent
    const docResp = monthTotals.offer_doc_responses
    const calls = monthTotals.calls_done

    return {
      responseRate: pct(replied, inbound + outbound),
      outboundRate: pct(replied, outbound),
      qualification: pct(leads, replied),
      docRate: pct(docs, leads),
      docResponseRate: pct(docResp, docs),
      callRate: pct(calls, docResp),
    }
  }, [monthTotals])

  const handleSaved = useCallback((logId: string, field: FieldKey, val: number | null) => {
    setLogs(prev =>
      prev.map(log =>
        log.id === logId ? { ...log, [field]: val } : log
      )
    )
  }, [])

  const changMonth = (delta: number) => {
    const [y, m] = month.split("-")
    const newDate = new Date(Number(y), Number(m) - 1 + delta, 1)
    const newYm = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}`
    setMonth(newYm)
  }

  const exportCsv = () => {
    const header = ["Fecha", "Setter", ...COLUMNS.map(c => c.label)].join(",")
    const dataRows = logs.map(log =>
      [dateLabel(log.date), log.setter_name ?? "—", ...COLUMNS.map(c => log[c.key] ?? "")].join(",")
    )
    const csv = [header, ...dataRows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement("a"), {
      href: url,
      download: `setting-crm-${month}.csv`,
    }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Setting CRM</h1>
          <p className="text-sm text-foreground/40 mt-0.5">Métricas diarias de setter · click en celdas para editar</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => changMonth(-1)} className="h-9 w-9 flex items-center justify-center rounded-lg border border-foreground/10 hover:bg-foreground/5 transition-colors" title="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="px-4 py-2 rounded-lg border border-foreground/10 min-w-[220px] text-center">
            <span className="text-sm font-bold text-foreground">{monthLabel(month)}</span>
          </div>

          <button onClick={() => changMonth(1)} className="h-9 w-9 flex items-center justify-center rounded-lg border border-foreground/10 hover:bg-foreground/5 transition-colors" title="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>

          <button onClick={() => loadLogs(month)} disabled={loading} className="h-9 w-9 flex items-center justify-center rounded-lg border border-foreground/10 hover:bg-foreground/5 transition-colors disabled:opacity-40" title="Recargar">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button onClick={exportCsv} className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-foreground/10 hover:bg-foreground/5 text-sm font-medium transition-colors" title="Descargar CSV">
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Setter Commission Panel */}
      {userId && <SetterCommissionPanel userRole={userRole} userId={userId} month={month} />}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/40" />
        </div>
      ) : (
        <>
          {/* KPIs del mes */}
          {logs.length > 0 && (
            <div>
              <div className="mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-foreground/50">
                  Cómo viene <span className="text-[#ffde21]">{monthLabel(month)}</span>
                </h2>
              </div>

              {/* Totales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
                {[
                  { label: "Inbound", value: monthTotals.new_conversations_inbound },
                  { label: "Outbound", value: monthTotals.new_conversations_outbound },
                  { label: "Respondidas", value: monthTotals.conversations_replied },
                  { label: "Leads", value: monthTotals.qualified_leads },
                  { label: "Docs", value: monthTotals.offer_docs_sent },
                  { label: "Doc Resp.", value: monthTotals.offer_doc_responses },
                  { label: "Calls", value: monthTotals.calls_done },
                ].map(m => (
                  <div key={m.label} className="rounded-xl border border-foreground/10 bg-card px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">{m.label}</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Funnel rates */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: "Response Rate", value: rates.responseRate, hint: "respuestas / (inbound + outbound)" },
                  { label: "Outbound Resp", value: rates.outboundRate, hint: "respuestas / outbound" },
                  { label: "Qualification", value: rates.qualification, hint: "leads / respuestas" },
                  { label: "Doc Rate", value: rates.docRate, hint: "docs / leads" },
                  { label: "Doc Response", value: rates.docResponseRate, hint: "doc resp / docs" },
                  { label: "Call Rate", value: rates.callRate, hint: "calls / doc resp" },
                ].map(m => (
                  <div key={m.label} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-foreground/40">{m.label}</p>
                    <p className="text-lg font-bold text-foreground mt-1 tabular-nums">{m.value}</p>
                    <p className="text-[9px] text-foreground/30 mt-0.5">{m.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabla diaria */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-foreground/50">CRM Diario</h2>
              <span className="text-[10px] text-foreground/40">
                {logs.length} {logs.length === 1 ? "registro" : "registros"}
              </span>
            </div>

            {logs.length === 0 ? (
              <div className="rounded-2xl border border-foreground/10 py-12 text-center">
                <p className="text-sm text-foreground/40">Sin registros cargados para este mes</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-foreground/10 bg-foreground/[0.02]">
                        <th className="sticky left-0 z-10 bg-foreground/[0.02] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/50 min-w-[140px]">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/50 min-w-[100px]">
                          Setter
                        </th>
                        {COLUMNS.map(col => (
                          <th
                            key={col.key}
                            className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/50 min-w-[80px]"
                            title={col.label}
                          >
                            {col.short}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id} className="border-b border-foreground/[0.04] hover:bg-foreground/[0.01] transition-colors">
                          <td className="sticky left-0 z-10 bg-card px-4 py-2.5 font-medium text-[12px] text-foreground/80">
                            {dateLabel(log.date)}
                          </td>
                          <td className="px-4 py-2.5 text-[12px] text-foreground/70">
                            {log.setter_name || "—"}
                          </td>
                          {COLUMNS.map(col => (
                            <EditableCell
                              key={`${log.id}-${col.key}`}
                              value={log[col.key] ?? null}
                              fieldKey={col.key}
                              logId={log.id}
                              onSaved={handleSaved}
                            />
                          ))}
                        </tr>
                      ))}

                      {/* Fila de totales */}
                      <tr className="border-t-2 border-[#ffde21]/30 bg-foreground/[0.05] font-bold">
                        <td className="sticky left-0 z-10 bg-foreground/[0.05] px-4 py-3 text-[12px] uppercase tracking-wide text-foreground/70">
                          Total
                        </td>
                        <td className="px-4 py-3" />
                        {COLUMNS.map(col => (
                          <td key={`total-${col.key}`} className="px-3 py-3 text-center text-[13px] font-bold text-foreground tabular-nums">
                            {monthTotals[col.key]}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
