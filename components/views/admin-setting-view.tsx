"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { Loader2, RefreshCw, Download, ChevronLeft, ChevronRight, PlusCircle, Pencil, Trash2, X, Save } from "lucide-react"
import { createPortal } from "react-dom"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { SetterCommissionPanel } from "@/components/admin/setter-commission-panel"
import { EodFormDialogV2 } from "@/components/admin/eod-form-dialog-v2"

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldKey =
  | "new_conversations_inbound"
  | "new_conversations_outbound"
  | "outbound_replies"
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
  outbound_replies: number | null
  qualified_leads: number | null
  offer_docs_sent: number | null
  offer_doc_responses: number | null
  calls_done: number | null
}

const COLUMNS: { key: FieldKey; label: string; short: string }[] = [
  { key: "new_conversations_inbound",  label: "Inbound",        short: "INBOUND" },
  { key: "new_conversations_outbound", label: "Outbound",       short: "OUTBOUND" },
  { key: "outbound_replies",           label: "Resp. Outbound", short: "RESP OUT" },
  { key: "qualified_leads",            label: "Leads 4-5",      short: "LEADS" },
  { key: "offer_docs_sent",            label: "Docs Sent",      short: "DOCS" },
  { key: "offer_doc_responses",        label: "Doc Resp.",       short: "DOC RESP" },
  { key: "calls_done",                 label: "Llamadas",       short: "LLAMADAS" },
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

// ─── Edit/Delete Log Modal ────────────────────────────────────────────────────

const ALL_EDIT_FIELDS: { key: FieldKey | "notes"; label: string }[] = [
  { key: "new_conversations_inbound",  label: "Inbound" },
  { key: "new_conversations_outbound", label: "Outbound" },
  { key: "outbound_replies",           label: "Resp. Outbound" },
  { key: "qualified_leads",            label: "Leads 4-5⭐" },
  { key: "offer_docs_sent",            label: "Offer docs enviados" },
  { key: "offer_doc_responses",        label: "Resp. offer doc" },
  { key: "calls_done",                 label: "Llamadas" },
  { key: "notes",                      label: "Notas" },
]

function EditLogModal({
  log,
  onClose,
  onSaved,
  onDeleted,
}: {
  log: LogEntry
  onClose: () => void
  onSaved: (updated: LogEntry) => void
  onDeleted: (id: string) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({
    new_conversations_inbound:  String(log.new_conversations_inbound  ?? ""),
    new_conversations_outbound: String(log.new_conversations_outbound ?? ""),
    outbound_replies:           String(log.outbound_replies           ?? ""),
    qualified_leads:            String(log.qualified_leads            ?? ""),
    offer_docs_sent:            String(log.offer_docs_sent            ?? ""),
    offer_doc_responses:        String(log.offer_doc_responses        ?? ""),
    calls_done:                 String(log.calls_done                 ?? ""),
    notes:                      (log as any).notes ?? "",
  })
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sin sesión"); return }

      const body: Record<string, any> = { id: log.id, notes: values.notes || null }
      for (const f of COLUMNS.map(c => c.key)) {
        body[f] = values[f] !== "" ? Number(values[f]) : 0
      }

      const res = await fetch("/api/admin/setting/log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const j = await res.json(); setError(j?.error ?? "Error"); return }

      const updated: LogEntry = {
        ...log,
        new_conversations_inbound:  body.new_conversations_inbound  ?? null,
        new_conversations_outbound: body.new_conversations_outbound ?? null,
        outbound_replies:           body.outbound_replies           ?? null,
        qualified_leads:            body.qualified_leads            ?? null,
        offer_docs_sent:            body.offer_docs_sent            ?? null,
        offer_doc_responses:        body.offer_doc_responses        ?? null,
        calls_done:                 body.calls_done                 ?? null,
      }
      onSaved(updated)
      onClose()
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sin sesión"); return }

      const res = await fetch("/api/admin/setting/log", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: log.id }),
      })
      if (!res.ok) { const j = await res.json(); setError(j?.error ?? "Error"); return }
      onDeleted(log.id)
      onClose()
    } finally { setDeleting(false) }
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-foreground/[0.08] bg-card shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-foreground/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Editar registro</p>
            <p className="text-sm font-semibold text-foreground">{dateLabel(log.date)} · {log.setter_name ?? "—"}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/[0.06] hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-3 p-5">
          {ALL_EDIT_FIELDS.filter(f => f.key !== "notes").map(f => (
            <div key={f.key}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-foreground/35">{f.label}</p>
              <input
                type="number" min="0"
                value={values[f.key]}
                onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                className="h-9 w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-3 text-sm text-foreground focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20"
              />
            </div>
          ))}
          <div className="col-span-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-foreground/35">Notas</p>
            <textarea
              rows={2}
              value={values.notes}
              onChange={e => setValues(p => ({ ...p, notes: e.target.value }))}
              className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2 text-sm text-foreground resize-none focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20"
            />
          </div>
        </div>

        {error && (
          <p className="mx-5 mb-3 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-[12px] text-red-700 dark:text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-foreground/[0.06] px-5 py-4">
          {/* Delete */}
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)} className="flex items-center gap-1.5 rounded-xl border border-red-500/20 px-3 py-2 text-[12px] font-semibold text-red-700 dark:text-red-400 hover:bg-red-500/[0.08] transition-colors">
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-foreground/60">¿Seguro?</span>
              <button onClick={handleDelete} disabled={deleting} className="rounded-xl bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sí, eliminar"}
              </button>
              <button onClick={() => setConfirmDel(false)} className="rounded-xl border border-foreground/10 px-3 py-1.5 text-[12px] text-foreground/60 hover:bg-foreground/[0.05] transition-colors">
                Cancelar
              </button>
            </div>
          )}

          {/* Save */}
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-[13px] font-bold text-black hover:bg-[#ffe84d] disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminSettingView() {
  const [month, setMonth] = useState(currentMonthISO())
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>("")
  const [eodOpen, setEodOpen] = useState(false)
  const [editLog, setEditLog] = useState<LogEntry | null>(null)

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
      outbound_replies: 0,
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
    const outboundReplies = monthTotals.outbound_replies
    const leads = monthTotals.qualified_leads
    const docs = monthTotals.offer_docs_sent
    const docResp = monthTotals.offer_doc_responses
    const calls = monthTotals.calls_done

    return {
      responseRate: pct(outboundReplies, inbound + outbound),
      outboundRate: pct(outboundReplies, outbound),
      qualification: pct(leads, outboundReplies),
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

  const handleEditSaved = useCallback((updated: LogEntry) => {
    setLogs(prev => prev.map(log => log.id === updated.id ? updated : log))
  }, [])

  const handleDeleted = useCallback((id: string) => {
    setLogs(prev => prev.filter(log => log.id !== id))
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

          <button
            onClick={() => setEodOpen(true)}
            className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-[#ffde21] hover:bg-[#ffe84d] text-black text-sm font-bold transition-colors"
            title="Cargar datos diarios"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            EOD
          </button>
        </div>
      </div>

      {/* Setter Commission Panel */}
      {userId && <SetterCommissionPanel userRole={userRole} userId={userId} month={month} />}

      {/* Edit Log Modal */}
      {editLog && (
        <EditLogModal
          log={editLog}
          onClose={() => setEditLog(null)}
          onSaved={handleEditSaved}
          onDeleted={handleDeleted}
        />
      )}

      {/* EOD Form Dialog */}
      <EodFormDialogV2
        open={eodOpen}
        onClose={() => setEodOpen(false)}
        onSaved={() => { setEodOpen(false); loadLogs(month) }}
      />

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
                  { label: "Resp. Out", value: monthTotals.outbound_replies },
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
                        <th className="px-3 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id} className="border-b border-foreground/[0.04] hover:bg-foreground/[0.01] transition-colors group">
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
                          <td className="px-2 py-2.5 text-right">
                            <button
                              onClick={() => setEditLog(log)}
                              title="Editar / Eliminar"
                              className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-foreground/30 hover:bg-foreground/[0.06] hover:text-foreground transition-all"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </td>
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
                        <td />
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
