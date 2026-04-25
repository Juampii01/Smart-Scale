"use client"

import { useEffect, useState } from "react"
import {
  Link2, FileText, Video, File, Plus, Trash2, Search,
  ExternalLink, X, Loader2, FolderOpen,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceType = "link" | "doc" | "video" | "file"

interface Resource {
  id: string
  title: string
  url: string
  description: string | null
  category: string
  type: ResourceType
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ResourceType, { label: string; icon: React.ElementType; color: string }> = {
  link:  { label: "Link",     icon: Link2,    color: "text-blue-400" },
  doc:   { label: "Doc",      icon: FileText,  color: "text-green-400" },
  video: { label: "Video",    icon: Video,     color: "text-purple-400" },
  file:  { label: "Archivo",  icon: File,      color: "text-amber-400" },
}

function typeFromUrl(url: string): ResourceType {
  const u = url.toLowerCase()
  if (u.includes("youtube.com") || u.includes("youtu.be") || u.includes("loom.com")) return "video"
  if (u.includes("docs.google.com") || u.includes("notion.so") || u.includes(".pdf")) return "doc"
  return "link"
}

// ─── Add Resource Form ────────────────────────────────────────────────────────

function AddResourceForm({ onAdd, onClose }: { onAdd: (r: Resource) => void; onClose: () => void }) {
  const [form, setForm] = useState({ title: "", url: "", description: "", category: "", type: "link" as ResourceType })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleUrlChange = (url: string) => {
    setForm(f => ({ ...f, url, type: typeFromUrl(url) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.url.trim()) { setError("Título y URL son requeridos"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Error al guardar"); return }
      onAdd(data.resource)
      onClose()
    } catch { setError("Error de conexión") }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-2xl border border-[#ffde21]/20 bg-[#111113] p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Agregar recurso</h3>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Título *"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40 w-full"
          />
          <input
            type="text"
            placeholder="Categoría (ej: Marketing, Ventas…)"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40 w-full"
          />
        </div>

        <input
          type="url"
          placeholder="URL *"
          value={form.url}
          onChange={e => handleUrlChange(e.target.value)}
          className="rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40 w-full"
        />

        <input
          type="text"
          placeholder="Descripción (opcional)"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40 w-full"
        />

        {/* Type selector */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(TYPE_CONFIG) as ResourceType[]).map(t => {
            const cfg = TYPE_CONFIG[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                  form.type === t
                    ? "border-[#ffde21]/40 bg-[#ffde21]/10 text-[#ffde21]"
                    : "border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70"
                }`}
              >
                <cfg.icon className="h-3 w-3" />
                {cfg.label}
              </button>
            )
          })}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-sm font-semibold text-black hover:bg-[#ffde21]/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Guardar
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Resource Card ────────────────────────────────────────────────────────────

function ResourceCard({ resource, onDelete }: { resource: Resource; onDelete: (id: string) => void }) {
  const cfg = TYPE_CONFIG[resource.type] ?? TYPE_CONFIG.link
  const Icon = cfg.icon
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${resource.title}"?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/resources?id=${resource.id}`, { method: "DELETE" })
      onDelete(resource.id)
    } finally { setDeleting(false) }
  }

  return (
    <div className="group rounded-2xl border border-white/[0.07] bg-[#111113] p-4 flex flex-col gap-3 hover:border-white/[0.12] transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] flex-shrink-0">
            <Icon className={`h-4 w-4 ${cfg.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{resource.title}</p>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {resource.category}
            </span>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-white/20 hover:text-red-400 transition-all"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {resource.description && (
        <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{resource.description}</p>
      )}

      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto flex items-center gap-1.5 text-xs font-medium text-[#ffde21]/70 hover:text-[#ffde21] transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Abrir
      </a>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function ResourcesView() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("Todos")
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetch("/api/resources")
      .then(r => r.json())
      .then(d => setResources(d.resources ?? []))
      .finally(() => setLoading(false))
  }, [])

  const categories = ["Todos", ...Array.from(new Set(resources.map(r => r.category))).sort()]

  const filtered = resources.filter(r => {
    const matchSearch = search === "" ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === "Todos" || r.category === activeCategory
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <h1 className="text-sm font-semibold uppercase tracking-widest text-white/70">Biblioteca</h1>
          </div>
          <p className="text-xs text-white/30 ml-[18px]">Links, docs y recursos guardados</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-sm font-semibold text-black hover:bg-[#ffde21]/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agregar
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <AddResourceForm
          onAdd={r => setResources(prev => [r, ...prev])}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            placeholder="Buscar…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl bg-white/[0.05] border border-white/[0.08] pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-lg px-3 py-2 text-xs font-medium border transition-all ${
                activeCategory === cat
                  ? "border-[#ffde21]/40 bg-[#ffde21]/10 text-[#ffde21]"
                  : "border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-white/20" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <FolderOpen className="h-10 w-10 text-white/10" />
          <p className="text-sm text-white/20">
            {search || activeCategory !== "Todos" ? "Sin resultados" : "Todavía no hay recursos guardados"}
          </p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs text-[#ffde21]/50 hover:text-[#ffde21] transition-colors"
            >
              + Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(r => (
            <ResourceCard
              key={r.id}
              resource={r}
              onDelete={id => setResources(prev => prev.filter(x => x.id !== id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
