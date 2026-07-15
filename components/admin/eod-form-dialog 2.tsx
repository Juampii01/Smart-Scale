"use client"

import { useEffect, useState } from "react"
import {
  X, Loader2, Save, Check, AlertCircle, Calendar, Sunset,
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

const FIELDS: { key: FieldKey; label: string; icon: any; hint: string }[] = [
  { key: "new_conversations",     label: "Conversaciones nuevas",  icon: MessageCircle,      hint: "Convos que abriste hoy" },
  { key: "conversations_replied", label: "Respuestas a convos",    icon: MessageCircleReply, hint: "Cuántas respondieron" },
  { key: "qualified_leads",       label: "Leads 4-5 estrellas",    icon: Star,               hint: "Calificaste como prospect" },
  { key: "offer_docs_sent",       label: "Offer docs enviadas",    icon: FileText,           hint: "Documentos enviados" },
  { key: "offer_doc_responses",   label: "Respuestas a offer doc", icon: ArrowDownToLine,    hint: "Respondieron al doc" },
  { key: "calls_done",            label: "Llamadas hechas",        icon: Phone,              hint: "Calls si tenían dudas" },
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

interface EodFormDialogProps {
  open: boolean
  onClose: () => void
  initialDate?: string
  onSaved?: () => void
}

export function EodFormDialog({ open, onClose, initialDate, onSaved }: EodFormDialogProps) {
  const [date, setDate] = useState(initialDate ?? todayISO())
  const [values, setValues] = useState<Record<FieldKey, number>>({
    new_conversations: 0, conversations_replied: 0, qualified_leads: 0,
    offer_docs_sent: 0, offer_doc_responses: 0, calls_done: 0,
  })
  const [notes, setNotes]     = useState("")
  const [saving, setSaving]   = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [isExisting, setIsExisting] = useState(false)
  const [loading, setLoading] = useState(false)

  // Reset cuando se abre
  useEffect(() => {
    if (open) {
      setDate(initialDate ?? todayISO())
      setError(null); setSavedAt(null)
    }
  }, [open, initialDate])

  // Cargar log existente cuando cambia la fecha
  useEffect(() => {
    if (!open) return
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

        const log = (json.logs ?? []).find((l: any) =>
          l.date === date && l.setter_id === session.user.id
        )
        if (log) {
          setIsExisting(true)
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
          setIsExisting(false)
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
  }, [date, open])

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, saving, onClose])

  if (!open) return null

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
      setIsExisting(true)
      onSaved?.()
      // cerrar tras 800ms para mostrar el "Guardado"
      setTimeout(() => onClose(), 800)
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado")
    } finally {
      setSaving(false)
    }
  }

  const totalLoaded = Object.values(values).reduce((a, b) => a + b, 0)

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-popover px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dafc69]/40 bg-[#dafc69]/10">
              <Sunset className="h-5 w-5 text-[#dafc69]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {isExisting ? "Editar día" : "Llenar formulario del día"}
              </h2>
              <p className="mt-0.5 text-[11px] text-foreground/55 capitalize">{fmtDate(date)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1 text-foreground/50 hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Selector de fecha */}
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <Calendar className="h-4 w-4 text-[#dafc69]" />
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={e => setDate(e.target.value)}
              className="h-9 rounded-lg border border-border bg-foreground/[0.03] px-3 text-sm font-semibold text-foreground outline-none focus:border-[#dafc69]/50"
            />
            {isExisting && (
              <span className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground/55">
                Ya cargado
              </span>
            )}
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center text-sm text-foreground/40">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
            </div>
          ) : (
            <>
              {/* Grid de inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS.map(({ key, label, icon: Icon, hint }) => (
                  <label
                    key={key}
                    className="rounded-xl border border-border bg-foreground/[0.02] px-4 py-3 hover:border-[#dafc69]/30 transition-colors cursor-text block"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="h-3.5 w-3.5 text-[#dafc69]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/65">
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
                      className="w-full h-9 rounded-lg border border-transparent bg-transparent px-1 text-2xl font-bold text-foreground tabular-nums outline-none focus:bg-foreground/[0.03]"
                    />
                    <p className="mt-0.5 text-[10px] text-foreground/40">{hint}</p>
                  </label>
                ))}
              </div>

              {/* Notas */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-foreground/55 mb-1.5">
                  Notas <span className="text-foreground/30 normal-case">(opcional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Algo relevante: nichos, copies, observaciones…"
                  className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-[#dafc69]/50 resize-none"
                />
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-2.5 text-xs text-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {savedAt && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-2.5 text-xs font-semibold text-emerald-500">
              <Check className="h-3.5 w-3.5" /> Guardado correctamente
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
            <p className="text-[11px] text-foreground/45">
              {totalLoaded === 0
                ? "Cargá al menos un valor"
                : `Total: ${totalLoaded} eventos`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-border bg-foreground/[0.04] px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-foreground/[0.08] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || loading || totalLoaded === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-[#dafc69] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#f2ffc0] disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Guardando…" : (isExisting ? "Actualizar" : "Guardar día")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
