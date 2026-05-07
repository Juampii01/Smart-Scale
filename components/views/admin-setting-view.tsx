"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Loader2, MessageCircle, MessageCircleReply, Star, FileText,
  ArrowDownToLine, Phone, TrendingUp, RefreshCw, Plus,
} from "lucide-react"
import { createClient } from "@/lib/supabase"

type Log = {
  id: string
  setter_id: string
  date: string
  new_conversations: number
  conversations_replied: number
  qualified_leads: number
  offer_docs_sent: number
  offer_doc_responses: number
  calls_done: number
  notes: string | null
  created_at: string
  updated_at: string
}

type FieldKey =
  | "new_conversations"
  | "conversations_replied"
  | "qualified_leads"
  | "offer_docs_sent"
  | "offer_doc_responses"
  | "calls_done"

const COLUMNS: { key: FieldKey; label: string; short: string; icon: any }[] = [
  { key: "new_conversations",     label: "Convos nuevas",       short: "Convos",    icon: MessageCircle },
  { key: "conversations_replied", label: "Respuestas a convos", short: "Resp.",     icon: MessageCircleReply },
  { key: "qualified_leads",       label: "Leads 4-5 ⭐",         short: "4-5⭐",     icon: Star },
  { key: "offer_docs_sent",       label: "Offer docs enviadas", short: "Docs",      icon: FileText },
  { key: "offer_doc_responses",   label: "Respuestas a doc",    short: "Resp. doc", icon: ArrowDownToLine },
  { key: "calls_done",            label: "Llamadas",            short: "Calls",     icon: Phone },
]

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

function isoMinusDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

function fmtDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-")
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  const dayName = date.toLocaleDateString("es-AR", { weekday: "short" })
  const dayNum = date.getDate()
  const monthName = date.toLocaleDateString("es-AR", { month: "short" })
  return `${dayName} ${dayNum} ${monthName}`
}

function pct(num: number, den: number): string {
  if (!den) return "—"
  return `${Math.round((num / den) * 100)}%`
}

// ─── Editable cell ────────────────────────────────────────────────────────────

