"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { Loader2, Plus, Pencil, Trash2, RefreshCw, X, Save, Check } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id:          string
  title:       string
  description: string | null
  day_of_week: string | null
  time:        string | null
  tz_label:    string
  zoom_url:    string | null
  passcode:    string | null
  status:      string
  recurrence:  string
  sort_order:  number
}

const DAYS    = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
const STATUS  = ["active", "cancelled", "tbd"]
const RECURR  = ["weekly", "monthly_last", "once"]

const RECURR_LABEL: Record<string, string> = {
  weekly:       "Semanal",
  monthly_last: "Último viernes del mes",
  once:         "Evento único",
}

const STATUS_STYLE: Record<string, string> = {
  active:    "bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
  cancelled: "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25",
  tbd:       "bg-foreground/5 text-foreground/50 border-foreground/10",
}

const EMPTY: Omit<CalendarEvent, "id"> = {
  title: "", description: "", day_of_week: "Lunes", time: "3:00 PM",
  tz_label: "Miami", zoom_url: "", passcode: "",
  status: "active", recurrence: "weekly", sort_order: 0,
}

// ─── Event Modal ──────────────────────────────────────────────────────────────

function EventModal({
  event,
  onClose,
  onSave,
}: {
  event: Partial<CalendarEvent> | null
  onClose: () => void
  onSave: (data: Partial<CalendarEvent>) => Promise<void>
}) {
  const isEdit = !!event?.id
  const [form, setForm] = useState<Omit<CalendarEvent, "id">>(
    event ? { ...EMPTY, ...event } : { ...EMPTY }
  )
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const set = (k: keyof typeof EMPTY, v: string | number) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave({ ...form, id: event?.id })
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 900)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "h-9 w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 text-[13px] text-foreground placeholder:text-foreground/20 focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20"
  const selectCls = `${inputCls} appearance-none cursor-pointer`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-foreground/[0.08] bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-foreground/[0.06] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">
              {isEdit ? "Editar llamada" : "Nueva llamada"}
            </h2>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/35">Título *</p>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Q&A: Ads · Content · Mindset" className={inputCls} />
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/35">Host / Descripción</p>
            <input value={form.description ?? ""} onChange={e => set("description", e.target.value)} placeholder="Con Ann Sahakyan" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/35">Día</p>
              <select value={form.day_of_week ?? ""} onChange={e => set("day_of_week", e.target.value)} className={selectCls}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/35">Hora</p>
              <input value={form.time ?? ""} onChange={e => set("time", e.target.value)} placeholder="3:00 PM" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/35">Recurrencia</p>
              <select value={form.recurrence} onChange={e => set("recurrence", e.target.value)} className={selectCls}>
                {RECURR.map(r => <option key={r} value={r}>{RECURR_LABEL[r]}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/35">Estado</p>
              <select value={form.status} onChange={e => set("status", e.target.value)} className={selectCls}>
                {STATUS.map(s => <option key={s} value={s}>{s === "active" ? "Activo" : s === "cancelled" ? "Cancelado" : "Próximamente"}</option>)}
              </select>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/35">Zoom URL</p>
            <input value={form.zoom_url ?? ""} onChange={e => set("zoom_url", e.target.value)} placeholder="https://us06web.zoom.us/j/..." className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/35">Código Zoom</p>
              <input value={form.passcode ?? ""} onChange={e => set("passcode", e.target.value)} placeholder="123456" className={inputCls} />
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/35">Orden</p>
              <input type="number" value={form.sort_order} onChange={e => set("sort_order", Number(e.target.value))} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-foreground/[0.06] px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-4 py-2 text-sm font-medium text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved || !form.title.trim()}
            className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-sm font-bold text-black hover:bg-[#ffe84d] disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminCalendarView() {
  const [events,    setEvents]    = useState<CalendarEvent[]>([])
  const [loading,   setLoading]   = useState(true)
  const [deletingId,setDeletingId]= useState<string | null>(null)
  const [modal,     setModal]     = useState<Partial<CalendarEvent> | null | false>(false)

  const getToken = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res  = await fetch("/api/admin/calendar-events", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      setEvents(json.events ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const handleSave = async (data: Partial<CalendarEvent>) => {
    const token = await getToken()
    if (!token) return
    if (data.id) {
      await fetch("/api/admin/calendar-events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      })
    } else {
      await fetch("/api/admin/calendar-events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      })
    }
    await fetchEvents()
  }

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`¿Eliminar "${title}"? No se puede deshacer.`)) return
    setDeletingId(id)
    const token = await getToken()
    if (token) {
      await fetch("/api/admin/calendar-events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      })
    }
    setEvents(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  const DAY_ORDER: Record<string, number> = {
    Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4,
    Viernes: 5, Sábado: 6, Domingo: 7,
  }

  const sorted = [...events].sort((a, b) => {
    const oa = DAY_ORDER[a.day_of_week ?? ""] ?? 99
    const ob = DAY_ORDER[b.day_of_week ?? ""] ?? 99
    return oa !== ob ? oa - ob : a.sort_order - b.sort_order
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Agenda</h1>
          <p className="text-sm text-foreground/40 mt-0.5">Llamadas semanales del programa · se actualiza en tiempo real para los clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchEvents} disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] text-foreground/40 hover:text-foreground transition-colors disabled:opacity-40">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setModal({})}
            className="flex items-center gap-2 h-9 rounded-xl bg-[#ffde21] px-4 text-sm font-bold text-black hover:bg-[#ffe84d] transition-colors">
            <Plus className="h-4 w-4" />
            Nueva llamada
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-[#ffde21]/40" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center text-sm text-foreground/25">
            No hay llamadas. Agregá la primera con el botón amarillo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
                  {["Día", "Título", "Hora", "Recurrencia", "Estado", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/25 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(ev => (
                  <tr key={ev.id} className="border-b border-foreground/[0.04] hover:bg-foreground/[0.02] transition-colors group">
                    <td className="px-4 py-3 text-[13px] font-semibold text-foreground whitespace-nowrap">
                      {ev.day_of_week ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-foreground">{ev.title}</p>
                      {ev.description && <p className="text-[11px] text-foreground/40">{ev.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-foreground/60 whitespace-nowrap">
                      {ev.time ? `${ev.time} ${ev.tz_label}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-foreground/50 whitespace-nowrap">
                      {RECURR_LABEL[ev.recurrence] ?? ev.recurrence}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[ev.status] ?? ""}`}>
                        {ev.status === "active" ? "Activo" : ev.status === "cancelled" ? "Cancelado" : "Próximamente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setModal(ev)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06] transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(ev.id, ev.title)} disabled={deletingId === ev.id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
                          {deletingId === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal !== false && (
        <EventModal
          event={modal}
          onClose={() => setModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
