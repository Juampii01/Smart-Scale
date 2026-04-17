"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Trash2, RefreshCw, Download, X, Star,
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
            star <= active ? "fill-amber-400 text-amber-400" : "fill-transparent text-white/20"
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
      className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12px] text-white/55 placeholder:text-white/20 hover:border-white/[0.08] focus:border-white/20 focus:bg-white/[0.03] focus:text-white/80 focus:outline-none transition-all"
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
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">{label}</p>
      <input
        type="text"
        defaultValue={(lead[key] as string) ?? ""}
        placeholder={placeholder}
        onBlur={e    => onPatch(lead.id, { [key]: e.target.value || null })}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white/70 placeholder:text-white/20 focus:border-white/20 focus:text-white/90 focus:outline-none transition-all"
      />
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[440px] flex-col border-l border-white/[0.08] bg-[#111113] shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{lead.name ?? "Lead"}</h2>
            <p className="text-[12px] text-white/35 mt-0.5">{fmtDate(lead.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onDelete(lead.id)} disabled={deleting}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Rating + tag + instagram */}
        <div className="border-b border-white/[0.06] px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <StarRating size="md" value={lead.rating}
              onChange={n => onPatch(lead.id, { rating: n || null })} />
            {lead.tag && (
              <span className="rounded-full border border-[#ffde21]/20 bg-[#ffde21]/[0.06] px-3 py-0.5 text-[11px] font-bold text-[#ffde21]/70">
                {lead.tag}
              </span>
            )}
          </div>
          {ig && (
            <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[13px] text-pink-300/70 hover:text-pink-300 transition-colors">
              <Instagram className="h-4 w-4 shrink-0" />
              @{ig}
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          )}
        </div>

        {/* Editable fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Estado</p>
            <input
              type="text"
              defaultValue={lead.status !== "nuevo" ? lead.status : ""}
              placeholder="ej: caliente, en proceso, cerrado..."
              onBlur={e    => onPatch(lead.id, { status: e.target.value || "nuevo" })}
              onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white/70 placeholder:text-white/20 focus:border-white/20 focus:text-white/90 focus:outline-none transition-all"
            />
          </div>

          {textField("Desde dónde llegó", "source",    "ej: Instagram, Podcast, Referido...")}
          {textField("Tipo de lead",       "lead_type", "ej: Orgánico, Paid, DM...")}
          {textField("Nicho",              "niche",     "ej: Fitness, Finanzas, Coaches...")}
          {textField("Instagram",          "instagram", "@usuario")}
          {textField("Email",              "email",     "correo@ejemplo.com")}

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Algo acerca del lead</p>
            <textarea
              defaultValue={lead.notes ?? ""}
              placeholder="Observaciones, contexto, intereses..."
              rows={4}
              onBlur={e    => onPatch(lead.id, { notes: e.target.value || null })}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) (e.target as HTMLTextAreaElement).blur() }}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white/70 placeholder:text-white/20 focus:border-white/20 focus:text-white/90 focus:outline-none transition-all"
            />
          </div>

        </div>
      </div>
    </>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AdminLeadsView() {
  const [leads,      setLeads]      = useState<Lead[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<Lead | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search,     setSearch]     = useState("")

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
    setDeletingId(id)
    const session = await getSession()
    if (!session) return
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
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [l.name, l.tag, l.instagram, l.niche, l.lead_type, l.source, l.status]
      .some(v => v?.toLowerCase().includes(q))
  })

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/lead`
    : "https://smartscale.space/api/webhooks/lead"

  return (
    <>
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
            <h1 className="text-2xl font-bold text-white tracking-tight">Leads</h1>
            <p className="text-sm text-white/40 mt-0.5">{leads.length} leads</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchLeads} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={exportCsv} disabled={!filtered.length}
              className="flex items-center gap-2 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-medium text-white/50 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Webhook card */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#111113] px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-2">
            Webhook URL — ManyChat / Zapier
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] text-[#ffde21]/70 font-mono truncate">
              {webhookUrl}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(webhookUrl)}
              className="shrink-0 h-8 rounded-lg border border-white/[0.08] px-3 text-[12px] text-white/40 hover:text-white hover:border-white/20 transition-all"
            >
              Copiar
            </button>
          </div>
          <p className="text-[11px] text-white/25 mt-1.5">
            Campos: <code className="text-white/40">name</code>, <code className="text-white/40">tag</code>, <code className="text-white/40">instagram</code>
          </p>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, tag, nicho, instagram..."
          className="h-9 rounded-xl border border-white/[0.08] bg-[#1c1c1f] px-4 text-sm text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none w-full max-w-sm"
        />

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/40" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    {["Nombre","Email","Tag","Instagram","Rating","Estado","Desde dónde llegó","Tipo","Nicho","Fecha",""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!filtered.length ? (
                    <tr><td colSpan={10} className="py-16 text-center text-sm text-white/25">
                      {leads.length ? "No hay leads con esa búsqueda." : "Todavía no hay leads. Conectá ManyChat al webhook."}
                    </td></tr>
                  ) : filtered.map(lead => (
                    <tr key={lead.id}
                      onClick={() => setSelected(lead)}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors group">

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[13px] font-semibold text-white">{lead.name ?? <span className="text-white/25">—</span>}</span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[12px] text-white/50">{lead.email ?? <span className="text-white/20">—</span>}</span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {lead.tag
                          ? <span className="rounded-full border border-[#ffde21]/20 bg-[#ffde21]/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-[#ffde21]/70">{lead.tag}</span>
                          : <span className="text-white/20 text-[12px]">—</span>}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {lead.instagram
                          ? <a href={`https://instagram.com/${lead.instagram.replace("@","")}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[12px] text-pink-300/60 hover:text-pink-300 transition-colors">
                              <Instagram className="h-3.5 w-3.5 shrink-0" />
                              {lead.instagram}
                            </a>
                          : <span className="text-white/20 text-[12px]">—</span>}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <StarRating value={lead.rating}
                          onChange={n => patch(lead.id, { rating: n || null })} />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap min-w-[120px]" onClick={e => e.stopPropagation()}>
                        <InlineField value={lead.status !== "nuevo" ? lead.status : null}
                          placeholder="estado..." onSave={v => patch(lead.id, { status: v || "nuevo" })} />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap min-w-[130px]" onClick={e => e.stopPropagation()}>
                        <InlineField value={lead.source} placeholder="desde dónde..."
                          onSave={v => patch(lead.id, { source: v || null })} />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap min-w-[110px]" onClick={e => e.stopPropagation()}>
                        <InlineField value={lead.lead_type} placeholder="tipo..."
                          onSave={v => patch(lead.id, { lead_type: v || null })} />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap min-w-[110px]" onClick={e => e.stopPropagation()}>
                        <InlineField value={lead.niche} placeholder="nicho..."
                          onSave={v => patch(lead.id, { niche: v || null })} />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] text-white/25">{fmtDate(lead.created_at)}</span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <ChevronRight className="h-4 w-4 text-white/15 group-hover:text-white/40 transition-colors" />
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