function EditableCell({
  value, date, field, onSaved, isToday,
}: {
  value:   number | null
  date:    string
  field:   FieldKey
  onSaved: (date: string, field: FieldKey, val: number) => Promise<void> | void
  isToday: boolean
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
    const num = draft.trim() === "" ? 0 : Number(draft)
    if (isNaN(num) || num < 0) { cancel(); return }
    setSaving(true)
    try {
      await onSaved(date, field, Math.floor(num))
    } finally { setSaving(false); setEditing(false) }
  }

  if (saving) return (
    <td className="whitespace-nowrap px-4 py-2.5 text-right">
      <Loader2 className="inline h-3 w-3 animate-spin text-[#ffde21]/60" />
    </td>
  )

  if (editing) return (
    <td className="whitespace-nowrap px-2 py-1">
      <input
        ref={inputRef}
        type="number"
        min={0}
        step={1}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel() }}
        className="w-20 rounded-lg border border-[#ffde21]/50 bg-[#ffde21]/[0.07] px-2.5 py-1.5 text-right text-[13px] text-foreground tabular-nums focus:outline-none focus:ring-1 focus:ring-[#ffde21]/60"
      />
    </td>
  )

  return (
    <td
      onClick={startEdit}
      title="Click para editar"
      className="group cursor-pointer whitespace-nowrap px-4 py-2.5 text-right transition-colors hover:bg-foreground/[0.05]"
    >
      <span className={`text-[13px] tabular-nums transition-colors ${
        value != null && value > 0
          ? (isToday ? "font-bold text-foreground" : "text-foreground/85")
          : "text-foreground/20"
      }`}>
        {value != null ? value : "—"}
      </span>
    </td>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AdminSettingView() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [daysShown, setDaysShown] = useState(30)

  async function loadLogs() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const res = await fetch("/api/admin/setting/log", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (res.ok) setLogs(json.logs ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLogs() }, [])

  // Map { date → log } para lookup rápido
  const logByDate = useMemo(() => {
    const m = new Map<string, Log>()
    logs.forEach(l => m.set(l.date, l))
    return m
  }, [logs])

  // Días a mostrar: today, today-1, ..., today-(N-1)
  const visibleDates = useMemo(() => {
    return Array.from({ length: daysShown }, (_, i) => isoMinusDays(i))
  }, [daysShown])

  const today = todayISO()

  async function handleCellSave(date: string, field: FieldKey, val: number) {
    const existing = logByDate.get(date)
    const row = {
      date,
      new_conversations: existing?.new_conversations ?? 0,
      conversations_replied: existing?.conversations_replied ?? 0,
      qualified_leads: existing?.qualified_leads ?? 0,
      offer_docs_sent: existing?.offer_docs_sent ?? 0,
      offer_doc_responses: existing?.offer_doc_responses ?? 0,
      calls_done: existing?.calls_done ?? 0,
      notes: existing?.notes ?? null,
      [field]: val,
    }

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch("/api/admin/setting/log", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(row),
    })
    if (res.ok) {
      const json = await res.json()
      const saved: Log = json.log
      setLogs(prev => {
        const others = prev.filter(l => l.date !== saved.date)
        return [saved, ...others].sort((a, b) => b.date.localeCompare(a.date))
      })
    }
  }

  // Métricas calculadas (últimos 30 logs)
  const funnel = useMemo(() => {
    const recent = logs.slice(0, 30)
    const sum = (k: FieldKey) => recent.reduce((acc, l) => acc + (l[k] ?? 0), 0)
    const totalConvos    = sum("new_conversations")
    const totalReplies   = sum("conversations_replied")
    const totalQualified = sum("qualified_leads")
    const totalOffers    = sum("offer_docs_sent")
    const totalOfferReps = sum("offer_doc_responses")
    const totalCalls     = sum("calls_done")

    return [
      { label: "Response rate",      value: pct(totalReplies, totalConvos),    hint: "respuestas / convos" },
      { label: "Qualification",      value: pct(totalQualified, totalReplies), hint: "4-5⭐ / respuestas" },
      { label: "Offer doc rate",     value: pct(totalOffers, totalQualified),  hint: "docs / calificados" },
      { label: "Doc response rate",  value: pct(totalOfferReps, totalOffers),  hint: "respondieron al doc" },
      { label: "Call rate",          value: pct(totalCalls, totalOfferReps),   hint: "llamadas / respuestas" },
    ]
  }, [logs])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">Setting CRM</h1>
          </div>
          <p className="text-xs text-foreground/40 ml-[18px]">
            Carga diaria del setter — click en cualquier celda para editar
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] transition-colors"
          title="Recargar datos"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recargar
        </button>
      </div>

      {/* Funnel rates */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-[#ffde21]" />
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground/55">
            Funnel últimos 30 días
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {funnel.map(m => (
            <div key={m.label} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-foreground/45">{m.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{m.value}</p>
              <p className="mt-0.5 text-[10px] text-foreground/35">{m.hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla pivot */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="px-6 py-16 flex items-center justify-center text-sm text-foreground/40">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/95 backdrop-blur-sm">
                <tr className="border-b-2 border-[#ffde21]/30">
                  <th className="sticky left-0 z-10 bg-card px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-foreground/55 whitespace-nowrap">
                    Fecha
                  </th>
                  {COLUMNS.map(col => {
                    const Icon = col.icon
                    return (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-foreground/55 whitespace-nowrap"
                        title={col.label}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Icon className="h-3 w-3 text-[#ffde21]" />
                          {col.short}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleDates.map(date => {
                  const log = logByDate.get(date)
                  const isToday = date === today
                  return (
                    <tr
                      key={date}
                      className="border-b border-foreground/[0.04] last:border-0 group"
                    >
                      <td className={`sticky left-0 z-10 border-r-2 border-[#ffde21]/30 bg-card px-5 py-2.5 text-[13px] whitespace-nowrap ${
                        isToday ? "font-bold text-[#ffde21]" : "font-semibold text-foreground/80"
                      }`}>
                        {fmtDateLabel(date)}
                        {isToday && <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-[#ffde21]/70">Hoy</span>}
                      </td>
                      {COLUMNS.map(col => (
                        <EditableCell
                          key={col.key}
                          value={log?.[col.key] ?? null}
                          date={date}
                          field={col.key}
                          isToday={isToday}
                          onSaved={handleCellSave}
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

      {/* Cargar más */}
      <div className="flex justify-center">
        <button
          onClick={() => setDaysShown(n => n + 30)}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-foreground/[0.03] px-4 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Cargar 30 días más
        </button>
      </div>
    </div>
  )
}
