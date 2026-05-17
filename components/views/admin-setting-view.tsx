"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { Loader2, RefreshCw, Download, ChevronLeft, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldKey =
  | "new_conversations"
  | "conversations_replied"
  | "qualified_leads"
  | "offer_docs_sent"
  | "offer_doc_responses"
  | "calls_done"

interface LogEntry {
  date: string
  setter_id: string
  new_conversations: number | null
  conversations_replied: number | null
  qualified_leads: number | null
  offer_docs_sent: number | null
  offer_doc_responses: number | null
  calls_done: number | null
}

const COLUMNS: { key: FieldKey; label: string; short: string }[] = [
  { key: "new_conversations",     label: "Convos nuevas",        short: "Convos" },
  { key: "conversations_replied", label: "Respuestas",           short: "Resp." },
  { key: "qualified_leads",       label: "Leads 4-5⭐",          short: "4-5⭐" },
  { key: "offer_docs_sent",       label: "Offer Docs enviados",  short: "Docs" },
  { key: "offer_doc_responses",   label: "Respuestas a docs",    short: "Resp. doc" },
  { key: "calls_done",            label: "Llamadas realizadas",  short: "Calls" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentMonthISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-")
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-")
  return new Date(Number(y), Number(m), 0).getDate()
}

function dayLabel(day: number): string {
  return String(day).padStart(2, "0")
}

// ─── Editable Cell ────────────────────────────────────────────────────────────

function EditableCell({
  value,
  fieldKey,
  fullDate,
  onSaved,
}: {
  value: number | null
  fieldKey: FieldKey
  fullDate: string   // YYYY-MM-DD
  onSaved: (date: string, field: FieldKey, val: number | null) => void
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
        body: JSON.stringify({ date: fullDate, field: fieldKey, value: num }),
      })
      onSaved(fullDate, fieldKey, num)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (saving) {
    return (
      <td className="whitespace-nowrap px-4 py-2.5 text-right">
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
          className="w-20 rounded-lg border border-[#ffde21]/40 bg-[#ffde21]/[0.07] px-2.5 py-1.5 text-right text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-[#ffde21]/60"
        />
      </td>
    )
  }

  return (
    <td
      onClick={startEdit}
      title="Click para editar"
      className="group cursor-pointer whitespace-nowrap px-4 py-2.5 text-right transition-colors hover:bg-foreground/[0.04]"
    >
      <span className={`text-[13px] tabular-nums group-hover:text-foreground transition-colors ${value != null ? "text-foreground/80" : "text-foreground/15"}`}>
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Cargar el ID del usuario actual
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data?.user?.id ?? null))
  }, [])

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

  // Pivotar los logs: dayStr (DD) → { field → value }
  // Usamos solo el día como clave para la tabla
  const pivot = useMemo(() => {
    const p: Record<string, Record<FieldKey, number | null>> = {}
    for (const log of logs) {
      const dayStr = log.date.slice(-2) // "2025-05-17" → "17"
      p[dayStr] = {}
      for (const col of COLUMNS) {
        p[dayStr][col.key] = log[col.key] ?? null
      }
    }
    return p
  }, [logs])

  // Calcular totales mensuales
  const monthTotals = useMemo(() => {
    const totals: Record<FieldKey, number> = {
      new_conversations: 0,
      conversations_replied: 0,
      qualified_leads: 0,
      offer_docs_sent: 0,
      offer_doc_responses: 0,
      calls_done: 0,
    }
    for (const log of logs) {
      for (const col of COLUMNS) {
        if (log[col.key] != null) totals[col.key] += log[col.key]
      }
    }
    return totals
  }, [logs])

  const handleSaved = useCallback((date: string, field: FieldKey, val: number | null) => {
    // date es YYYY-MM-DD completo; log.date también es YYYY-MM-DD
    setLogs(prev =>
      prev.map(log =>
        log.date === date ? { ...log, [field]: val } : log
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
    const days = daysInMonth(month)
    const header = ["Día", ...COLUMNS.map(c => c.label), ""].join(",")
    const dataRows: string[] = []
    for (let d = 1; d <= days; d++) {
      const dayStr = dayLabel(d)
      const row = [dayStr, ...COLUMNS.map(c => pivot[dayStr]?.[c.key] ?? "")]
      dataRows.push(row.join(","))
    }
    const totalsRow = ["TOTAL", ...COLUMNS.map(c => monthTotals[c.key])]
    const csv = [header, ...dataRows, totalsRow.join(",")].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    Object.assign(document.createElement("a"), {
      href: url,
      download: `setting-crm-${month}.csv`,
    }).click()
    URL.revokeObjectURL(url)
  }

  const days = daysInMonth(month)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Setting CRM</h1>
          <p className="text-sm text-foreground/40 mt-0.5">
            Tabla diaria de métricas de setter · click en cualquier celda para editar
          </p>
        </div>

        {/* Controles: mes selector + botones */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changMonth(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] text-foreground/40 hover:text-foreground transition-all"
            title="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] min-w-[200px] justify-center">
            <span className="text-sm font-semibold text-foreground capitalize">{monthLabel(month)}</span>
          </div>

          <button
            onClick={() => changMonth(1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] text-foreground/40 hover:text-foreground transition-all"
            title="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => loadLogs(month)}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] text-foreground/40 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40"
            title="Recargar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={exportCsv}
            className="flex items-center gap-2 h-9 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-4 text-sm font-medium text-foreground/50 hover:text-foreground hover:border-foreground/20 transition-all"
            title="Descargar CSV"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/40" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                {/* Header row con labels de métricas */}
                <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
                  <th className="sticky left-0 z-20 border-r-2 border-[#ffde21]/30 bg-foreground/[0.02] px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffde21]/70 min-w-[80px]">
                    Día
                  </th>
                  {COLUMNS.map((col, idx) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-right text-[11px] font-semibold text-foreground/50 whitespace-nowrap min-w-[100px] ${idx === 0 ? "border-l border-foreground/[0.06]" : ""}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Filas para cada día del mes */}
                {Array.from({ length: days }, (_, i) => {
                  const day = i + 1
                  const dayStr = dayLabel(day)
                  const fullDate = `${month}-${dayStr}`
                  return (
                    <tr key={day} className="border-b border-foreground/[0.04] hover:bg-foreground/[0.02] transition-colors">
                      <td className="sticky left-0 z-10 bg-card px-5 py-3.5 border-r border-foreground/[0.08] font-semibold text-[13px] text-foreground/70">
                        {dayStr}
                      </td>
                      {COLUMNS.map((col, idx) => (
                        <EditableCell
                          key={`${day}-${col.key}`}
                          value={pivot[dayStr]?.[col.key] ?? null}
                          fieldKey={col.key}
                          fullDate={fullDate}
                          onSaved={handleSaved}
                        />
                      ))}
                    </tr>
                  )
                })}

                {/* Fila de totales */}
                <tr className="border-t-2 border-[#ffde21]/30 bg-foreground/[0.04] font-bold">
                  <td className="sticky left-0 z-10 bg-foreground/[0.04] px-5 py-3.5 border-r border-foreground/[0.08] text-[13px] text-foreground/70 uppercase tracking-wide">
                    Total
                  </td>
                  {COLUMNS.map(col => (
                    <td key={`total-${col.key}`} className="whitespace-nowrap px-4 py-3.5 text-right text-[13px] text-foreground tabular-nums">
                      {monthTotals[col.key]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
