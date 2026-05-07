"use client"

import { useEffect, useState } from "react"
import {
  Loader2, Save, Check, AlertCircle, Calendar, Sunset,
  MessageCircle, MessageCircleReply, Star, FileText, ArrowDownToLine, Phone,
} from "lucide-react"
import { createClient } from "@/lib/supabase"

type FieldKey =
  | "new_conversations"
  | "conversations_replied"
  | "qualified_leads"
  | "offer_docs_sent"
  | "offer_doc_responses"
  | "calls_done"

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

const FIELDS: { key: FieldKey; label: string; icon: any; hint: string }[] = [
  { key: "new_conversations",     label: "Conversaciones nuevas",  icon: MessageCircle,      hint: "Convos que abriste hoy" },
  { key: "conversations_replied", label: "Respuestas a las convos", icon: MessageCircleReply, hint: "Cuántas respondieron" },
  { key: "qualified_leads",       label: "Leads 4-5 estrellas",     icon: Star,               hint: "Calificaste como prospects" },
  { key: "offer_docs_sent",       label: "Offer docs enviadas",     icon: FileText,           hint: "Documentos enviados a leads" },
  { key: "offer_doc_responses",   label: "Respuestas a offer doc",  icon: ArrowDownToLine,    hint: "Cuántos respondieron al doc" },
  { key: "calls_done",            label: "Llamadas hechas",         icon: Phone,              hint: "Llamadas si tenían dudas" },
]

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
}

export function AdminEodView() {
  const [date, setDate]   = useState(todayISO())
  const [values, setValues] = useState<Record<FieldKey, number>>({
    new_conversations: 0, conversations_replied: 0, qualified_leads: 0,
    offer_docs_sent: 0, offer_doc_responses: 0, calls_done: 0,
  })
  const [notes, setNotes]     = useState("")
  const [saving, setSaving]   = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [existing, setExisting] = useState<Log | null>(null)
  const [loading, setLoading] = useState(false)

  // Cuando cambia la fecha, busca si ya existe un log de ese día y precarga
  useEffect(() => {
    let alive = true
    async function fetchLog() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setLoading(false); return }

        const res = await fetch(`/api/admin/setting/log?since=${date}&until=${date}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json()
        if (!alive) return

        const log: Log | undefined = (json.logs ?? []).find((l: Log) => l.date === date && l.setter_id === session.user.id)
        if (log) {
          setExisting(log)
          setValues({
            new_conversations: log.new_conversations,
            conversations_replied: log.conversations_replied,
            qualified_leads: log.qualified_leads,
            offer_docs_sent: log.offer_docs_sent,
            offer_doc_responses: log.offer_doc_responses,
            calls_done: log.calls_done,
          })
          setNotes(log.notes ?? "")
        } else {
          setExisting(null)
          setValues({
            new_conversations: 0, conversations_replied: 0, qualified_leads: 0,
            offer_docs_sent: 0, offer_doc_responses: 0, calls_done: 0,
          })
          setNotes("")
        }
      } finally {
        if (alive) setLoading(false)
      }
    }
    fetchLog()
    return () => { alive = false }
  }, [date])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSaving(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("No hay sesión activa"); setSaving(false); return }

      const res = await fetch("/api/admin/setting/log", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ date, ...values, notes: notes || null }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? "Error al guardar"); setSaving(false); return }
      setSavedAt(Date.now())
      setExisting(json.log)
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado")
    } finally {
      setSaving(false)
    }
  }

  // Agregado simple para mostrar al usuario qué tan completo está el día
  const totalLoaded = Object.values(values).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">End of Day</h1>
        </div>
        <p className="text-xs text-foreground/40 ml-[18px]">
          Cierre del día del setter — los datos se guardan en el Setting CRM.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-6">

        {/* Fecha */}
        <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-[#ffde21]" />
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={e => setDate(e.target.value)}
              className="h-9 rounded-lg border border-border bg-foreground/[0.03] px-3 text-sm font-semibold text-foreground outline-none focus:border-[#ffde21]/50"
            />
            <span className="text-xs text-foreground/45 capitalize">{fmtDate(date)}</span>
            {existing && (
              <span className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground/55">
                Editando registro
              </span>
            )}
          </div>

          {savedAt && (Date.now() - savedAt) < 3000 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
              <Check className="h-3.5 w-3.5" /> Guardado
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-sm text-foreground/40">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
          </div>
        ) : (
          <>
            {/* Grid de inputs grandes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FIELDS.map(({ key, label, icon: Icon, hint }) => (
                <label
                  key={key}
                  className="rounded-xl border border-border bg-foreground/[0.02] px-5 py-4 hover:border-[#ffde21]/30 transition-colors cursor-text block"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-[#ffde21]" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/65">
                      {label}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={values[key] || ""}
                    onChange={e => setValues(v => ({ ...v, [key]: Number(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full h-10 rounded-lg border border-transparent bg-transparent px-1 text-3xl font-bold text-foreground tabular-nums outline-none focus:bg-foreground/[0.03]"
                  />
                  <p className="mt-1 text-[10px] text-foreground/40">{hint}</p>
                </label>
              ))}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-foreground/55 mb-1.5">
                Notas del día <span className="text-foreground/30 normal-case">(opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Algo relevante de hoy: nichos que funcionaron, copies, observaciones, blockers…"
                className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-[#ffde21]/50 resize-none"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-2.5 text-xs text-foreground">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
              <p className="text-[11px] text-foreground/45">
                {totalLoaded === 0
                  ? "Cargá al menos un valor antes de guardar"
                  : `Total acumulado: ${totalLoaded} eventos`}
              </p>
              <button
                type="submit"
                disabled={saving || totalLoaded === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-6 py-3 text-sm font-bold text-black hover:bg-[#ffe84d] disabled:opacity-50 transition-colors"
              >
                {saving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Sunset className="h-4 w-4" />}
                {saving ? "Guardando…" : (existing ? "Actualizar EOD" : "Cerrar día")}
              </button>
            </div>
          </>
        )}
      </form>

      {/* Link al Setting CRM */}
      <p className="text-[11px] text-foreground/40 text-center">
        Para ver el histórico completo y editar días anteriores entrá a <a href="/admin/setting" className="font-bold text-[#ffde21] hover:underline">Setting CRM</a>.
      </p>
    </div>
  )
}
