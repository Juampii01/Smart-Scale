"use client"

import { Fragment, useEffect, useState } from "react"
import { X, Loader2, Save, Check, AlertCircle, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase"

// ─── Field groups ─────────────────────────────────────────────────────────────

const FIELD_GROUPS = [
  {
    key: "inbound",
    label: "Inbound",
    color: "bg-blue-500",
    fields: [
      { key: "new_conversations_inbound", label: "Conversaciones inbound", hint: "Total recibidas" },
    ],
  },
  {
    key: "outbound",
    label: "Outbound",
    color: "bg-violet-500",
    fields: [
      { key: "new_conversations_outbound", label: "Contactos outbound",  hint: "Leads contactados" },
      { key: "outbound_replies",           label: "Respuestas outbound", hint: "Respondieron" },
    ],
  },
  {
    key: "conversion",
    label: "Conversión",
    color: "bg-[#ffde21]",
    fields: [
      { key: "inbound_applications",  label: "Aplicaciones inbound",    hint: "Formularios / apps" },
      { key: "qualified_leads",       label: "Leads 4-5 estrellas",     hint: "Calificados" },
      { key: "offer_docs_sent",       label: "Offer docs enviados",     hint: "Documentos enviados" },
      { key: "offer_doc_responses",   label: "Respuestas a offer doc",  hint: "Respondieron el doc" },
      { key: "calls_done",            label: "Llamadas hechas",         hint: "Calls completadas" },
      { key: "cierres",               label: "Cierres",                 hint: "Contratos cerrados hoy" },
    ],
  },
] as const

type FieldKey =
  | "new_conversations_inbound"
  | "inbound_applications"
  | "new_conversations_outbound"
  | "outbound_replies"
  | "qualified_leads"
  | "offer_docs_sent"
  | "offer_doc_responses"
  | "calls_done"
  | "cierres"

type FormValues = Record<FieldKey, string>

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

interface EodFormDialogV2Props {
  open: boolean
  onClose: () => void
  initialDate?: string
  logId?: string        // si se pasa → modo edición (muestra botón eliminar)
  onSaved?: () => void
  onDeleted?: () => void
}

export function EodFormDialogV2({ open, onClose, initialDate, logId, onSaved, onDeleted }: EodFormDialogV2Props) {
  const [date, setDate] = useState(initialDate ?? todayISO())
  const [notes, setNotes] = useState("")
  const [values, setValues] = useState<FormValues>({
    new_conversations_inbound:  "",
    inbound_applications:       "",
    new_conversations_outbound: "",
    outbound_replies:           "",
    qualified_leads:            "",
    offer_docs_sent:            "",
    offer_doc_responses:        "",
    calls_done:                 "",
    cierres:                    "",
  })
  const [status,   setStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [deleting, setDeleting] = useState(false)

  // Sync date when dialog opens with a specific initialDate (edit mode)
  useEffect(() => {
    if (open && initialDate) setDate(initialDate)
  }, [open, initialDate])

  // Load existing log for selected date
  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch(`/api/admin/setting/log?since=${date}&until=${date}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(json => {
          const existing = (json.logs ?? []).find((l: any) => l.date === date)
          if (existing) {
            setValues({
              new_conversations_inbound:  String(existing.new_conversations_inbound  ?? ""),
              inbound_applications:       String(existing.inbound_applications       ?? ""),
              new_conversations_outbound: String(existing.new_conversations_outbound ?? ""),
              outbound_replies:           String(existing.outbound_replies           ?? ""),
              qualified_leads:            String(existing.qualified_leads            ?? ""),
              offer_docs_sent:            String(existing.offer_docs_sent            ?? ""),
              offer_doc_responses:        String(existing.offer_doc_responses        ?? ""),
              calls_done:                 String(existing.calls_done                 ?? ""),
              cierres:                    String(existing.cierres                    ?? ""),
            })
            setNotes(existing.notes ?? "")
          } else {
            setValues({
              new_conversations_inbound:  "",
              inbound_applications:       "",
              new_conversations_outbound: "",
              outbound_replies:           "",
              qualified_leads:            "",
              offer_docs_sent:            "",
              offer_doc_responses:        "",
              calls_done:                 "",
              cierres:                    "",
            })
            setNotes("")
          }
        })
        .catch(() => {})
    })
  }, [date, open])

  const handleDelete = async () => {
    if (!logId) return
    if (!window.confirm("¿Eliminar este registro EOD? Esta acción no se puede deshacer.")) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch("/api/admin/setting/log", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: logId }),
      })
      onDeleted?.()
    } catch (err: any) {
      console.error("Error eliminando EOD:", err)
    } finally {
      setDeleting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("saving")
    setErrorMsg("")
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setStatus("error"); setErrorMsg("Sin sesión"); return }

      const fields: Record<string, any> = {}
      for (const [k, v] of Object.entries(values)) {
        fields[k] = v !== "" ? Number(v) : 0
      }

      // Modo edición (logId presente): PATCH por id — preserva el setter_id
      // original de la fila. Si acá se hiciera POST (upsert por setter_id+date),
      // un admin editando el registro de OTRO setter crearía una fila nueva a
      // su propio nombre en vez de actualizar la fila original.
      const res = logId
        ? await fetch("/api/admin/setting/log", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ id: logId, ...fields, notes: notes || null }),
          })
        : await fetch("/api/admin/setting/log", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ date, notes: notes || null, ...fields }),
          })
      const json = await res.json()
      if (!res.ok) { setStatus("error"); setErrorMsg(json?.error ?? "Error al guardar"); return }

      setStatus("saved")
      setTimeout(() => {
        setStatus("idle")
        onSaved?.()
      }, 1200)
    } catch (err: any) {
      setStatus("error")
      setErrorMsg(err?.message ?? "Error inesperado")
    }
  }

  if (!open) return null

  const totalConversaciones =
    (Number(values.new_conversations_inbound) || 0) +
    (Number(values.outbound_replies) || 0)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm py-8 px-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-foreground/[0.08] bg-card shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-foreground/[0.06] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">
              {logId ? "Editar EOD" : "Cargar datos del día"}
            </h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/[0.06] hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">

          {/* Date selector */}
          <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.04),transparent_55%)]" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/35 mb-1.5">Fecha</p>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-2 text-sm font-semibold text-foreground focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20 [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Field groups + computed total */}
          {FIELD_GROUPS.map((group) => (
            <Fragment key={group.key}>
              <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card">
                <div className="flex items-center justify-between border-b border-foreground/[0.05] px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-[2px] rounded-full ${group.color}`} />
                    <span className="text-sm font-semibold uppercase tracking-widest text-foreground/75">{group.label}</span>
                  </div>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <div key={field.key}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/35 mb-1.5">
                        {field.label}
                      </p>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={(values as any)[field.key]}
                        onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="h-10 w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 text-sm font-semibold text-foreground placeholder:text-foreground/20 focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20"
                      />
                      <p className="mt-1 text-[10px] text-foreground/25">{field.hint}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Conversaciones — after outbound, before conversión */}
              {group.key === "outbound" && (
                <div className="relative overflow-hidden rounded-2xl border border-[#ffde21]/25 bg-[#ffde21]/[0.03]">
                  <div className="flex items-center justify-between border-b border-[#ffde21]/15 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-[2px] rounded-full bg-[#ffde21]" />
                      <span className="text-sm font-semibold uppercase tracking-widest text-foreground/75">Total Conversaciones</span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/30">automático</span>
                  </div>
                  <div className="flex items-end gap-4 px-5 py-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/35 mb-1.5">
                        Inbound + Resp. outbound
                      </p>
                      <p className="text-4xl font-bold text-[#ffde21] tabular-nums">
                        {totalConversaciones}
                      </p>
                    </div>
                    <p className="pb-1 text-[11px] text-foreground/30">
                      {values.new_conversations_inbound || "0"} inbound · {values.outbound_replies || "0"} resp. outbound
                    </p>
                  </div>
                </div>
              )}
            </Fragment>
          ))}

          {/* Notas */}
          <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card">
            <div className="flex items-center border-b border-foreground/[0.05] px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-[2px] rounded-full bg-foreground/30" />
                <span className="text-sm font-semibold uppercase tracking-widest text-foreground/75">Notas</span>
              </div>
            </div>
            <div className="p-5">
              <textarea
                rows={3}
                placeholder="Observaciones del día, contexto, bloqueos..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-foreground/20 focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20 resize-none"
              />
            </div>
          </div>

          {/* Error */}
          {status === "error" && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.05] pt-4">
            {/* Delete — solo en modo edición */}
            {logId ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-xl border border-red-500/20 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Eliminar
              </button>
            ) : <span />}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-5 py-2 text-sm font-medium text-foreground/70 transition hover:bg-foreground/[0.08] hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={status === "saving" || status === "saved"}
                className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-5 py-2 text-sm font-bold text-black transition hover:bg-[#ffe84d] disabled:opacity-60"
              >
                {status === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {status === "saved"  && <Check   className="h-3.5 w-3.5" />}
                {status === "idle"   && <Save    className="h-3.5 w-3.5" />}
                {status === "saving" ? "Guardando…" : status === "saved" ? "Guardado ✓" : "Guardar"}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}
