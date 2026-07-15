"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Trash2, RefreshCw, Download, X, ExternalLink,
  Mail, Phone, Instagram, ChevronRight,
} from "lucide-react"
import {
  TEAM_APPLICATION_FORMS,
  getFormByRole,
  CONTACT_FIELD_IDS,
} from "@/lib/team-application-forms"

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "nueva" | "revisando" | "descartada" | "aprobada" | "contratada"

interface TeamApplication {
  id:               string
  role:             string
  first_name:       string | null
  last_name:        string | null
  email:            string | null
  whatsapp:         string | null
  instagram_handle: string | null
  answers:          Record<string, string>
  status:           Status
  notes:            string | null
  created_at:       string
  updated_at:       string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

const STATUS_LIST: Status[] = ["nueva", "revisando", "descartada", "aprobada", "contratada"]

const STATUS_STYLE: Record<Status, string> = {
  nueva:      "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
  revisando:  "bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  descartada: "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20",
  aprobada:   "bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  contratada: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
}

const ROLE_BADGE: Record<string, string> = {
  setter: "bg-amber-200 text-amber-900 border-amber-500 dark:bg-[#dafc69]/10 dark:text-[#dafc69] dark:border-[#dafc69]/20",
}

function fullName(app: TeamApplication) {
  return [app.first_name, app.last_name].filter(Boolean).join(" ") || "—"
}

function roleLabel(role: string) {
  return getFormByRole(role)?.shortLabel ?? role
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">{label}</p>
      <p className="text-[13px] text-foreground/75 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function DetailDrawer({
  app, onClose, onStatusChange, onNotesChange, onDelete, deleting,
}: {
  app: TeamApplication
  onClose: () => void
  onStatusChange: (id: string, status: Status) => void
  onNotesChange: (id: string, notes: string) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const form = getFormByRole(app.role)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-[640px] overflow-y-auto border-l border-foreground/[0.08] bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-foreground/[0.08] bg-background/95 backdrop-blur px-6 py-4 flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${ROLE_BADGE[app.role] ?? "bg-foreground/[0.06] text-foreground/50 border-foreground/10"}`}>
                {roleLabel(app.role)}
              </span>
              <span className="text-[11px] text-foreground/30">{fmtDate(app.created_at)}</span>
            </div>
            <h2 className="text-xl font-bold text-foreground truncate">{fullName(app)}</h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#dafc69]/40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-7">

          {/* Status + delete row */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#dafc69]/50">Estado</h3>
            <div className="flex flex-wrap gap-2">
              {STATUS_LIST.map(s => (
                <button
                  key={s}
                  onClick={() => onStatusChange(app.id, s)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold capitalize transition ${
                    app.status === s
                      ? STATUS_STYLE[s]
                      : "border-foreground/10 bg-foreground/[0.02] text-foreground/45 hover:text-foreground/80 hover:border-foreground/20"
                  }`}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => onDelete(app.id)}
                disabled={deleting}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-800 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/[0.04] dark:text-red-300 dark:hover:bg-red-500/10 disabled:opacity-40"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Eliminar
              </button>
            </div>
          </section>

          {/* Contacto */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#dafc69]/50">Contacto</h3>
            <div className="space-y-2">
              {app.email && (
                <a href={`mailto:${app.email}`} className="flex items-center gap-2.5 text-[13px] text-foreground/70 hover:text-foreground">
                  <Mail className="h-3.5 w-3.5 text-foreground/30" /> {app.email}
                </a>
              )}
              {app.whatsapp && (
                <a href={`https://wa.me/${app.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[13px] text-foreground/70 hover:text-foreground">
                  <Phone className="h-3.5 w-3.5 text-foreground/30" /> {app.whatsapp}
                </a>
              )}
              {app.instagram_handle && (
                <a href={`https://instagram.com/${app.instagram_handle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-[13px] text-foreground/70 hover:text-foreground">
                  <Instagram className="h-3.5 w-3.5 text-foreground/30" /> {app.instagram_handle}
                </a>
              )}
            </div>
          </section>

          {/* Respuestas — render dinámico desde el schema del rol */}
          {form && form.sections.map((section, sIdx) => {
            if (section.info) return null
            const fieldsToShow = (section.fields ?? []).filter(f => !CONTACT_FIELD_IDS.includes(f.id))
            if (fieldsToShow.length === 0) return null

            return (
              <section key={`s-${sIdx}`} className="space-y-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-[#dafc69]/50">{section.title}</h3>
                <div className="space-y-3">
                  {fieldsToShow.map(field => (
                    <DetailRow
                      key={field.id}
                      label={field.label}
                      value={app.answers?.[field.id] ?? null}
                    />
                  ))}
                </div>
              </section>
            )
          })}

          {/* Notas */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#dafc69]/50">Notas internas</h3>
            <textarea
              value={app.notes ?? ""}
              onChange={e => onNotesChange(app.id, e.target.value)}
              placeholder="Notas privadas sobre este candidato…"
              rows={4}
              className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] px-4 py-3 text-[13px] text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-[#dafc69]/40 transition-all resize-none"
            />
          </section>
        </div>
      </div>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminTeamApplicationsView() {
  const [apps,         setApps]         = useState<TeamApplication[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<TeamApplication | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [filterRole,   setFilterRole]   = useState<string>("todos")
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
      const res = await fetch("/api/admin/team-applications", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      setApps(json.applications ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchApps() }, [fetchApps])

  const handleStatusChange = async (id: string, status: Status) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : prev)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/team-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, status }),
    })
  }

  const handleNotesChange = async (id: string, notes: string) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, notes } : a))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, notes } : prev)
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/team-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, notes }),
    })
  }

  const handleDelete = async (id: string) => {
    const app = apps.find(a => a.id === id)
    const name = app ? `${app.first_name ?? ""} ${app.last_name ?? ""}`.trim() || "esta aplicación" : "esta aplicación"
    if (!window.confirm(`¿Eliminar la aplicación de ${name}? Esta acción no se puede deshacer.`)) return
    setDeletingId(id)
    const session = await getSession()
    if (!session) { setDeletingId(null); return }
    await fetch("/api/admin/team-applications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    })
    setApps(prev => prev.filter(a => a.id !== id))
    if (selected?.id === id) setSelected(null)
    setDeletingId(null)
  }

  const filtered = useMemo(() => apps
    .filter(a => filterRole === "todos" || a.role === filterRole)
    .filter(a => filterStatus === "todas" || a.status === filterStatus)
    .filter(a => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return [a.first_name, a.last_name, a.email, a.whatsapp, a.instagram_handle].some(v => v?.toLowerCase().includes(q))
    }), [apps, filterRole, filterStatus, search])

  const exportCsv = () => {
    const header = ["Rol","Nombre","Apellido","Email","WhatsApp","Instagram","Estado","Notas","Fecha"].join(",")
    const rows = filtered.map(a =>
      [roleLabel(a.role), a.first_name, a.last_name, a.email, a.whatsapp, a.instagram_handle, a.status, a.notes, a.created_at]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    )
    const csv  = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement("a"), { href: url, download: "contratacion.csv" }).click()
    URL.revokeObjectURL(url)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {selected && (
        <DetailDrawer
          app={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
          onDelete={handleDelete}
          deleting={deletingId === selected.id}
        />
      )}

      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Contratación</h1>
            <p className="text-sm text-foreground/40 mt-0.5">{apps.length} aplicaciones de candidatos al equipo</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/aplicar-equipo/${TEAM_APPLICATION_FORMS[0]?.role ?? ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 h-9 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-4 text-sm font-medium text-foreground/50 hover:text-foreground hover:border-foreground/20 transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver formulario
            </a>
            <button onClick={fetchApps} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] text-foreground/40 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={exportCsv} disabled={!filtered.length}
              className="flex items-center gap-2 h-9 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-4 text-sm font-medium text-foreground/50 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40">
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        </div>

        {/* Summary cards (estado) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {STATUS_LIST.map(s => (
            <div key={s} className="rounded-[14px] border border-foreground/[0.07] bg-card px-4 py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25 capitalize">{s}</p>
              <p className={`mt-1 text-2xl font-bold ${STATUS_STYLE[s].split(" ")[1]}`}>
                {apps.filter(a => a.status === s).length}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="h-9 rounded-xl border border-foreground/[0.08] bg-card px-3 text-[13px] text-foreground/70 focus:outline-none focus:border-foreground/20"
          >
            <option value="todos">Todos los roles</option>
            {TEAM_APPLICATION_FORMS.map(f => (
              <option key={f.role} value={f.role}>{f.shortLabel}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 rounded-xl border border-foreground/[0.08] bg-card px-3 text-[13px] text-foreground/70 focus:outline-none focus:border-foreground/20"
          >
            <option value="todas">Todos los estados</option>
            {STATUS_LIST.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, IG…"
            className="h-9 flex-1 min-w-[200px] rounded-xl border border-foreground/[0.08] bg-card px-3 text-[13px] text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/20"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-foreground/30">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-foreground/[0.08] bg-foreground/[0.02] px-6 py-20 text-center text-sm text-foreground/40">
            {apps.length === 0
              ? "Todavía no hay candidatos. Compartí el link del formulario para empezar a recibir aplicaciones."
              : "Ningún candidato matchea los filtros actuales."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(app => (
              <button
                key={app.id}
                onClick={() => setSelected(app)}
                className="group flex w-full items-center gap-4 rounded-[14px] border border-foreground/[0.07] bg-card px-5 py-4 text-left transition hover:border-foreground/20"
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${ROLE_BADGE[app.role] ?? "bg-foreground/[0.06] text-foreground/50 border-foreground/10"}`}>
                      {roleLabel(app.role)}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_STYLE[app.status]}`}>
                      {app.status}
                    </span>
                    <span className="text-[11px] text-foreground/25">{fmtDate(app.created_at)}</span>
                  </div>
                  <p className="text-[15px] font-semibold text-foreground truncate">{fullName(app)}</p>
                  <p className="text-[12px] text-foreground/40 truncate">
                    {[app.email, app.whatsapp, app.instagram_handle].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-foreground/20 group-hover:text-foreground/60 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
