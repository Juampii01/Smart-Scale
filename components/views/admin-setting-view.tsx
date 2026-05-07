"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Loader2, Sunset, RefreshCw, MessageCircle, MessageCircleReply, Star,
  FileText, ArrowDownToLine, Phone, Pencil, Inbox,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { EodFormDialog } from "@/components/admin/eod-form-dialog"

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

const COLUMNS: { key: FieldKey; short: string; label: string; icon: any }[] = [
  { key: "new_conversations",     short: "Convos",    label: "Convos nuevas",       icon: MessageCircle },
  { key: "conversations_replied", short: "Resp.",     label: "Respuestas",          icon: MessageCircleReply },
  { key: "qualified_leads",       short: "4-5⭐",     label: "Leads 4-5⭐",          icon: Star },
  { key: "offer_docs_sent",       short: "Docs",      label: "Offer docs",          icon: FileText },
  { key: "offer_doc_responses",   short: "Resp. doc", label: "Respuestas a doc",    icon: ArrowDownToLine },
  { key: "calls_done",            short: "Calls",     label: "Llamadas",            icon: Phone },
]

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

function currentMonthISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`
}

function fmtDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-")
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  const dayName = date.toLocaleDateString("es-AR", { weekday: "short" })
  const dayNum = date.getDate()
  const monthName = date.toLocaleDateString("es-AR", { month: "short" })
  return `${dayName.replace(".", "")} ${dayNum} ${monthName.replace(".", "")}`
}

function monthLabel(): string {
  const d = new Date()
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

function pct(num: number, den: number): string {
  if (!den) return "—"
  return `${Math.round((num / den) * 100)}%`
}

export function AdminSettingView() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogDate, setDialogDate] = useState<string | undefined>(undefined)

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

  // Logs del mes en curso (para los KPIs de arriba)
  const monthLogs = useMemo(() => {
    const m = currentMonthISO()
    return logs.filter(l => l.date.startsWith(m))
  }, [logs])

  // Totales del mes por campo
  const monthTotals = useMemo(() => {
    const sum = (k: FieldKey) => monthLogs.reduce((acc, l) => acc + (l[k] ?? 0), 0)
    return {
      new_conversations: sum("new_conversations"),
      conversations_replied: sum("conversations_replied"),
      qualified_leads: sum("qualified_leads"),
      offer_docs_sent: sum("offer_docs_sent"),
      offer_doc_responses: sum("offer_doc_responses"),
      calls_done: sum("calls_done"),
    }
  }, [monthLogs])

  // Funnel rates del mes
  const funnel = useMemo(() => {
    const t = monthTotals
    return [
      { label: "Response rate",      value: pct(t.conversations_replied, t.new_conversations),    hint: "respuestas / convos" },
      { label: "Qualification",      value: pct(t.qualified_leads, t.conversations_replied),       hint: "4-5⭐ / respuestas" },
      { label: "Offer doc rate",     value: pct(t.offer_docs_sent, t.qualified_leads),             hint: "docs / calificados" },
      { label: "Doc response rate",  value: pct(t.offer_doc_responses, t.offer_docs_sent),         hint: "respondieron al doc" },
      { label: "Call rate",          value: pct(t.calls_done, t.offer_doc_responses),              hint: "calls / respuestas" },
    ]
  }, [monthTotals])

  function openForm(date?: string) {
    setDialogDate(date)
    setDialogOpen(true)
  }

  function handleClose() {
    setDialogOpen(false)
    setDialogDate(undefined)
  }

  const today = todayISO()
  const todayLoaded = logs.some(l => l.date === today)

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
            Resumen del mes en curso y registros diarios cargados por el setter.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] transition-colors"
            title="Recargar"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => openForm()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-sm font-bold text-black hover:bg-[#ffe84d] transition-colors"
          >
            <Sunset className="h-4 w-4" />
            Llenar formulario
          </button>
        </div>
      </div>

      {/* KPIs del mes en curso */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground/55">
            Cómo viene <span className="text-[#ffde21]">{monthLabel()}</span>
          </h2>
          <span className="text-[10px] text-foreground/40">
            {monthLogs.length} {monthLogs.length === 1 ? "día cargado" : "días cargados"}
          </span>
        </div>

        {/* Totales por campo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-3">
          {COLUMNS.map(col => {
            const Icon = col.icon
            const value = monthTotals[col.key]
            return (
              <div key={col.key} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="h-3 w-3 text-[#ffde21]" />
                  <p className="text-[10px] uppercase tracking-wider text-foreground/45 truncate">{col.short}</p>
                </div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
              </div>
            )
          })}
        </div>

        {/* Funnel rates del mes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {funnel.map(m => (
            <div key={m.label} className="rounded-xl border border-border bg-foreground/[0.02] px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-foreground/45">{m.label}</p>
              <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{m.value}</p>
              <p className="mt-0.5 text-[10px] text-foreground/35">{m.hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla diaria — solo días con log */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground/55">
            CRM diario
          </h2>
          <span className="text-[10px] text-foreground/40">
            {logs.length} {logs.length === 1 ? "día registrado" : "días registrados"}
            {!todayLoaded && (
              <span className="ml-2 text-[#ffde21]">· hoy aún no cargado</span>
            )}
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 flex items-center justify-center text-sm text-foreground/40">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center justify-center gap-3 text-center">
              <Inbox className="h-8 w-8 text-foreground/20" />
              <div>
                <p className="text-sm font-semibold text-foreground/70">Aún no hay registros</p>
                <p className="mt-1 text-xs text-foreground/40">Llenar el formulario del día para empezar.</p>
              </div>
              <button
                onClick={() => openForm()}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-sm font-bold text-black hover:bg-[#ffe84d] transition-colors"
              >
                <Sunset className="h-4 w-4" /> Llenar formulario
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[#ffde21]/30 bg-foreground/[0.02]">
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-foreground/55 whitespace-nowrap">Fecha</th>
                    {COLUMNS.map(col => {
                      const Icon = col.icon
                      return (
                        <th key={col.key} className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/55 whitespace-nowrap" title={col.label}>
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className="h-3 w-3 text-[#ffde21]" />
                            {col.short}
                          </span>
                        </th>
                      )
                    })}
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const isToday = log.date === today
                    return (
                      <tr
                        key={log.id}
                        onClick={() => openForm(log.date)}
                        className="border-b border-foreground/[0.04] last:border-0 cursor-pointer hover:bg-foreground/[0.04] transition-colors group"
                        title="Click para editar"
                      >
                        <td className={`px-5 py-3 whitespace-nowrap text-[13px] ${
                          isToday ? "font-bold text-[#ffde21]" : "font-semibold text-foreground/85"
                        }`}>
                          {fmtDateLabel(log.date)}
                          {isToday && <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-[#ffde21]/70">Hoy</span>}
                        </td>
                        {COLUMNS.map(col => (
                          <td key={col.key} className="px-3 py-3 text-right tabular-nums text-foreground/85 text-[13px]">
                            {log[col.key]}
                          </td>
                        ))}
                        <td className="pr-4 text-foreground/30 group-hover:text-[#ffde21] transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {logs.length > 0 && (
          <p className="mt-2 text-[10px] text-foreground/35">
            Click en una fila para editar ese día.
          </p>
        )}
      </div>

      {/* Modal */}
      <EodFormDialog
        open={dialogOpen}
        onClose={handleClose}
        initialDate={dialogDate}
        onSaved={loadLogs}
      />
    </div>
  )
}
