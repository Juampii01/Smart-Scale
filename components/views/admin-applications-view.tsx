"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Plus, Trash2, RefreshCw, Download, Check, X, ExternalLink,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Application {
  id:              string
  first_name:      string | null
  last_name:       string | null
  email:           string | null
  primary_channel: string | null
  question:        string | null
  status:          "nueva" | "revisada" | "aceptada" | "rechazada"
  notes:           string | null
  created_at:      string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

const STATUS_STYLE: Record<string, string> = {
  nueva:     "bg-blue-500/10 text-blue-300 border-blue-500/20",
  revisada:  "bg-amber-500/10 text-amber-300 border-amber-500/20",
  aceptada:  "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  rechazada: "bg-red-500/10 text-red-300 border-red-500/20",
}

const CHANNEL_COLORS: Record<string, string> = {
  Instagram: "bg-pink-500/10 text-pink-300 border-pink-500/20",
  "Tik Tok": "bg-[#69C9D0]/10 text-[#69C9D0] border-[#69C9D0]/20",
  YouTube:   "bg-red-500/10 text-red-300 border-red-500/20",
  Facebook:  "bg-blue-500/10 text-blue-300 border-blue-500/20",
}

// ─── New Application Row ──────────────────────────────────────────────────────

function NewApplicationRow({ onSave, onCancel }: {
  onSave:   (a: Omit<Application, "id" | "created_at">) => Promise<void>
  onCancel: () => void
}) {
  const [firstName,  setFirstName]  = useState("")
  const [lastName,   setLastName]   = useState("")
  const [email,      setEmail]      = useState("")
  const [channel,    setChannel]    = useState("")
  const [question,   setQuestion]   = useState("")
  const [saving,     setSaving]     = useState(false)

  const handleSave = async () => {
    if (!firstName.trim()) return
    setSaving(true)
    await onSave({
      first_name:      firstName.trim() || null,
      last_name:       lastName.trim()  || null,
      email:           email.trim()     || null,
      primary_channel: channel.trim()   || null,
      question:        question.trim()  || null,
      status:          "nueva",
      notes:           null,
    })
    setSaving(false)
  }

  const inputCls = "h-8 rounded-lg border border-white/[0.08] bg-[#1a1a1d] px-3 text-[13px] text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none w-full"

  return (
    <tr className="border-b border-[#ffde21]/10 bg-[#ffde21]/[0.03]">
      <td className="px-3 py-2.5"><input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre *" className={inputCls} /></td>
      <td className="px-3 py-2.5"><input value={lastName}  onChange={e => setLastName(e.target.value)}  placeholder="Apellido"  className={inputCls} /></td>
      <td className="px-3 py-2.5"><input value={email}     onChange={e => setEmail(e.target.value)}     placeholder="Email"     className={inputCls} /></td>
      <td className="px-3 py-2.5">
        <select value={channel} onChange={e => setChannel(e.target.value)}
          className="h-8 w-full appearance-none rounded-lg border border-white/[0.08] bg-[#1a1a1d] px-3 text-[13px] text-white focus:outline-none">
          <option value="">— Canal —</option>
          {["Instagram","Tik Tok","YouTube","Facebook","Otro"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="px-3 py-2.5"><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Pregunta / Respuesta..." className={inputCls} /></td>
      <td className="px-3 py-2.5">—</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <button onClick={handleSave} disabled={saving || !firstName.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffde21] text-black hover:bg-[#ffe84d] disabled:opacity-40 transition-all">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-white/40 hover:text-white transition-all">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminApplicationsView() {
  const [apps,         setApps]         = useState<Application[]>([])
  const [loading,      setLoading]      = useState(true)
  const [adding,       setAdding]       = useState(false)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("todas")
  const [search,       setSearch]       = useState("")

  const getSession = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  const fetchApps = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/applications", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      setApps(json.applications ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchApps() }, [fetchApps])

  const handleAdd = async (a: Omit<Application, "id" | "created_at">) => {
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify(a),
    })
    if (res.ok) {
      const json = await res.json()
      setApps(prev => [json.application, ...prev])
      setAdding(false)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, status: status as Application["status"] } : a))
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, status }),
    })
  }

  const handleNotes = async (id: string, notes: string) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, notes } : a))
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, notes }),
    })
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/applications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    })
    setApps(prev => prev.filter(a => a.id !== id))
    setDeletingId(null)
  }

  const exportCsv = () => {
    const header = ["Nombre","Apellido","Email","Canal","Pregunta","Estado","Notas","Fecha"].join(",")
    const rows = filtered.map(a =>
      [a.first_name, a.last_name, a.email, a.primary_channel, a.question, a.status, a.notes, a.created_at]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv  = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement("a"), { href: url, download: "aplicaciones.csv" }).click()
    URL.revokeObjectURL(url)
  }

  const filtered = apps
    .filter(a => filterStatus === "todas" || a.status === filterStatus)
    .filter(a => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return [a.first_name, a.last_name, a.email, a.primary_channel]
        .some(v => v?.toLowerCase().includes(q))
    })

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Aplicaciones</h1>
          <p className="text-sm text-white/40 mt-0.5">{apps.length} aplicaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchApps} disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={exportCsv} disabled={!filtered.length}
            className="flex items-center gap-2 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-medium text-white/50 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button onClick={() => setAdding(true)} disabled={adding}
            className="flex items-center gap-2 h-9 rounded-xl bg-[#ffde21] px-4 text-sm font-bold text-black hover:bg-[#ffe84d] disabled:opacity-50 transition-all">
            <Plus className="h-4 w-4" />
            Nueva
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["nueva","revisada","aceptada","rechazada"] as const).map(s => (
          <div key={s} className="rounded-2xl border border-white/[0.07] bg-[#111113] px-4 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 capitalize">{s}</p>
            <p className={`mt-1 text-2xl font-bold ${STATUS_STYLE[s].split(" ")[1]}`}>
              {apps.filter(a => a.status === s).length}
            </p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o canal..."
          className="h-9 rounded-xl border border-white/[0.08] bg-[#1c1c1f] px-4 text-sm text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none w-64"
        />
        <div className="flex items-center gap-2">
          {["todas","nueva","revisada","aceptada","rechazada"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`h-8 rounded-xl border px-3 text-[12px] font-medium capitalize transition-all ${
                filterStatus === s
                  ? "border-[#ffde21]/40 bg-[#ffde21]/10 text-[#ffde21]"
                  : "border-white/[0.07] text-white/40 hover:text-white hover:border-white/20"
              }`}>
              {s}
              {s !== "todas" && <span className="ml-1 text-[10px] opacity-60">{apps.filter(a => a.status === s).length}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/40" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {["Nombre","Apellido","Email","Canal principal","Pregunta","Estado","Notas",""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adding && <NewApplicationRow onSave={handleAdd} onCancel={() => setAdding(false)} />}
                {!filtered.length && !adding ? (
                  <tr><td colSpan={8} className="py-16 text-center text-sm text-white/25">
                    {apps.length ? "No hay aplicaciones con ese filtro." : "Todavía no hay aplicaciones cargadas."}
                  </td></tr>
                ) : filtered.map(app => (
                  <tr key={app.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">

                    {/* Nombre */}
                    <td className="px-4 py-3 text-[13px] font-semibold text-white whitespace-nowrap">
                      {app.first_name ?? <span className="text-white/25">—</span>}
                    </td>

                    {/* Apellido */}
                    <td className="px-4 py-3 text-[13px] text-white/70 whitespace-nowrap">
                      {app.last_name ?? <span className="text-white/25">—</span>}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-[13px] text-white/55 whitespace-nowrap">
                      {app.email
                        ? <a href={`mailto:${app.email}`} className="hover:text-white transition-colors">{app.email}</a>
                        : <span className="text-white/20">—</span>}
                    </td>

                    {/* Canal */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {app.primary_channel
                        ? <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${CHANNEL_COLORS[app.primary_channel] ?? "bg-white/5 text-white/40 border-white/10"}`}>
                            {app.primary_channel}
                          </span>
                        : <span className="text-white/20 text-[13px]">—</span>}
                    </td>

                    {/* Pregunta */}
                    <td className="px-4 py-3 text-[12px] text-white/45 max-w-[200px] truncate" title={app.question ?? ""}>
                      {app.question ?? <span className="text-white/20">—</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <select value={app.status} onChange={e => handleStatusChange(app.id, e.target.value)}
                        className={`h-7 cursor-pointer appearance-none rounded-lg border px-2.5 pr-6 text-[11px] font-semibold capitalize focus:outline-none ${STATUS_STYLE[app.status]}`}>
                        <option value="nueva">Nueva</option>
                        <option value="revisada">Revisada</option>
                        <option value="aceptada">Aceptada</option>
                        <option value="rechazada">Rechazada</option>
                      </select>
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 min-w-[160px]">
                      <input
                        type="text"
                        defaultValue={app.notes ?? ""}
                        placeholder="Nota..."
                        onBlur={e => handleNotes(app.id, e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                        className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12px] text-white/50 placeholder:text-white/20 hover:border-white/[0.08] focus:border-white/20 focus:bg-white/[0.03] focus:text-white/80 focus:outline-none transition-all"
                      />
                    </td>

                    {/* Date + Delete */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-white/25">{fmtDate(app.created_at)}</span>
                        <button onClick={() => handleDelete(app.id)} disabled={deletingId === app.id}
                          className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
                          {deletingId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
    </div>
  )
}
