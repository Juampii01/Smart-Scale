"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Trash2, RefreshCw, Download, X, ExternalLink,
  Instagram, Link2, Mail, Phone, ChevronRight,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Application {
  id:                   string
  first_name:           string | null
  last_name:            string | null
  email:                string | null
  whatsapp:             string | null
  instagram_handle:     string | null
  primary_channel:      string | null
  short_content_link:   string | null
  youtube_podcast_link: string | null
  email_list_size:      string | null
  monthly_revenue:      string | null
  paying_clients:       string | null
  client_work_style:    string | null
  income_goal:          string | null
  main_blocker:         string | null
  superpowers:          string | null
  contribution:         string | null
  motivation:           string | null
  one_year_goal:        string | null
  terms_accepted:       boolean | null
  status:               "nueva" | "revisada" | "aceptada" | "rechazada"
  notes:                string | null
  created_at:           string
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
  Linkedin:  "bg-sky-500/10 text-sky-300 border-sky-500/20",
}

function fullName(app: Application) {
  return [app.first_name, app.last_name].filter(Boolean).join(" ") || "—"
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">{label}</p>
      <p className="text-[13px] text-white/75 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function DetailLink({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">{label}</p>
      <a href={value} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-[13px] text-[#ffde21]/70 hover:text-[#ffde21] transition-colors truncate">
        <Link2 className="h-3.5 w-3.5 shrink-0" />
        {value}
      </a>
    </div>
  )
}

