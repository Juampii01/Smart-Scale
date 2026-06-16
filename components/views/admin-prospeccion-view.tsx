"use client"

/**
 * Prospección — workspace privado del setter.
 *
 * Cada setter ve únicamente sus propios items. Admin tiene oversight.
 *
 * Items son flexibles: pueden ser listas (ej. "Cuentas a contactar"), scripts
 * (ej. "DM 1er contacto"), notas (ej. "follow-ups pendientes") o follow-ups.
 *
 * Schema: title + content (markdown / plano) + tags + item_type + status.
 */

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Plus, Search, X, Trash2, Edit3, Lock, FileText,
  ChevronRight, ListChecks, MessageSquare, Bell,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Item {
  id:         string
  setter_id:  string
  title:      string
  content:    string | null
  item_type:  string
  tags:       string[]
  status:     string
  created_at: string
  updated_at: string
}

const TYPE_OPTIONS: { value: string; label: string; icon: any }[] = [
  { value: "nota",       label: "Nota",       icon: FileText },
  { value: "lista",      label: "Lista",      icon: ListChecks },
  { value: "script",     label: "Script",     icon: MessageSquare },
  { value: "follow-up",  label: "Follow-up",  icon: Bell },
]

const STATUS_STYLE: Record<string, string> = {
  activo:     "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  archivado:  "bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-500/10 dark:text-zinc-400 dark:border-zinc-500/20",
  cerrado:    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

function typeIcon(type: string) {
  return TYPE_OPTIONS.find(o => o.value === type)?.icon ?? FileText
}

function typeLabel(type: string) {
  return TYPE_OPTIONS.find(o => o.value === type)?.label ?? type
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  item, onClose, onEdit, onDelete, deleting,
}: {
  item:     Item
  onClose:  () => void
  onEdit:   (item: Item) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const Icon = typeIcon(item.item_type)
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[560px] flex-col border-l border-foreground/[0.08] shadow-2xl bg-card">
        <div className="flex items-start justify-between gap-4 border-b border-foreground/[0.06] px-6 py-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-foreground/[0.08] bg-foreground/[0.03] px-2 py-0.5 text-[10px] font-bold text-foreground/70">
                <Icon className="h-2.5 w-2.5" /> {typeLabel(item.item_type)}
              </span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_STYLE[item.status] ?? STATUS_STYLE.activo}`}>
                {item.status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground">{item.title}</h2>
            {item.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {item.tags.map(t => (
                  <span key={t} className="inline-flex items-center rounded-full border border-foreground/[0.08] bg-foreground/[0.03] px-2 py-0.5 text-[10px] font-medium text-foreground/60">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onEdit(item)} className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-all" title="Editar">
              <Edit3 className="h-4 w-4" />
            </button>
            <button onClick={() => onDelete(item.id)} disabled={deleting} className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/30 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition-all disabled:opacity-40" title="Borrar">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde21]/40">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {item.content ? (
            <pre className="rounded-xl border border-foreground/[0.07] bg-foreground/[0.02] px-4 py-3.5 text-[13.5px] text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans">{item.content}</pre>
          ) : (
            <p className="text-[13px] text-foreground/40 italic">Sin contenido. Tocá editar para agregarlo.</p>
          )}
          <p className="text-[11px] text-foreground/30 pt-2">
            Creado {fmtDate(item.created_at)}{item.created_at !== item.updated_at ? ` · editado ${fmtDate(item.updated_at)}` : ""}
          </p>
        </div>
      </div>
    </>
  )
}

// ─── Create / edit modal ──────────────────────────────────────────────────────

interface FormShape {
  title:     string
  content:   string
  item_type: string
  tags:      string  // comma-separated
  status:    string
}

const EMPTY_FORM: FormShape = {
  title: "", content: "", item_type: "nota", tags: "", status: "activo",
}

function itemToForm(it: Item): FormShape {
  return {
    title:     it.title,
    content:   it.content ?? "",
    item_type: it.item_type,
    tags:      it.tags.join(", "),
    status:    it.status,
  }
}

function CreateEditModal({
  initialItem, onClose, onSaved,
}: {
  initialItem: Item | null
  onClose:     () => void
  onSaved:     (item: Item) => void
}) {
  const isEdit = Boolean(initialItem)
  const [form, setForm] = useState<FormShape>(initialItem ? itemToForm(initialItem) : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const update = (k: keyof FormShape) => (v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.title.trim()) { setError("Falta el título"); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("No autenticado"); return }

      const tagsArr = form.tags.split(",").map(t => t.trim()).filter(Boolean)

      const body = {
        ...(isEdit ? { id: initialItem!.id } : {}),
        title:     form.title.trim(),
        content:   form.content.trim(),
        item_type: form.item_type,
        tags:      tagsArr,
        status:    form.status,
      }

      const res = await fetch("/api/admin/prospeccion", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.item) {
        setError(json?.error ?? "Error guardando")
        return
      }
      onSaved(json.item)
    } catch (e: any) {
      setError(e?.message ?? "Error inesperado")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative flex h-full max-h-[85vh] w-full max-w-2xl flex-col rounded-[14px] border border-foreground/[0.08] bg-card shadow-2xl overflow-hidden">

          <div className="flex items-center justify-between gap-4 border-b border-foreground/[0.06] px-6 py-4 shrink-0">
            <h2 className="text-lg font-bold text-foreground">{isEdit ? "Editar item" : "Nuevo item"}</h2>
            <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde21]/40">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 mb-1.5">Título</label>
                <input
                  value={form.title}
                  onChange={e => update("title")(e.target.value)}
                  placeholder="Ej. Cuentas a contactar - Marzo"
                  className="w-full h-10 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 mb-1.5">Tipo</label>
                <select
                  value={form.item_type}
                  onChange={e => update("item_type")(e.target.value)}
                  className="w-full h-10 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 text-[13.5px] text-foreground focus:border-foreground/20 focus:outline-none"
                >
                  {TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 mb-1.5">Estado</label>
                <select
                  value={form.status}
                  onChange={e => update("status")(e.target.value)}
                  className="w-full h-10 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 text-[13.5px] text-foreground focus:border-foreground/20 focus:outline-none"
                >
                  <option value="activo">Activo</option>
                  <option value="archivado">Archivado</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 mb-1.5">Tags (coma)</label>
                <input
                  value={form.tags}
                  onChange={e => update("tags")(e.target.value)}
                  placeholder="dm, instagram, frio"
                  className="w-full h-10 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 mb-1.5">Contenido</label>
              <textarea
                value={form.content}
                onChange={e => update("content")(e.target.value)}
                rows={12}
                placeholder="Pegá tu lista, script, notas o lo que necesites guardar. Soporta texto plano y saltos de línea."
                className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none resize-y leading-relaxed"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-300 bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 px-3 py-2 text-[12.5px] text-red-800 dark:text-red-300">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-foreground/[0.06] px-6 py-3 shrink-0">
            <button onClick={onClose} type="button" className="h-9 rounded-lg border border-foreground/[0.08] px-4 text-[12.5px] font-semibold text-foreground/60 hover:text-foreground hover:border-foreground/20 transition-all">
              Cancelar
            </button>
            <button onClick={save} disabled={saving || !form.title.trim()} className="inline-flex items-center gap-2 h-9 rounded-lg bg-[#ffde21] px-4 text-[12.5px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40">
              {saving
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</>
                : isEdit ? "Guardar cambios" : "Crear item"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AdminProspeccionView() {
  const [items,    setItems]    = useState<Item[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState("")
  const [filterType, setFilterType] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("activo")  // por default mostrar solo activos
  const [activeTag,  setActiveTag]  = useState<string | null>(null)
  const [selected, setSelected] = useState<Item | null>(null)
  const [editing,  setEditing]  = useState<Item | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const res = await fetch("/api/admin/prospeccion", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      setItems(res.ok ? (json.items ?? []) : [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  const allTags = Array.from(new Set(items.flatMap(i => i.tags))).sort()

  const filtered = items.filter(i => {
    if (filterStatus !== "todos" && i.status !== filterStatus) return false
    if (filterType && i.item_type !== filterType) return false
    if (activeTag && !i.tags.includes(activeTag)) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [i.title, i.content, ...i.tags]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q))
  })

  const onSaved = (saved: Item) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = saved; return next
      }
      return [saved, ...prev]
    })
    setCreating(false)
    setEditing(null)
    setSelected(saved)
  }

  const onDelete = async (id: string) => {
    if (!confirm("¿Borrar este item? La acción no se puede deshacer.")) return
    setDeletingId(id)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch("/api/admin/prospeccion", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json?.error ?? "Error borrando")
        return
      }
      setItems(prev => prev.filter(i => i.id !== id))
      setSelected(null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Prospección</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Lock className="h-2.5 w-2.5" /> Privado
            </span>
          </div>
          <p className="text-[13px] text-foreground/50">
            Tu workspace para listas, scripts, notas y follow-ups. Solo vos lo ves.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 h-10 rounded-xl bg-[#ffde21] px-4 text-[13px] font-bold text-black hover:bg-[#ffe84d] transition-all shrink-0"
        >
          <Plus className="h-4 w-4" /> Nuevo item
        </button>
      </div>

      {/* Search + filters */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título, contenido, tag…"
            className="w-full h-10 rounded-xl border border-foreground/[0.08] bg-card pl-10 pr-3 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none"
          />
        </div>

        {/* Type filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterType(null)}
            className={`h-7 rounded-full border px-3 text-[11px] font-semibold transition-all ${filterType == null ? "border-[#ffde21]/50 bg-[#ffde21]/15 text-[#ffde21]" : "border-foreground/[0.08] text-foreground/50 hover:text-foreground hover:border-foreground/20"}`}
          >
            Todos
          </button>
          {TYPE_OPTIONS.map(o => {
            const Icon = o.icon
            const active = filterType === o.value
            return (
              <button
                key={o.value}
                onClick={() => setFilterType(active ? null : o.value)}
                className={`inline-flex items-center gap-1 h-7 rounded-full border px-3 text-[11px] font-medium transition-all ${active ? "border-[#ffde21]/50 bg-[#ffde21]/15 text-[#ffde21]" : "border-foreground/[0.08] text-foreground/50 hover:text-foreground hover:border-foreground/20"}`}
              >
                <Icon className="h-3 w-3" /> {o.label}
              </button>
            )
          })}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5">
          {(["activo", "archivado", "cerrado", "todos"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`h-7 rounded-full border px-3 text-[11px] font-semibold capitalize transition-all ${filterStatus === s ? "border-foreground/30 bg-foreground/[0.07] text-foreground" : "border-foreground/[0.08] text-foreground/50 hover:text-foreground hover:border-foreground/20"}`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {allTags.map(t => (
              <button
                key={t}
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                className={`h-6 rounded-full border px-2.5 text-[10.5px] font-medium transition-all ${activeTag === t ? "border-[#ffde21]/50 bg-[#ffde21]/15 text-[#ffde21]" : "border-foreground/[0.08] text-foreground/50 hover:text-foreground hover:border-foreground/20"}`}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/50" />
        </div>
      ) : !filtered.length ? (
        <div className="rounded-[14px] border border-foreground/[0.08] bg-card py-16 text-center">
          <FileText className="mx-auto h-8 w-8 text-foreground/20 mb-2" />
          <p className="text-[14px] text-foreground/50">
            {items.length === 0 ? "Todavía no tenés items." : "No hay items con esos filtros."}
          </p>
          {items.length === 0 && (
            <p className="text-[12px] text-foreground/30 mt-1">Tocá "Nuevo item" para empezar a guardar tu trabajo.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(item => {
            const Icon = typeIcon(item.item_type)
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className="group flex flex-col gap-2 rounded-[14px] border border-foreground/[0.07] bg-card p-4 text-left hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-foreground/[0.08] bg-foreground/[0.03] px-1.5 py-0.5 text-[9.5px] font-bold text-foreground/70">
                        <Icon className="h-2.5 w-2.5" /> {typeLabel(item.item_type)}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold capitalize ${STATUS_STYLE[item.status] ?? STATUS_STYLE.activo}`}>
                        {item.status}
                      </span>
                    </div>
                    <h3 className="text-[14.5px] font-bold text-foreground leading-snug group-hover:text-[#ffde21] transition-colors">{item.title}</h3>
                    {item.content && (
                      <p className="text-[12.5px] text-foreground/50 mt-1 line-clamp-2 whitespace-pre-wrap">{item.content}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-foreground/30 group-hover:text-foreground/60 transition-colors shrink-0 mt-0.5" />
                </div>

                {item.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {item.tags.slice(0, 4).map(t => (
                      <span key={t} className="inline-flex items-center rounded-full border border-foreground/[0.08] bg-foreground/[0.02] px-1.5 py-0.5 text-[10px] font-medium text-foreground/55">
                        #{t}
                      </span>
                    ))}
                    {item.tags.length > 4 && (
                      <span className="text-[10px] text-foreground/40">+{item.tags.length - 4}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1.5 border-t border-foreground/[0.05] mt-1">
                  <span className="text-[10.5px] text-foreground/45">{fmtDate(item.created_at)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <DetailDrawer
          item={selected}
          onClose={() => setSelected(null)}
          onEdit={(item) => { setEditing(item); setSelected(null) }}
          onDelete={onDelete}
          deleting={deletingId === selected.id}
        />
      )}

      {/* Modal */}
      {(creating || editing) && (
        <CreateEditModal
          initialItem={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
