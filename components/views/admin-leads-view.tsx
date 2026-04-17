"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { Copy, Check, Loader2, Trash2, RefreshCw, Download, ExternalLink } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  name:      string | null
  email:     string | null
  phone:     string | null
  instagram: string | null
  tag:       string | null
  source:    string | null
  status:    string
  notes:     string | null
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUSES = ["nuevo", "contactado", "en proceso", "cerrado", "descartado"] as const

const STATUS_STYLES: Record<string, string> = {
  "nuevo":       "bg-blue-500/10 text-blue-300 border-blue-500/20",
  "contactado":  "bg-amber-500/10 text-amber-300 border-amber-500/20",
  "en proceso":  "bg-[#ffde21]/10 text-[#ffde21] border-[#ffde21]/20",
  "cerrado":     "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  "descartado":  "bg-white/5 text-white/30 border-white/10",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric", month: "short", year: "numeric",
  })
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-white/20 hover:text-white/60 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-[#ffde21]" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminLeadsView() {
  const [leads,       setLeads]       = useState<Lead[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [savingId,    setSavingId]    = useState<string | null>(null)
  const [urlCopied,   setUrlCopied]   = useState(false)

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/lead`
    : "/api/webhooks/lead"

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch("/api/admin/leads", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      setLeads(json.leads ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const updateStatus = async (id: string, status: string) => {
    setSavingId(id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, status }),
    })
    setSavingId(null)
  }

  const updateNotes = async (id: string, notes: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notes } : l))
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, notes }),
    })
  }

  const deleteLead = async (id: string) => {
    setDeletingId(id)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch("/api/admin/leads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    })
    setLeads(prev => prev.filter(l => l.id !== id))
    setDeletingId(null)
  }

  const exportCsv = () => {
    const header = ["Nombre","Email","Teléfono","Instagram","Etiqueta","Fuente","Estado","Notas","Fecha"].join(",")
    const rows = filtered.map(l =>
      [l.name, l.email, l.phone, l.instagram, l.tag, l.source, l.status, l.notes, l.created_at]
        .map(v => `"${(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv  = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement("a"), { href: url, download: "leads.csv" })
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = filterStatus === "todos"
    ? leads
    : leads.filter(l => l.status === filterStatus)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Leads</h1>
          <p className="text-sm text-white/40 mt-0.5">{leads.length} leads en total</p>
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

      {/* Webhook URL card */}
      <div className="rounded-2xl border border-[#ffde21]/15 bg-[#ffde21]/[0.03] px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#ffde21]/60 mb-2">URL del Webhook</p>
        <p className="text-[11px] text-white/40 mb-3">
          Configurá este endpoint en tu CRM. Cuando se le ponga una etiqueta a un lead, llegará automáticamente acá.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-xl border border-white/[0.08] bg-[#0a0a0b] px-4 py-2.5 text-[13px] text-[#ffde21]/80 font-mono break-all">
            {webhookUrl}
          </code>
          <button
            onClick={() => { navigator.clipboard.writeText(webhookUrl); setUrlCopied(true); setTimeout(() => setUrlCopied(false), 2000) }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20 transition-all"
          >
            {urlCopied ? <Check className="h-4 w-4 text-[#ffde21]" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-white/25">
          Método: POST · El webhook acepta cualquier JSON. Campos reconocidos: name, email, phone, instagram, tag, source.
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {["todos", ...STATUSES].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`h-8 rounded-xl border px-3.5 text-[12px] font-medium capitalize transition-all ${
              filterStatus === s
                ? "border-[#ffde21]/40 bg-[#ffde21]/10 text-[#ffde21]"
                : "border-white/[0.07] bg-transparent text-white/40 hover:text-white hover:border-white/20"
            }`}
          >
            {s}
            {s !== "todos" && (
              <span className="ml-1.5 text-[10px] opacity-60">
                {leads.filter(l => l.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/40" />
          </div>
        ) : !filtered.length ? (
          <div className="py-20 text-center">
            <p className="text-sm text-white/25">
              {leads.length ? "No hay leads con ese estado." : "Todavía no llegó ningún lead por webhook."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {["Nombre","Email","Teléfono","Instagram","Etiqueta","Estado","Notas","Fecha",""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
                  <tr key={lead.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">

                    {/* Nombre */}
                    <td className="px-4 py-3 text-[13px] font-semibold text-white whitespace-nowrap max-w-[160px] truncate">
                      {lead.name ?? <span className="text-white/25">—</span>}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-[13px] text-white/60 whitespace-nowrap">
                      {lead.email
                        ? <span className="flex items-center">{lead.email}<CopyBtn text={lead.email} /></span>
                        : <span className="text-white/20">—</span>}
                    </td>

                    {/* Teléfono */}
                    <td className="px-4 py-3 text-[13px] text-white/60 whitespace-nowrap">
                      {lead.phone
                        ? <span className="flex items-center">{lead.phone}<CopyBtn text={lead.phone} /></span>
                        : <span className="text-white/20">—</span>}
                    </td>

                    {/* Instagram */}
                    <td className="px-4 py-3 text-[13px] text-white/60 whitespace-nowrap">
                      {lead.instagram
                        ? <a href={`https://instagram.com/${lead.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[#ffde21]/70 hover:text-[#ffde21] transition-colors">
                            {lead.instagram}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        : <span className="text-white/20">—</span>}
                    </td>

                    {/* Tag */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {lead.tag
                        ? <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/50">{lead.tag}</span>
                        : <span className="text-white/20 text-[13px]">—</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="relative">
                        <select
                          value={lead.status}
                          onChange={e => updateStatus(lead.id, e.target.value)}
                          disabled={savingId === lead.id}
                          className={`h-7 cursor-pointer appearance-none rounded-lg border px-2.5 pr-6 text-[11px] font-medium capitalize focus:outline-none disabled:opacity-60 ${STATUS_STYLES[lead.status] ?? STATUS_STYLES["nuevo"]}`}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDownMini />
                      </div>
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 min-w-[180px]">
                      <input
                        type="text"
                        defaultValue={lead.notes ?? ""}
                        placeholder="Agregar nota..."
                        onBlur={e => updateNotes(lead.id, e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                        className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12px] text-white/50 placeholder:text-white/20 hover:border-white/[0.08] focus:border-white/20 focus:bg-white/[0.03] focus:text-white/80 focus:outline-none transition-all"
                      />
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-[12px] text-white/30 whitespace-nowrap">
                      {fmtDate(lead.created_at)}
                    </td>

                    {/* Delete */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteLead(lead.id)}
                        disabled={deletingId === lead.id}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-40"
                      >
                        {deletingId === lead.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Tiny inline chevron for the select
function ChevronDownMini() {
  return (
    <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 opacity-50" viewBox="0 0 12 12" fill="none">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