function DetailDrawer({
  app,
  onClose,
  onStatusChange,
  onNotesChange,
  onDelete,
  deleting,
}: {
  app:             Application
  onClose:         () => void
  onStatusChange:  (id: string, status: string) => void
  onNotesChange:   (id: string, notes: string) => void
  onDelete:        (id: string) => void
  deleting:        boolean
}) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[520px] flex-col border-l border-white/[0.08] bg-[#111113] shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{fullName(app)}</h2>
            <p className="text-[12px] text-white/40 mt-0.5">{fmtDate(app.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onDelete(app.id)} disabled={deleting}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status + Notes */}
        <div className="border-b border-white/[0.06] px-6 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <select
              value={app.status}
              onChange={e => onStatusChange(app.id, e.target.value)}
              className={`h-8 cursor-pointer appearance-none rounded-lg border px-3 pr-7 text-[12px] font-bold capitalize focus:outline-none ${STATUS_STYLE[app.status]}`}
            >
              <option value="nueva">Nueva</option>
              <option value="revisada">Revisada</option>
              <option value="aceptada">Aceptada</option>
              <option value="rechazada">Rechazada</option>
            </select>
            {app.primary_channel && (
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${CHANNEL_COLORS[app.primary_channel] ?? "bg-white/5 text-white/40 border-white/10"}`}>
                {app.primary_channel}
              </span>
            )}
          </div>
          <input
            type="text"
            defaultValue={app.notes ?? ""}
            placeholder="Agregar nota interna..."
            onBlur={e => onNotesChange(app.id, e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/60 placeholder:text-white/20 focus:border-white/20 focus:text-white/80 focus:outline-none transition-all"
          />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* Contacto */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#ffde21]/50">Contacto</h3>
            <div className="grid grid-cols-1 gap-3">
              {app.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-white/25" />
                  <a href={`mailto:${app.email}`} className="text-[13px] text-white/65 hover:text-white transition-colors">{app.email}</a>
                </div>
              )}
              {app.whatsapp && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-white/25" />
                  <span className="text-[13px] text-white/65">{app.whatsapp}</span>
                </div>
              )}
              {app.instagram_handle && (
                <div className="flex items-center gap-2">
                  <Instagram className="h-3.5 w-3.5 shrink-0 text-white/25" />
                  <a
                    href={`https://instagram.com/${app.instagram_handle.replace("@","")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[13px] text-white/65 hover:text-white transition-colors"
                  >
                    {app.instagram_handle}
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* Negocio */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#ffde21]/50">Negocio</h3>
            <div className="space-y-3">
              <DetailLink label="Canal corto" value={app.short_content_link} />
              <DetailLink label="YouTube / Podcast" value={app.youtube_podcast_link} />
            </div>
          </section>

          {/* Métricas */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#ffde21]/50">Métricas</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Lista de emails",   value: app.email_list_size },
                { label: "Facturación mensual", value: app.monthly_revenue },
                { label: "Clientes pagos",    value: app.paying_clients },
                { label: "Modelo de trabajo", value: app.client_work_style },
              ].map(({ label, value }) => value ? (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">{label}</p>
                  <p className="text-[13px] font-semibold text-white/80">{value}</p>
                </div>
              ) : null)}
            </div>
          </section>

          {/* Objetivos */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#ffde21]/50">Objetivos y Bloqueos</h3>
            <div className="space-y-3">
              <DetailRow label="Objetivo de ingresos" value={app.income_goal} />
              <DetailRow label="Principal bloqueo" value={app.main_blocker} />
            </div>
          </section>

          {/* Por qué vos */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#ffde21]/50">¿Por qué vos?</h3>
            <div className="space-y-3">
              <DetailRow label="Superpoderes" value={app.superpowers} />
              <DetailRow label="Aporte a Smart Scale" value={app.contribution} />
              <DetailRow label="Motivación para aplicar" value={app.motivation} />
              <DetailRow label="Visión a 1 año" value={app.one_year_goal} />
            </div>
          </section>

        </div>
      </div>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminApplicationsView() {
  const [apps,          setApps]          = useState<Application[]>([])
  const [loading,       setLoading]       = useState(true)
  const [selectedApp,   setSelectedApp]   = useState<Application | null>(null)
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [filterStatus,  setFilterStatus]  = useState<string>("todas")
  const [search,        setSearch]        = useState("")

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

  const handleStatusChange = async (id: string, status: string) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, status: status as Application["status"] } : a))
    if (selectedApp?.id === id) setSelectedApp(prev => prev ? { ...prev, status: status as Application["status"] } : prev)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, status }),
    })
  }

  const handleNotesChange = async (id: string, notes: string) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, notes } : a))
    if (selectedApp?.id === id) setSelectedApp(prev => prev ? { ...prev, notes } : prev)
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
    if (selectedApp?.id === id) setSelectedApp(null)
    setDeletingId(null)
  }

  const exportCsv = () => {
    const header = [
      "Nombre","Apellido","Email","WhatsApp","Instagram",
      "Canal","Link corto","YouTube/Podcast",
      "Lista emails","Facturación","Clientes pagos","Modelo trabajo",
      "Obj. ingresos","Bloqueo","Superpoderes","Aporte","Motivación","Visión 1 año",
      "T&C","Estado","Notas","Fecha",
    ].join(",")
    const rows = filtered.map(a =>
      [
        a.first_name, a.last_name, a.email, a.whatsapp, a.instagram_handle,
        a.primary_channel, a.short_content_link, a.youtube_podcast_link,
        a.email_list_size, a.monthly_revenue, a.paying_clients, a.client_work_style,
        a.income_goal, a.main_blocker, a.superpowers, a.contribution, a.motivation, a.one_year_goal,
        a.terms_accepted ? "Sí" : "No", a.status, a.notes, a.created_at,
      ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
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
      return [a.first_name, a.last_name, a.email, a.instagram_handle, a.primary_channel]
        .some(v => v?.toLowerCase().includes(q))
    })

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {selectedApp && (
        <DetailDrawer
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
          onDelete={handleDelete}
          deleting={deletingId === selectedApp.id}
        />
      )}

      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Aplicaciones</h1>
            <p className="text-sm text-white/40 mt-0.5">{apps.length} aplicaciones</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/apply"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-medium text-white/50 hover:text-white hover:border-white/20 transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver formulario
            </a>
            <button onClick={fetchApps} disabled={loading}
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
          <div className="flex items-center gap-2 flex-wrap">
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
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/40" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    {["Nombre","Email","Instagram","Canal","Facturación","Estado","Fecha",""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!filtered.length ? (
                    <tr><td colSpan={9} className="py-16 text-center text-sm text-white/25">
                      {apps.length ? "No hay aplicaciones con ese filtro." : "Todavía no hay aplicaciones. Compartí el formulario (/apply) para recibirlas."}
                    </td></tr>
                  ) : filtered.map(app => (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedApp(app)}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    >
                      {/* Nombre */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[13px] font-semibold text-white">{fullName(app)}</span>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[13px] text-white/50">{app.email ?? <span className="text-white/20">—</span>}</span>
                      </td>

                      {/* Instagram */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[13px] text-white/50">{app.instagram_handle ?? <span className="text-white/20">—</span>}</span>
                      </td>

                      {/* Canal */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {app.primary_channel
                          ? <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${CHANNEL_COLORS[app.primary_channel] ?? "bg-white/5 text-white/40 border-white/10"}`}>
                              {app.primary_channel}
                            </span>
                          : <span className="text-white/20 text-[13px]">—</span>}
                      </td>

                      {/* Facturación */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[12px] text-white/45">{app.monthly_revenue ?? <span className="text-white/20">—</span>}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <select
                          value={app.status}
                          onChange={e => handleStatusChange(app.id, e.target.value)}
                          className={`h-7 cursor-pointer appearance-none rounded-lg border px-2.5 pr-6 text-[11px] font-semibold capitalize focus:outline-none ${STATUS_STYLE[app.status]}`}
                        >
                          <option value="nueva">Nueva</option>
                          <option value="revisada">Revisada</option>
                          <option value="aceptada">Aceptada</option>
                          <option value="rechazada">Rechazada</option>
                        </select>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] text-white/25">{fmtDate(app.created_at)}</span>
                      </td>

                      {/* Arrow */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ChevronRight className="h-4 w-4 text-white/15 group-hover:text-white/40 transition-colors" />
                      </td>

                      {/* Delete */}
                      <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(app.id)}
                          disabled={deletingId === app.id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                        >
                          {deletingId === app.id
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
    </>
  )
}
