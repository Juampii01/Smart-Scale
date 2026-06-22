"use client"

import { useEffect, useState, useCallback, Fragment } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Trash2, RefreshCw, Download, X, Star, Plus,
  Instagram, ExternalLink, ChevronRight,
} from "lucide-react"
import { PurchasedToggle } from "@/components/admin/purchased-toggle"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id:         string
  name:       string | null
  email:      string | null
  tag:        string | null
  source:     string | null
  lead_type:  string | null
  status:     string
  instagram:  string | null
  rating:     number | null
  niche:      string | null
  notes:      string | null
  purchased:  boolean
  created_at: string
  custom_fields?: Record<string, any> | null
}

// Columna custom (definición compartida, estilo Airtable)
interface LeadColumn {
  id:       string
  key:      string
  label:    string
  type:     "text" | "number"
  position: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

// ─── Pills de categoría (color determinístico por valor, estilo Airtable) ───────

const TAG_COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-300",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300",
  "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300",
]
function tagColor(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}
function Pill({ value }: { value: string | null }) {
  if (!value || !value.trim()) return <span className="text-foreground/25 text-[13px]">—</span>
  return (
    <span className={`inline-block max-w-[180px] truncate rounded-md px-2 py-0.5 text-[12px] font-medium align-middle ${tagColor(value.trim().toLowerCase())}`}>
      {value}
    </span>
  )
}

// ─── Vistas rápidas + agrupación ────────────────────────────────────────────────

type ViewId = "calificados" | "cinco" | "compraron" | "todos"
const VIEWS: { id: ViewId; label: string }[] = [
  { id: "calificados", label: "Calificados · 4–5★" },
  { id: "cinco",       label: "5 estrellas" },
  { id: "compraron",   label: "Compraron" },
  { id: "todos",       label: "Todos" },
]

type GroupId = "none" | "lead_type" | "niche" | "source" | "status"
const GROUPS: { id: GroupId; label: string }[] = [
  { id: "none",      label: "Sin agrupar" },
  { id: "lead_type", label: "Tipo de lead" },
  { id: "niche",     label: "Nicho" },
  { id: "source",    label: "Fuente" },
  { id: "status",    label: "Estado" },
]

// ─── Celda editable para columnas custom ────────────────────────────────────────

