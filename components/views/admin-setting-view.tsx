"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { Loader2, RefreshCw, Download, ChevronLeft, ChevronRight, PlusCircle, TrendingUp, Table2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { viewAsTenantBodyField, viewAsTenantQueryParam } from "@/lib/auth/view-as"
import { SetterCommissionPanel } from "@/components/admin/setter-commission-panel"
import { EodFormDialogV2 } from "@/components/admin/eod-form-dialog-v2"
import { SectionHeader } from "@/components/ui/section-header"
import { StatTile } from "@/components/ui/stat-tile"

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldKey =
  | "new_conversations_inbound"
  | "inbound_qualified"
  | "new_conversations_outbound"
  | "outbound_replies"
  | "outbound_qualified"
  | "inbound_applications"
  | "qualified_leads"
  | "offer_docs_sent"
  | "offer_doc_responses"
  | "cierres"

interface LogEntry {
  id: string
  date: string
  setter_id: string
  setter_name?: string | null
  new_conversations_inbound?: number | null
  inbound_qualified?: number | null
  new_conversations_outbound?: number | null
  outbound_replies?: number | null
  outbound_qualified?: number | null
  inbound_applications?: number | null
  qualified_leads: number | null
  offer_docs_sent: number | null
  offer_doc_responses: number | null
  cierres?: number | null
}

