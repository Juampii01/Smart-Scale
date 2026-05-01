"use client"

import { useEffect, useState } from "react"
import {
  Cog, BookMarked, FolderKanban, KeyRound,
  Plus, ExternalLink, Trash2, Loader2, FolderOpen,
  Search, AlertTriangle, Link2, FileText, Video, File, X,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceType = "link" | "doc" | "video" | "file"

interface Item {
  id: string
  title: string
  url: string
  description: string | null
  category: string
  type: ResourceType
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "sop-sistemas",
    label: "SOPs de Sistemas",
    icon: Cog,
    color: "text-blue-400",
    accent: "border-blue-400/20 bg-blue-400/5",
    desc: "Automatizaciones, integraciones y documentación técnica de herramientas.",
  },
  {
    id: "sop-operativos",
    label: "SOPs Operativos",
    icon: BookMarked,
    color: "text-green-400",
    accent: "border-green-400/20 bg-green-400/5",
    desc: "Procesos internos paso a paso: onboarding, seguimiento, cierre.",
  },
  {
    id: "recursos-internos",
    label: "Recursos Internos",
    icon: FolderKanban,
    color: "text-purple-400",
    accent: "border-purple-400/20 bg-purple-400/5",
    desc: "Links, plantillas, documentos y materiales del equipo.",
  },
  {
    id: "accesos",
    label: "Accesos y Herramientas",
    icon: KeyRound,
    color: "text-amber-400",
    accent: "border-amber-400/20 bg-amber-400/5",
    desc: "Referencia de herramientas del stack. No guardar contraseñas en texto plano.",
  },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

const TYPE_CONFIG: Record<ResourceType, { label: string; icon: React.ElementType; color: string }> = {
  link:  { label: "Link",    icon: Link2,    color: "text-blue-400"   },
  doc:   { label: "Doc",     icon: FileText,  color: "text-green-400"  },
  video: { label: "Video",   icon: Video,     color: "text-purple-400" },
  file:  { label: "Archivo", icon: File,      color: "text-amber-400"  },
}

const MOCK_SEED: Omit<Item, "id" | "created_at">[] = [
  {
    title: "SOP Zapier — Automatizaciones internas",
    url: "#",
    description: "Qué automatizaciones existen, cómo funcionan, qué herramientas conectan y qué hacer si hay un error.",
    category: "sop-sistemas",
    type: "doc",
  },
  {
    title: "SOP Onboarding — Alta de clientes",
    url: "#",
    description: "Proceso paso a paso para dar de alta un nuevo cliente: links, tareas, herramientas y qué revisar si algo falla.",
    category: "sop-operativos",
    type: "doc",
  },
  {
    title: "Plantillas internas de seguimiento",
    url: "#",
    description: "Plantillas del equipo para seguimiento semanal y reportes.",
    category: "recursos-internos",
    type: "file",
  },
  {
    title: "Links importantes del equipo",
    url: "#",
    description: "Colección de links frecuentes: Drive, Notion, herramientas, etc.",
    category: "recursos-internos",
    type: "link",
  },
  {
    title: "Acceso Zapier",
    url: "https://zapier.com",
    description: "Email de acceso: usar contraseña guardada en el gestor de claves del equipo.",
    category: "accesos",
    type: "link",
  },
]

// ─── Add Item Form ─────────────────────────────────────────────────────────────

function AddItemForm({
  sectionId,
  onAdd,
  onClose,
}: {
  sectionId: SectionId
  onAdd: (item: Item) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    title: "",
    url: "",
    description: "",
    type: "link" as ResourceType,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const isAccesos = sectionId === "accesos"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError("El título es requerido"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, category: sectionId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Error al guardar"); return }
      onAdd(data.resource)
      onClose()
    } catch { setError("Error de conexión") }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-2xl border border-[#ffde21]/20 bg-[#111113] p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Nuevo ítem</h3>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {isAccesos && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            <span className="font-semibold text-amber-300">No guardes contraseñas en texto plano.</span>{" "}
            Usá este campo solo para referencias (email, nombre de usuario, dónde encontrar las credenciales).
            Las contraseñas deben estar en el gestor de claves del equipo.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Título *"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="w-full rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40"
        />
        <input
          type="text"
          placeholder={isAccesos ? "URL de la herramienta (opcional)" : "URL (opcional)"}
          value={form.url}
          onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          className="w-full rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40"
        />
        <textarea
          placeholder={
            isAccesos
              ? "Descripción: email de acceso, dónde están las credenciales…"
              : "Descripción (opcional)"
          }
          value={form.description}
          rows={2}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="w-full rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40 resize-none"
        />
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

// ─── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({ item, onDelete }: { item: Item; onDelete: (id: string) => void }) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.link
  const Icon = cfg.icon
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${item.title}"?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/resources?id=${item.id}`, { method: "DELETE" })
      onDelete(item.id)
    } finally { setDeleting(false) }
  }

  const date = new Date(item.created_at).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
  })

  return (
    <div className="group flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#111113] p-4 hover:border-white/[0.12] transition-all">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] flex-shrink-0 mt-0.5">
        <Icon className={`h-4 w-4 ${cfg.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-white leading-snug">{item.title}</p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-white/20 hover:text-red-400 transition-all mt-0.5"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {item.description && (
          <p className="text-xs text-white/40 leading-relaxed mt-1 line-clamp-2">{item.description}</p>
        )}

        <div className="flex items-center justify-between gap-3 mt-2.5">
          <span className="text-[10px] text-white/20">{date}</span>
          {item.url && item.url !== "#" && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-[#ffde21]/60 hover:text-[#ffde21] transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section Panel ─────────────────────────────────────────────────────────────

function SectionPanel({
  section,
  items,
  onAdd,
  onDelete,
}: {
  section: (typeof SECTIONS)[number]
  items: Item[]
  onAdd: (item: Item) => void
  onDelete: (id: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const Icon = section.icon
  const isAccesos = section.id === "accesos"

  const filtered = items.filter(
    i =>
      search === "" ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className={`flex items-start gap-3 rounded-2xl border p-4 ${section.accent}`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] flex-shrink-0">
          <Icon className={`h-5 w-5 ${section.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white">{section.label}</h2>
          <p className="text-xs text-white/40 mt-0.5">{section.desc}</p>
        </div>
        <span className="text-[10px] font-semibold text-white/20 bg-white/[0.05] rounded-full px-2.5 py-1 flex-shrink-0">
          {items.length}
        </span>
      </div>

      {isAccesos && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/70 leading-relaxed">
            <span className="font-semibold text-amber-300">Aviso de seguridad:</span>{" "}
            No guardar contraseñas en texto plano. Guardá solo referencias (email, usuario, herramienta) y las
            credenciales reales deben vivir en el gestor de claves del equipo (1Password, Bitwarden, etc.).
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            placeholder="Buscar…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl bg-white/[0.05] border border-white/[0.08] pl-9 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40"
          />
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-[#ffde21] px-3.5 py-2 text-sm font-semibold text-black hover:bg-[#ffde21]/90 transition-colors whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <AddItemForm
          sectionId={section.id}
          onAdd={item => { onAdd(item); setShowForm(false) }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <FolderOpen className="h-8 w-8 text-white/10" />
          <p className="text-xs text-white/20">
            {search ? "Sin resultados" : "Todavía no hay ítems en esta sección"}
          </p>
          {!showForm && !search && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs text-[#ffde21]/40 hover:text-[#ffde21] transition-colors"
            >
              + Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(item => (
            <ItemCard key={item.id} item={item} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function AdminCentroOperativoView() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<SectionId>("sop-sistemas")

  useEffect(() => {
    fetch("/api/resources")
      .then(r => r.json())
      .then(d => {
        const fetched: Item[] = d.resources ?? []
        // Seed mock data if DB is empty for centro-operativo categories
        const opCats: string[] = SECTIONS.map(s => s.id)
        const existing = fetched.filter(i => opCats.includes(i.category))
        if (existing.length === 0) {
          const seeded = MOCK_SEED.map((s, idx) => ({
            ...s,
            id: `mock-${idx}`,
            created_at: new Date().toISOString(),
          }))
          setItems([...fetched.filter(i => !opCats.includes(i.category)), ...seeded])
        } else {
          setItems(fetched)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const section = SECTIONS.find(s => s.id === activeSection)!
  const sectionItems = items.filter(i => i.category === activeSection)

  const handleAdd = (item: Item) => setItems(prev => [item, ...prev])
  const handleDelete = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-white/70">Centro Operativo</h1>
        </div>
        <p className="text-xs text-white/30 ml-[18px]">
          Base interna de SOPs, recursos, accesos y procesos del equipo SmartScale.
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {SECTIONS.map(s => {
          const Icon = s.icon
          const count = items.filter(i => i.category === s.id).length
          const isActive = activeSection === s.id
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium border transition-all ${
                isActive
                  ? "border-[#ffde21]/30 bg-[#ffde21]/10 text-[#ffde21]"
                  : "border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-[#ffde21]" : s.color}`} />
              {s.label}
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${isActive ? "bg-[#ffde21]/20 text-[#ffde21]" : "bg-white/[0.07] text-white/30"}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active section */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-white/20" />
        </div>
      ) : (
        <SectionPanel
          section={section}
          items={sectionItems}
          onAdd={handleAdd}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
