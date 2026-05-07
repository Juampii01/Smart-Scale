"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Trash2, RefreshCw, Download, X, Star, Plus,
  Instagram, ExternalLink, ChevronRight,
} from "lucide-react"

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
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
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
          className="transition-transform hover:scale-110 focus:outline-none"
        >
          <Star className={`${dim} transition-colors ${
            star <= active ? "fill-amber-400 text-amber-400" : "fill-transparent text-foreground/20"
          }`} />
        </button>
      ))}
    </div>
  )
}

// ─── Inline editable text ─────────────────────────────────────────────────────

function InlineField({ value, placeholder, onSave }: {
  value:       string | null
  placeholder: string
  onSave:      (v: string) => void
}) {
  return (
    <input
      type="text"
      defaultValue={value ?? ""}
      placeholder={placeholder}
      onBlur={e    => onSave(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
      className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] text-foreground placeholder:text-foreground/45 hover:border-foreground/[0.08] focus:border-foreground/20 focus:bg-foreground/[0.03] focus:outline-none transition-all"
    />
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
            <button onClick={() => onDelete(lead.id)} disabled={deleting}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06] transition-all">
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
          className="w-full max-w-sm rounded-2xl border border-foreground/[0.10] shadow-2xl p-6 space-y-4"
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

// ─── Main View ────────────────────────────────────────────────────────────────

export function AdminLeadsView() {
  const [leads,        setLeads]        = useState<Lead[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<Lead | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [search,       setSearch]       = useState("")
  // -1 = solo 4-5 estrellas (default), 0 = todas, 1-5 = exacto
  const [filterRating, setFilterRating] = useState<number>(-1)
  const [showNewForm,  setShowNewForm]  = useState(false)
  const [creating,     setCreating]     = useState(false)

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

  useEffect(() => { fetchLeads() }, [fetchLeads])

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
    const header = ["Nombre","Email","Tag","Desde dónde llegó","Tipo","Estado","Instagram","Rating","Nicho","Notas","Fecha"].join(",")
    const rows = filtered.map(l =>
      [l.name, l.email, l.tag, l.source, l.lead_type, l.status, l.instagram, l.rating, l.niche, l.notes, l.created_at]
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
    if (filterRating === -1 && (l.rating === null || l.rating < 4)) return false
    if (filterRating > 0 && l.rating !== filterRating) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [l.name, l.tag, l.instagram, l.niche, l.lead_type, l.source, l.status]
      .some(v => v?.toLowerCase().includes(q))
  })

  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhooks/lead`)
  }, [])

  return (
    <>
      {showNewForm && (
        <NewLeadModal
          onClose={() => setShowNewForm(false)}
          onCreate={handleCreate}
          creating={creating}
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
        <div className="rounded-2xl border border-foreground/[0.07] bg-card px-5 py-4">
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

        {/* Search + Star filter row */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, tag, nicho, instagram..."
            className="h-9 rounded-xl border border-foreground/[0.08] bg-card px-4 text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/20 focus:outline-none flex-1 min-w-[220px] max-w-sm"
          />

          {/* Star filter — solo Todas + 4-5 */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterRating(0)}
              className={`h-8 rounded-xl border px-3 text-[12px] font-medium transition-all ${
                filterRating === 0
                  ? "border-amber-600 bg-amber-500 text-black dark:border-[#ffde21]/40 dark:bg-[#ffde21]/10 dark:text-[#ffde21]"
                  : "border-foreground/[0.07] text-foreground/40 hover:text-foreground hover:border-foreground/20"
              }`}>
              Todas
            </button>
            <button
              onClick={() => setFilterRating(filterRating === -1 ? 0 : -1)}
              className={`h-8 rounded-xl border px-3 transition-all flex items-center gap-1 text-[12px] font-bold ${
                filterRating === -1
                  ? "border-amber-600 bg-amber-500 text-black shadow-sm dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300 dark:shadow-none"
                  : "border-foreground/[0.07] text-foreground/40 hover:text-amber-700 hover:border-amber-400 hover:bg-amber-50 dark:hover:text-amber-300 dark:hover:border-amber-400/30 dark:hover:bg-transparent"
              }`}>
              <Star className={`h-3 w-3 ${filterRating === -1 ? "fill-black text-black dark:fill-amber-400 dark:text-amber-400" : "fill-transparent"}`} />
              4–5
            </button>
            {/* Filtros de 1-3 ⭐ removidos: solo nos interesan leads calificados (4-5 ⭐). */}
          </div>
        </div>

        {/* Banner explicativo cuando el filtro 4-5 está activo */}
        {filterRating === -1 && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500 bg-amber-100 px-4 py-2.5 dark:border-amber-400/20 dark:bg-amber-500/[0.05]">
            <Star className="h-3.5 w-3.5 fill-amber-600 text-amber-600 shrink-0 dark:fill-amber-400 dark:text-amber-400" />
            <p className="text-[12px] text-amber-900 flex-1 dark:text-amber-200/80">
              Mostrando solo leads de <span className="font-bold text-amber-950 dark:font-semibold dark:text-amber-200">4 y 5 estrellas</span>. Tocá <span className="font-bold dark:font-semibold">Todas</span> arriba para ver todos los leads del pipeline.
            </p>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/40" />
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ backgroundColor: "var(--card)" }}>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
                    {["Nombre","Email","Tag","Instagram","Rating","Estado","Desde dónde llegó","Tipo","Nicho","Fecha",""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/40 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!filtered.length ? (
                    <tr><td colSpan={10} className="py-16 text-center text-sm text-foreground/25">
                      {leads.length ? "No hay leads con esa búsqueda." : "Todavía no hay leads. Conectá ManyChat al webhook."}
                    </td></tr>
                  ) : filtered.map(lead => (
                    <tr key={lead.id}
                      onClick={() => setSelected(lead)}
                      className="border-b border-foreground/[0.04] cursor-pointer transition-colors group bg-card hover:bg-muted">

                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-[14px] font-semibold text-foreground">{lead.name ?? <span className="text-foreground/30">—</span>}</span>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-[13px] text-foreground/90">{lead.email ?? <span className="text-foreground/30">—</span>}</span>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        {lead.tag
                          ? <span className="rounded-full border border-amber-500 bg-amber-100 px-2.5 py-0.5 text-[12px] font-semibold text-amber-900 dark:border-[#ffde21]/20 dark:bg-[#ffde21]/[0.06] dark:text-[#ffde21]/90">{lead.tag}</span>
                          : <span className="text-foreground/30 text-[13px]">—</span>}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {lead.instagram
                          ? <a href={`https://instagram.com/${lead.instagram.replace("@","")}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[13px] text-pink-700 hover:text-pink-900 dark:text-pink-300 dark:hover:text-pink-200 transition-colors">
                              <Instagram className="h-3.5 w-3.5 shrink-0" />
                              {lead.instagram}
                            </a>
                          : <span className="text-foreground/30 text-[13px]">—</span>}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <StarRating value={lead.rating}
                          onChange={n => patch(lead.id, { rating: n || null })} />
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap min-w-[130px]" onClick={e => e.stopPropagation()}>
                        <InlineField value={lead.status !== "nuevo" ? lead.status : null}
                          placeholder="estado..." onSave={v => patch(lead.id, { status: v || "nuevo" })} />
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap min-w-[140px]" onClick={e => e.stopPropagation()}>
                        <InlineField value={lead.source} placeholder="desde dónde..."
                          onSave={v => patch(lead.id, { source: v || null })} />
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap min-w-[120px]" onClick={e => e.stopPropagation()}>
                        <InlineField value={lead.lead_type} placeholder="tipo..."
                          onSave={v => patch(lead.id, { lead_type: v || null })} />
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap min-w-[120px]" onClick={e => e.stopPropagation()}>
                        <InlineField value={lead.niche} placeholder="nicho..."
                          onSave={v => patch(lead.id, { niche: v || null })} />
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-[12px] text-foreground/60">{fmtDate(lead.created_at)}</span>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <ChevronRight className="h-4 w-4 text-foreground/25 group-hover:text-foreground/60 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