function CustomCell({ value, type, onSave }: {
  value: any; type: "text" | "number"; onSave: (v: string) => void
}) {
  return (
    <input
      type={type === "number" ? "number" : "text"}
      defaultValue={value ?? ""}
      onClick={e => e.stopPropagation()}
      onBlur={e => onSave(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
      placeholder="—"
      className="w-full min-w-[90px] rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] text-foreground placeholder:text-foreground/30 hover:border-foreground/[0.08] focus:border-foreground/20 focus:bg-foreground/[0.03] focus:outline-none transition-all"
    />
  )
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({
  value, onChange, size = "sm",
}: {
  value:    number | null
  onChange: (n: number) => void
  size?:    "sm" | "md"
}) {
  const [hover, setHover] = useState<number | null>(null)
  const dim    = size === "md" ? "h-5 w-5" : "h-4 w-4"
  const active = hover ?? value ?? 0

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? 0 : star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(null)}
          className="transition-transform hover:scale-110 focus:outline-none focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-[#ffde21]/40 focus-visible:ring-offset-1 rounded-sm"
        >
          <Star className={`${dim} transition-colors ${
            star <= active ? "fill-amber-400 text-amber-400" : "fill-transparent text-foreground/20"
          }`} />
        </button>
      ))}
    </div>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ lead, onClose, onPatch, onDelete, deleting }: {
  lead:     Lead
  onClose:  () => void
  onPatch:  (id: string, updates: Partial<Lead>) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const ig = lead.instagram?.replace("@", "")

  const textField = (label: string, key: keyof Lead, placeholder: string) => (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">{label}</p>
      <input
        type="text"
        defaultValue={(lead[key] as string) ?? ""}
        placeholder={placeholder}
        onBlur={e    => onPatch(lead.id, { [key]: e.target.value || null })}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
        className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all"
      />
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[440px] flex-col border-l border-foreground/[0.08] shadow-2xl" style={{ backgroundColor: "var(--card)" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-foreground/[0.06] px-6 py-5" style={{ backgroundColor: "var(--card)" }}>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{lead.name ?? "Lead"}</h2>
            <p className="text-[12px] text-foreground/35 mt-0.5">{fmtDate(lead.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onDelete(lead.id)} disabled={deleting} aria-label="Eliminar lead"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/20 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition-all disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde21]/40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose} aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde21]/40">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Rating + tag + instagram */}
        <div className="border-b border-foreground/[0.06] px-6 py-4 space-y-3" style={{ backgroundColor: "var(--card)" }}>
          <div className="flex items-center justify-between">
            <StarRating size="md" value={lead.rating}
              onChange={n => onPatch(lead.id, { rating: n || null })} />
            {lead.tag && (
              <span className="rounded-full border border-amber-500 bg-amber-100 px-3 py-0.5 text-[11px] font-bold text-amber-900 dark:border-[#ffde21]/20 dark:bg-[#ffde21]/[0.06] dark:text-[#ffde21]/70">
                {lead.tag}
              </span>
            )}
          </div>
          {ig && (
            <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[13px] text-pink-700 hover:text-pink-900 dark:text-pink-300/70 dark:hover:text-pink-300 transition-colors">
              <Instagram className="h-4 w-4 shrink-0" />
              @{ig}
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          )}
        </div>

        {/* Editable fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ backgroundColor: "var(--card)" }}>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Estado</p>
            <input
              type="text"
              defaultValue={lead.status !== "nuevo" ? lead.status : ""}
              placeholder="ej: caliente, en proceso, cerrado..."
              onBlur={e    => onPatch(lead.id, { status: e.target.value || "nuevo" })}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
              className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all"
            />
          </div>

          {textField("Desde dónde llegó", "source",    "ej: Instagram, Podcast, Referido...")}
          {textField("Tipo de lead",       "lead_type", "ej: Orgánico, Paid, DM...")}
          {textField("Nicho",              "niche",     "ej: Fitness, Finanzas, Coaches...")}
          {textField("Instagram",          "instagram", "@usuario")}
          {textField("Email",              "email",     "correo@ejemplo.com")}

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Algo acerca del lead</p>
            <textarea
              defaultValue={lead.notes ?? ""}
              placeholder="Observaciones, contexto, intereses..."
              rows={4}
              onBlur={e    => onPatch(lead.id, { notes: e.target.value || null })}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) (e.target as HTMLTextAreaElement).blur() }}
              className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all"
            />
          </div>

        </div>
      </div>
    </>
  )
}

// ─── New Lead Modal ───────────────────────────────────────────────────────────

function NewLeadModal({
  onClose,
  onCreate,
  creating,
}: {
  onClose:  () => void
  onCreate: (data: Partial<Lead>) => Promise<void>
  creating: boolean
}) {
  const [name,      setName]      = useState("")
  const [instagram, setInstagram] = useState("")
  const [tag,       setTag]       = useState("")
  const [rating,    setRating]    = useState<number>(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onCreate({ name: name.trim(), instagram: instagram || null, tag: tag || null, rating: rating || null })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-[14px] border border-foreground/[0.10] shadow-2xl p-6 space-y-4"
          style={{ backgroundColor: "var(--card)" }}
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-foreground">Nuevo lead</h3>
            <button type="button" onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Nombre *</p>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Instagram</p>
            <input
              type="text"
              value={instagram}
              onChange={e => setInstagram(e.target.value)}
              placeholder="@usuario"
              className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Tag</p>
            <input
              type="text"
              value={tag}
              onChange={e => setTag(e.target.value)}
              placeholder="ej: HOT, Cold, DM..."
              className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Calificación</p>
            <StarRating size="md" value={rating || null} onChange={n => setRating(n === rating ? 0 : n)} />
          </div>

          <button
            type="submit"
            disabled={!name.trim() || creating}
            className="w-full h-10 rounded-xl bg-[#ffde21] text-black text-[13px] font-bold hover:bg-[#ffe84d] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear lead
          </button>
        </form>
      </div>
    </>
  )
}

// ─── New Column Modal ─────────────────────────────────────────────────────────

function ColumnModal({ onClose, onCreate, creating }: {
  onClose: () => void
  onCreate: (label: string, type: "text" | "number") => Promise<void>
  creating: boolean
}) {
  const [label, setLabel] = useState("")
  const [type, setType]   = useState<"text" | "number">("text")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    await onCreate(label.trim(), type)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-[14px] border border-foreground/[0.10] shadow-2xl p-6 space-y-4"
          style={{ backgroundColor: "var(--card)" }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-foreground">Nueva columna</h3>
            <button type="button" onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Nombre de la columna *</p>
            <input
              autoFocus type="text" value={label} onChange={e => setLabel(e.target.value)}
              placeholder="ej: Presupuesto, Ciudad, Objeción..."
              className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Tipo</p>
            <div className="flex gap-2">
              {([["text", "Texto"], ["number", "Número"]] as const).map(([val, lbl]) => (
                <button key={val} type="button" onClick={() => setType(val)}
                  className={`flex-1 h-9 rounded-xl border text-[13px] font-semibold transition-all ${
                    type === val
                      ? "border-[#ffde21]/50 bg-[#ffde21]/[0.08] text-foreground"
                      : "border-foreground/[0.08] text-foreground/45 hover:text-foreground hover:border-foreground/20"
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={!label.trim() || creating}
            className="w-full h-10 rounded-xl bg-[#ffde21] text-black text-[13px] font-bold hover:bg-[#ffe84d] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear columna
          </button>
        </form>
      </div>
    </>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AdminLeadsView() {
  const [leads,        setLeads]        = useState<Lead[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<Lead | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [search,       setSearch]       = useState("")
  const [view,         setView]         = useState<ViewId>("calificados")
  const [groupBy,      setGroupBy]      = useState<GroupId>("none")
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set())
  const [showNewForm,  setShowNewForm]  = useState(false)
  const [creating,     setCreating]     = useState(false)
  // Columnas custom (estilo Airtable)
  const [customCols,   setCustomCols]   = useState<LeadColumn[]>([])
  const [showColModal, setShowColModal] = useState(false)
  const [creatingCol,  setCreatingCol]  = useState(false)

  const getSession = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/leads", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      setLeads(json.leads ?? [])
    } finally { setLoading(false) }
  }, [])

  const fetchCols = useCallback(async () => {
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/lead-columns", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      setCustomCols(json.columns ?? [])
    } catch { /* tabla aún no migrada — sin columnas custom */ }
  }, [])

  useEffect(() => { fetchLeads(); fetchCols() }, [fetchLeads, fetchCols])

  const addColumn = async (label: string, type: "text" | "number") => {
    setCreatingCol(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/lead-columns", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body:    JSON.stringify({ label, type }),
      })
      const json = await res.json()
      if (res.ok && json.column) {
        setCustomCols(prev => [...prev, json.column])
        setShowColModal(false)
      } else {
        alert(json.error ?? "No se pudo crear la columna.")
      }
    } finally {
      setCreatingCol(false)
    }
  }

  const deleteColumn = async (col: LeadColumn) => {
    if (!window.confirm(`¿Eliminar la columna "${col.label}"? Los datos cargados en ella se ocultan.`)) return
    setCustomCols(prev => prev.filter(c => c.id !== col.id))
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/lead-columns", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id: col.id }),
    })
  }

  const patchCustom = (lead: Lead, key: string, value: string) => {
    const next = { ...(lead.custom_fields ?? {}), [key]: value === "" ? null : value }
    patch(lead.id, { custom_fields: next })
  }

  const handleCreate = async (data: Partial<Lead>) => {
    setCreating(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/leads", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body:    JSON.stringify(data),
      })
      const json = await res.json()
      if (res.ok && json.lead) {
        setLeads(prev => [json.lead, ...prev])
        setShowNewForm(false)
      }
    } finally {
      setCreating(false)
    }
  }

  const patch = async (id: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...updates } : prev)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/leads", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id, ...updates }),
    })
  }

  const handleDelete = async (id: string) => {
    const lead = leads.find(l => l.id === id)
    const name = lead?.name?.trim() || "este lead"
    if (!window.confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return
    setDeletingId(id)
    const session = await getSession()
    if (!session) { setDeletingId(null); return }
    await fetch("/api/admin/leads", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id }),
    })
    setLeads(prev => prev.filter(l => l.id !== id))
    if (selected?.id === id) setSelected(null)
    setDeletingId(null)
  }

  const exportCsv = () => {
    const header = ["Nombre","Email","Tag","Desde dónde llegó","Tipo","Estado","Compró","Instagram","Rating","Nicho","Notas","Fecha", ...customCols.map(c => c.label)].join(",")
    const rows = filtered.map(l =>
      [l.name, l.email, l.tag, l.source, l.lead_type, l.status, l.purchased ? "Sí" : "No", l.instagram, l.rating, l.niche, l.notes, l.created_at,
        ...customCols.map(c => l.custom_fields?.[c.key])]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv  = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement("a"), { href: url, download: "leads.csv" }).click()
    URL.revokeObjectURL(url)
  }

  const filtered = leads.filter(l => {
    if (view === "calificados" && (l.rating === null || l.rating < 4)) return false
    if (view === "cinco"       && l.rating !== 5) return false
    if (view === "compraron"   && !l.purchased) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [l.name, l.tag, l.instagram, l.niche, l.lead_type, l.source, l.status]
      .some(v => v?.toLowerCase().includes(q))
  })

  // Agrupación (estilo Airtable): [{ key, label, leads }]
  const groups = (() => {
    if (groupBy === "none") return [{ key: "__all__", label: "", leads: filtered }]
    const map = new Map<string, Lead[]>()
    for (const l of filtered) {
      const raw = (l[groupBy as keyof Lead] as string | null)?.trim()
      const key = raw && raw !== "nuevo" ? raw : "Sin asignar"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(l)
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] === "Sin asignar" ? 1 : b[0] === "Sin asignar" ? -1 : b[1].length - a[1].length))
      .map(([key, leads]) => ({ key, label: key, leads }))
  })()

  const toggleGroup = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhooks/lead`)
  }, [])

  // Columnas: 10 fijas + N custom + 1 (botón "+" / chevron)
  const colCount = 11 + customCols.length
  const headRow = (
    <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
      {["#","Nombre","Desde dónde","Tipo","Nicho","Instagram","Rating","Estado","Compró","Fecha"].map(h => (
        <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/40 whitespace-nowrap">{h}</th>
      ))}
      {customCols.map(col => (
        <th key={col.id} className="group/col px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/40 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            {col.label}
            <button onClick={() => deleteColumn(col)} title="Eliminar columna"
              className="opacity-0 group-hover/col:opacity-100 text-foreground/30 hover:text-red-600 dark:hover:text-red-400 transition-opacity">
              <X className="h-3 w-3" />
            </button>
          </span>
        </th>
      ))}
      <th className="px-3 py-3 text-left">
        <button onClick={() => setShowColModal(true)} title="Agregar columna"
          className="flex h-6 w-6 items-center justify-center rounded-md border border-foreground/[0.12] text-foreground/40 hover:text-foreground hover:border-foreground/30 transition-colors">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </th>
    </tr>
  )

  return (
    <>
      {showNewForm && (
        <NewLeadModal
          onClose={() => setShowNewForm(false)}
          onCreate={handleCreate}
          creating={creating}
        />
      )}

      {showColModal && (
        <ColumnModal
          onClose={() => setShowColModal(false)}
          onCreate={addColumn}
          creating={creatingCol}
        />
      )}

      {selected && (
        <DetailDrawer
          lead={selected}
          onClose={() => setSelected(null)}
          onPatch={patch}
          onDelete={handleDelete}
          deleting={deletingId === selected.id}
        />
      )}

      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Leads</h1>
            <p className="text-sm text-foreground/40 mt-0.5">{leads.length} leads</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchLeads} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] text-foreground/40 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={exportCsv} disabled={!filtered.length}
              className="flex items-center gap-2 h-9 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-4 text-sm font-medium text-foreground/50 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40">
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 h-9 rounded-xl bg-[#ffde21] px-4 text-sm font-bold text-black hover:bg-[#ffe84d] transition-all">
              <Plus className="h-3.5 w-3.5" />
              Nuevo lead
            </button>
          </div>
        </div>

        {/* Webhook card */}
        <div className="rounded-[14px] border border-foreground/[0.07] bg-card px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mb-2">
            Webhook URL — ManyChat / Zapier
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-foreground/[0.04] px-3 py-2 text-[12px] text-[#ffde21]/70 font-mono truncate" suppressHydrationWarning>
              {webhookUrl ?? "Cargando…"}
            </code>
            <button
              onClick={() => webhookUrl && navigator.clipboard.writeText(webhookUrl)}
              disabled={!webhookUrl}
              className="shrink-0 h-8 rounded-lg border border-foreground/[0.08] px-3 text-[12px] text-foreground/40 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40"
            >
              Copiar
            </button>
          </div>
          <p className="text-[11px] text-foreground/25 mt-1.5">
            Campos: <code className="text-foreground/40">name</code>, <code className="text-foreground/40">tag</code>, <code className="text-foreground/40">instagram</code>
          </p>
        </div>

        {/* Toolbar estilo Airtable: vistas + buscar + agrupar */}
        <div className="space-y-3">
          {/* Vistas rápidas */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-foreground/[0.06] pb-3">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`inline-flex items-center gap-1.5 h-8 rounded-lg px-3 text-[12.5px] font-semibold transition-all ${
                  view === v.id
                    ? "bg-[#ffde21] text-black"
                    : "text-foreground/45 hover:text-foreground hover:bg-foreground/[0.05]"
                }`}>
                {(v.id === "calificados" || v.id === "cinco") && (
                  <Star className={`h-3 w-3 ${view === v.id ? "fill-black text-black" : "fill-transparent text-amber-500"}`} />
                )}
                {v.label}
              </button>
            ))}
          </div>

          {/* Buscar + agrupar */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, tag, nicho, instagram..."
              className="h-9 rounded-xl border border-foreground/[0.08] bg-card px-4 text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/20 focus:outline-none flex-1 min-w-[220px] max-w-sm"
            />
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-foreground/40 whitespace-nowrap">Agrupar por</span>
              <select
                value={groupBy}
                onChange={e => setGroupBy(e.target.value as GroupId)}
                className="h-9 rounded-xl border border-foreground/[0.08] bg-card px-3 text-[13px] font-medium text-foreground focus:border-foreground/20 focus:outline-none">
                {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
            <span className="ml-auto text-[12px] tabular-nums text-foreground/35">{filtered.length} de {leads.length}</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-[14px] border border-foreground/[0.08] bg-card">
          {loading ? (
            <div className="overflow-x-auto" style={{ backgroundColor: "var(--card)" }}>
              <table className="w-full border-collapse">
                <thead>
                  {headRow}
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-foreground/[0.04]">
                      {Array.from({ length: colCount }).map((_, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="h-3 skeleton rounded" style={{ width: `${45 + (i * 13 + j * 7) % 50}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ backgroundColor: "var(--card)" }}>
              <table className="w-full border-collapse">
                <thead>
                  {headRow}
                </thead>
                <tbody>
                  {!filtered.length ? (
                    <tr><td colSpan={colCount} className="py-16 text-center text-sm text-foreground/25">
                      {leads.length ? "No hay leads con esa búsqueda." : "Todavía no hay leads. Conectá ManyChat al webhook."}
                    </td></tr>
                  ) : (() => {
                    let n = 0
                    return groups.map(group => {
                      const isCollapsed = collapsed.has(group.key)
                      return (
                        <Fragment key={group.key}>
                          {groupBy !== "none" && (
                            <tr className="border-y border-foreground/[0.06] bg-foreground/[0.03]">
                              <td colSpan={colCount} className="px-3 py-2">
                                <button type="button" onClick={() => toggleGroup(group.key)}
                                  className="flex items-center gap-2 focus:outline-none">
                                  <ChevronRight className={`h-3.5 w-3.5 text-foreground/40 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                                  {group.label === "Sin asignar"
                                    ? <span className="text-[12.5px] font-semibold text-foreground/45">Sin asignar</span>
                                    : <Pill value={group.label} />}
                                  <span className="text-[11px] tabular-nums text-foreground/35">{group.leads.length}</span>
                                </button>
                              </td>
                            </tr>
                          )}
                          {!isCollapsed && group.leads.map(lead => {
                            n += 1
                            const rowNum = n
                            return (
                              <tr key={lead.id}
                                onClick={() => setSelected(lead)}
                                className="border-b border-foreground/[0.04] cursor-pointer transition-colors group bg-card hover:bg-muted">

                                <td className="w-10 px-3 py-3 text-[12px] tabular-nums text-foreground/30">{rowNum}</td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-[14px] font-semibold text-foreground">{lead.name ?? <span className="text-foreground/30">—</span>}</span>
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap"><Pill value={lead.source} /></td>
                                <td className="px-4 py-3 whitespace-nowrap"><Pill value={lead.lead_type} /></td>
                                <td className="px-4 py-3 whitespace-nowrap"><Pill value={lead.niche} /></td>

                                <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                  {lead.instagram
                                    ? <a href={`https://instagram.com/${lead.instagram.replace("@","")}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-[13px] text-pink-700 hover:text-pink-900 dark:text-pink-300 dark:hover:text-pink-200 transition-colors">
                                        <Instagram className="h-3.5 w-3.5 shrink-0" />
                                        {lead.instagram}
                                      </a>
                                    : <span className="text-foreground/30 text-[13px]">—</span>}
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                  <StarRating value={lead.rating}
                                    onChange={r => patch(lead.id, { rating: r || null })} />
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap"><Pill value={lead.status !== "nuevo" ? lead.status : null} /></td>

                                <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                  <PurchasedToggle value={!!lead.purchased} onChange={v => patch(lead.id, { purchased: v })} />
                                </td>

                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-[12px] text-foreground/60">{fmtDate(lead.created_at)}</span>
                                </td>

                                {customCols.map(col => (
                                  <td key={col.id} className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                    <CustomCell
                                      value={lead.custom_fields?.[col.key]}
                                      type={col.type}
                                      onSave={v => patchCustom(lead, col.key, v)}
                                    />
                                  </td>
                                ))}

                                <td className="px-4 py-3 whitespace-nowrap">
                                  <ChevronRight className="h-4 w-4 text-foreground/25 group-hover:text-foreground/60 transition-colors" />
                                </td>
                              </tr>
                            )
                          })}
                        </Fragment>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