const COLUMNS: { key: FieldKey; label: string; short: string }[] = [
  { key: "new_conversations_inbound",  label: "Inbound",      short: "INBOUND" },
  { key: "inbound_qualified",          label: "Calif. IB",    short: "CALIF IB" },
  { key: "new_conversations_outbound", label: "Outbound",     short: "OUTBOUND" },
  { key: "outbound_replies",           label: "Resp. OB",     short: "RESP OB" },
  { key: "outbound_qualified",         label: "Calif. OB",    short: "CALIF OB" },
  { key: "qualified_leads",            label: "Leads 4-5",    short: "LEADS" },
  { key: "offer_docs_sent",            label: "Docs Sent",    short: "DOCS" },
  { key: "offer_doc_responses",        label: "Doc Resp.",    short: "DOC RESP" },
  { key: "cierres",                    label: "Cierres",      short: "CIERRES" },
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
        body: JSON.stringify({ id: logId, [fieldKey]: num, ...viewAsTenantBodyField() }),
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
        <Loader2 className="inline h-3 w-3 animate-spin text-accent-ink/40" />
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
          className="w-16 rounded-lg border border-border bg-secondary px-2 py-1.5 text-center text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent/20"
        />
      </td>
    )
  }

  return (
    <td
      onClick={e => { e.stopPropagation(); startEdit() }}
      title="Click para editar"
      className="group cursor-pointer whitespace-nowrap px-3 py-2.5 text-center transition-colors hover:bg-foreground/[0.04]"
    >
      <span className={`text-[13px] tabular-nums group-hover:text-foreground transition-colors font-medium ${value != null ? "text-foreground" : "text-text-3"}`}>
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
  const [eodOpen, setEodOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null)
  const [onboardingsCount, setOnboardingsCount] = useState<number | null>(null)

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
      const tenantParam = viewAsTenantQueryParam()
      const url = `/api/admin/setting/log?month=${encodeURIComponent(ym)}${tenantParam ? `&${tenantParam.slice(1)}` : ""}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      setLogs(res.ok ? (json.logs ?? []) : [])
    } finally {
      setLoading(false)
    }
  }, [])

  // Cargar la cantidad real de onboardings completados ese mes (contract_signed_at)
  const loadOnboardingsCount = useCallback(async (ym: string) => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const tenantParam = viewAsTenantQueryParam()
      const url = `/api/admin/setting/onboardings-count?month=${encodeURIComponent(ym)}${tenantParam ? `&${tenantParam.slice(1)}` : ""}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      setOnboardingsCount(res.ok ? (json.count ?? 0) : null)
    } catch {
      setOnboardingsCount(null)
    }
  }, [])

  useEffect(() => {
    loadLogs(month)
    loadOnboardingsCount(month)
  }, [month, loadLogs, loadOnboardingsCount])

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
      new_conversations_inbound:  0,
      inbound_qualified:          0,
      new_conversations_outbound: 0,
      outbound_replies:           0,
      outbound_qualified:         0,
      inbound_applications:       0,
      qualified_leads:            0,
      offer_docs_sent:            0,
      offer_doc_responses:        0,
      cierres:                    0,
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
    const inbound        = monthTotals.new_conversations_inbound
    const outbound       = monthTotals.new_conversations_outbound
    const outboundReplies = monthTotals.outbound_replies
    const totalConv      = inbound + outboundReplies
    const leads          = monthTotals.qualified_leads
    const docs           = monthTotals.offer_docs_sent
    const docResp        = monthTotals.offer_doc_responses
    const inboundQualified  = monthTotals.inbound_qualified
    const outboundQualified = monthTotals.outbound_qualified

    return {
      outboundResponseRate: pct(outboundReplies, outbound),
      qualification:        pct(leads, totalConv),
      docResponseRate:      pct(docResp, docs),
      inboundQualRate:      pct(inboundQualified, inbound),
      outboundQualRate:     pct(outboundQualified, outboundReplies),
      onboardingRate:       onboardingsCount != null ? pct(onboardingsCount, monthTotals.cierres) : "—",
    }
  }, [monthTotals, onboardingsCount])

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
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-foreground tracking-tight">Setting CRM</h1>
          <p className="text-[13px] text-text-2 mt-0.5">Métricas diarias de setter · click en celdas para editar</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de mes — ocupa toda la fila en mobile */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={() => changMonth(-1)} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-border hover:bg-foreground/5 transition-colors" title="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-border min-w-0 sm:min-w-[220px] text-center">
              <span className="text-[13px] font-bold text-foreground">{monthLabel(month)}</span>
            </div>

            <button onClick={() => changMonth(1)} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-border hover:bg-foreground/5 transition-colors" title="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <button onClick={() => loadLogs(month)} disabled={loading} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-border hover:bg-foreground/5 transition-colors disabled:opacity-40" title="Recargar">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button onClick={exportCsv} className="h-9 px-3 shrink-0 flex items-center gap-1.5 rounded-lg border border-border hover:bg-foreground/5 text-[13px] font-medium transition-colors" title="Descargar CSV">
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>

            <button
              onClick={() => setEodOpen(true)}
              className="h-9 px-3 shrink-0 flex items-center gap-1.5 rounded-lg btn-accent text-[13px] font-bold transition-colors"
              title="Cargar datos diarios"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              EOD
            </button>
          </div>
        </div>
      </div>

      {/* Setter Commission Panel */}
      {userId && <SetterCommissionPanel userRole={userRole} userId={userId} month={month} />}

      {/* EOD Form Dialog — nuevo registro */}
      <EodFormDialogV2
        open={eodOpen}
        onClose={() => setEodOpen(false)}
        onSaved={() => { setEodOpen(false); loadLogs(month) }}
      />

      {/* EOD Form Dialog — editar registro existente */}
      <EodFormDialogV2
        open={editingLog !== null}
        onClose={() => setEditingLog(null)}
        initialDate={editingLog?.date}
        logId={editingLog?.id}
        onSaved={() => { setEditingLog(null); loadLogs(month) }}
        onDeleted={() => {
          setLogs(prev => prev.filter(l => l.id !== editingLog?.id))
          setEditingLog(null)
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-accent-ink/40" />
        </div>
      ) : (
        <>
          {/* KPIs del mes */}
          {logs.length > 0 && (
            <div>
              <SectionHeader
                icon={TrendingUp}
                title={`Cómo viene ${monthLabel(month)}`}
                className="mb-4"
              />

              {/* Totales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
                <StatTile label="Inbound"     value={monthTotals.new_conversations_inbound} />
                <StatTile label="Calif. IB"   value={monthTotals.inbound_qualified} />
                <StatTile label="Outbound"    value={monthTotals.new_conversations_outbound} />
                <StatTile label="Calif. OB"   value={monthTotals.outbound_qualified} />
                <StatTile label="Total Conv." value={monthTotals.new_conversations_inbound + monthTotals.outbound_replies} highlight />
                <StatTile label="Leads"       value={monthTotals.qualified_leads} />
                <StatTile label="Docs"        value={monthTotals.offer_docs_sent} />
                <StatTile label="Doc Resp."   value={monthTotals.offer_doc_responses} />
                <StatTile label="Cierres"     value={monthTotals.cierres} />
              </div>

              {/* Funnel rates */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <StatTile label="Outbound Response"  displayValue={rates.outboundResponseRate} hint="resp. outbound / contactos outbound" />
                <StatTile label="Outbound Calificación" displayValue={rates.outboundQualRate}  hint="calif. outbound / resp. outbound" />
                <StatTile label="Inbound Calificación"  displayValue={rates.inboundQualRate}   hint="calif. inbound / inbound" />
                <StatTile label="Qualification"      displayValue={rates.qualification}        hint="leads / total conversaciones" />
                <StatTile label="Doc Response"       displayValue={rates.docResponseRate}      hint="doc resp / docs" />
                <StatTile label="Onboarding Rate"    displayValue={rates.onboardingRate}       hint={`onboardings reales (${onboardingsCount ?? "—"}) / cierres cargados`} />
              </div>
            </div>
          )}

          {/* Tabla diaria */}
          <div>
            <SectionHeader
              icon={Table2}
              title="CRM Diario"
              action={
                <span className="text-[13px] text-text-2">
                  {logs.length} {logs.length === 1 ? "registro" : "registros"}
                </span>
              }
              className="mb-3"
            />

            {logs.length === 0 ? (
              <div className="rounded-[14px] border border-border py-12 text-center">
                <p className="text-[13px] text-text-2">Sin registros cargados para este mes</p>
              </div>
            ) : (
              <>
              {/* Mobile / tablet: cards apilados (sin scroll horizontal) */}
              <div className="md:hidden space-y-2.5">
                {logs.map(log => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setEditingLog(log)}
                    className="w-full text-left rounded-[14px] border border-border bg-card p-4 transition-colors hover:bg-foreground/[0.03] active:scale-[0.99]"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-foreground">{dateLabel(log.date)}</span>
                      <span className="truncate text-[13px] text-text-2">{log.setter_name || "—"}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {COLUMNS.map(col => (
                        <div key={col.key} className="rounded-lg border border-border bg-foreground/[0.02] px-2.5 py-2">
                          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-text-3" title={col.label}>{col.short}</p>
                          <p className="mt-0.5 text-[15px] font-bold tabular-nums text-foreground">
                            {log[col.key] != null ? log[col.key] : "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}

                {/* Total del mes */}
                <div className="rounded-[14px] border-2 border-accent/40 bg-foreground/[0.04] p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-text-2">Total del mes</p>
                  <div className="grid grid-cols-3 gap-2">
                    {COLUMNS.map(col => (
                      <div key={`m-total-${col.key}`} className="rounded-lg bg-foreground/[0.03] px-2.5 py-2">
                        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-text-3" title={col.label}>{col.short}</p>
                        <p className="mt-0.5 text-[15px] font-bold tabular-nums text-foreground">{monthTotals[col.key]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Desktop: tabla completa */}
              <div className="hidden md:block overflow-hidden rounded-[14px] border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-foreground/[0.02]">
                        <th className="sticky left-0 z-10 bg-foreground/[0.02] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-text-2 min-w-[140px]">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-text-2 min-w-[100px]">
                          Setter
                        </th>
                        {COLUMNS.map(col => (
                          <th
                            key={col.key}
                            className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-text-2 min-w-[80px]"
                            title={col.label}
                          >
                            {col.short}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id} onClick={() => setEditingLog(log)} className="border-b border-border hover:bg-foreground/[0.04] cursor-pointer transition-colors group">
                          <td className="sticky left-0 z-10 bg-card group-hover:bg-foreground/[0.04] px-4 py-2.5 font-medium text-[13px] text-foreground">
                            {dateLabel(log.date)}
                          </td>
                          <td className="px-4 py-2.5 text-[13px] text-foreground">
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
                      <tr className="border-t-2 border-accent/40 bg-foreground/[0.05] font-bold">
                        <td className="sticky left-0 z-10 bg-foreground/[0.05] px-4 py-3 text-[13px] uppercase tracking-wide text-foreground">
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
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
