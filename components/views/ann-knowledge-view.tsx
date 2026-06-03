"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import {
  Sparkles, Plus, Trash2, Loader2, Brain, Eye, EyeOff,
  ChevronDown, Save, Search, X, FileText, Mic, PenLine,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Entry {
  id: string; title: string; content: string
  pillar: string; source_type: string
  is_active: boolean; sort_order: number; updated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────
const PILLAR_CONFIG: Record<string, { label: string; border: string; badge: string; ring: string }> = {
  general: { label: "General",   border: "border-l-foreground/20",  badge: "bg-foreground/[0.07] text-foreground/50",                                       ring: "ring-foreground/20" },
  F:       { label: "Fascinate", border: "border-l-violet-500",     badge: "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400",      ring: "ring-violet-500/30" },
  E:       { label: "Educate",   border: "border-l-blue-500",       badge: "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",              ring: "ring-blue-500/30" },
  T:       { label: "Transform", border: "border-l-emerald-500",    badge: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",  ring: "ring-emerald-500/30" },
  I:       { label: "Invite",    border: "border-l-amber-500",      badge: "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",          ring: "ring-amber-500/30" },
}
const pc = (p: string) => PILLAR_CONFIG[p] ?? PILLAR_CONFIG.general

const PILLAR_BTNS = [
  { value: "general", label: "General" },
  { value: "F", label: "Fascinate" },
  { value: "E", label: "Educate" },
  { value: "T", label: "Transform" },
  { value: "I", label: "Invite" },
]

const SOURCE_TYPES = [
  { value: "manual",     label: "Manual",        Icon: PenLine },
  { value: "transcript", label: "Transcripción", Icon: Mic },
  { value: "documento",  label: "Documento",     Icon: FileText },
]

const FILTER_TABS = [
  { value: "all",     label: "Todo" },
  { value: "general", label: "General" },
  { value: "F",       label: "Fascinate" },
  { value: "E",       label: "Educate" },
  { value: "T",       label: "Transform" },
  { value: "I",       label: "Invite" },
]

// ─── Auth fetch ───────────────────────────────────────────────────────────────
async function authedFetch(path: string, opts: RequestInit = {}) {
  const { data: { session } } = await createClient().auth.getSession()
  return fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      ...(opts.headers ?? {}),
    },
  })
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AnnKnowledgeView() {
  const [items,   setItems]   = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Filter / search
  const [filterPillar, setFilterPillar] = useState("all")
  const [search,       setSearch]       = useState("")

  // Form (add new)
  const [formOpen,    setFormOpen]    = useState(false)
  const [title,       setTitle]       = useState("")
  const [pillar,      setPillar]      = useState("general")
  const [sourceType,  setSourceType]  = useState("manual")
  const [content,     setContent]     = useState("")
  const [saving,      setSaving]      = useState(false)

  // Edit (inline expand)
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [editTitle,    setEditTitle]    = useState("")
  const [editContent,  setEditContent]  = useState("")

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await authedFetch("/api/admin/ann-knowledge")
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Error al cargar"); return }
      setItems(data.items ?? [])
    } catch (e: any) { setError(e?.message ?? "Error") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = items
    if (filterPillar !== "all") list = list.filter(i => i.pillar === filterPillar)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q)
      )
    }
    return list
  }, [items, filterPillar, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length }
    items.forEach(i => { c[i.pillar] = (c[i.pillar] ?? 0) + 1 })
    return c
  }, [items])

  const activeCount = items.filter(i => i.is_active).length

  // ── Actions ──────────────────────────────────────────────────────────────────
  const add = async () => {
    if (!title.trim() || !content.trim() || saving) return
    setSaving(true); setError(null)
    try {
      const res  = await authedFetch("/api/admin/ann-knowledge", {
        method: "POST",
        body: JSON.stringify({ title, content, pillar, source_type: sourceType }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Error al guardar"); return }
      setItems(prev => [...prev, data.item])
      setTitle(""); setContent(""); setPillar("general"); setSourceType("manual")
      setFormOpen(false)
    } finally { setSaving(false) }
  }

  const toggleActive = async (e: Entry) => {
    const res = await authedFetch("/api/admin/ann-knowledge", {
      method: "PATCH", body: JSON.stringify({ id: e.id, is_active: !e.is_active }),
    })
    if (res.ok) {
      const d = await res.json()
      setItems(prev => prev.map(x => x.id === e.id ? d.item : x))
    }
  }

  const saveEdit = async (id: string) => {
    const res = await authedFetch("/api/admin/ann-knowledge", {
      method: "PATCH", body: JSON.stringify({ id, title: editTitle, content: editContent }),
    })
    if (res.ok) {
      const d = await res.json()
      setItems(prev => prev.map(x => x.id === id ? d.item : x))
      setExpanded(null)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta entrada del cerebro?")) return
    const res = await authedFetch("/api/admin/ann-knowledge", {
      method: "DELETE", body: JSON.stringify({ id }),
    })
    if (res.ok) setItems(prev => prev.filter(x => x.id !== id))
  }

  const openEdit = (e: Entry) => {
    if (expanded === e.id) { setExpanded(null); return }
    setExpanded(e.id); setEditTitle(e.title); setEditContent(e.content)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ffde21] shadow-[0_0_32px_rgba(255,222,33,0.35)]">
            <Brain className="h-6 w-6 text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground leading-none">
              Cerebro de Ann
            </h1>
            <p className="mt-1.5 text-[13px] text-foreground/40">
              Todo lo que cargués acá, Ann AI lo usa para responder.
              {items.length > 0 && (
                <span className="ml-2 text-foreground/25">
                  {items.length} entrada{items.length !== 1 ? "s" : ""} · {activeCount} activa{activeCount !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setFormOpen(v => !v)}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe46b] active:scale-95"
        >
          {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {formOpen ? "Cancelar" : "Nueva entrada"}
        </button>
      </div>

      {/* ── Add form ───────────────────────────────────────────────────────── */}
      {formOpen && (
        <div className="rounded-2xl border border-[#ffde21]/20 bg-card p-6 shadow-[0_0_0_1px_rgba(255,222,33,0.08),0_4px_24px_rgba(255,222,33,0.06)] space-y-4">

          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Título de la entrada…"
            className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-3 text-sm font-medium text-foreground placeholder:text-foreground/25 focus:border-[#ffde21]/50 focus:outline-none focus:ring-2 focus:ring-[#ffde21]/10 transition"
          />

          <div className="grid grid-cols-2 gap-4">
            {/* Pillar */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/35">Pilar</p>
              <div className="flex flex-wrap gap-1.5">
                {PILLAR_BTNS.map(p => (
                  <button key={p.value} onClick={() => setPillar(p.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      pillar === p.value
                        ? `${pc(p.value).badge} ring-1 ring-inset ${pc(p.value).ring}`
                        : "bg-foreground/[0.05] text-foreground/40 hover:bg-foreground/[0.08]"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Source type */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/35">Tipo</p>
              <div className="flex flex-wrap gap-1.5">
                {SOURCE_TYPES.map(({ value, label, Icon }) => (
                  <button key={value} onClick={() => setSourceType(value)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      sourceType === value
                        ? "bg-[#ffde21]/10 text-[#ffde21]/90 ring-1 ring-inset ring-[#ffde21]/20"
                        : "bg-foreground/[0.05] text-foreground/40 hover:bg-foreground/[0.08]"
                    }`}>
                    <Icon className="h-3 w-3" />{label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={content} onChange={e => setContent(e.target.value)} rows={8}
              placeholder="Pegá acá el contenido: metodología, transcripción de un video, un marco de trabajo, un SOP… todo lo que Ann enseñe."
              className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-foreground/25 focus:border-[#ffde21]/50 focus:outline-none focus:ring-2 focus:ring-[#ffde21]/10 transition"
            />
            {content.length > 0 && (
              <span className="absolute bottom-3 right-3 text-[10px] text-foreground/25 pointer-events-none">
                {content.length.toLocaleString()} chars
              </span>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button onClick={add} disabled={saving || !title.trim() || !content.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe46b] active:scale-95 disabled:opacity-40">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Agregar al cerebro
            </button>
          </div>
        </div>
      )}

      {/* ── Filter + Search ────────────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {FILTER_TABS.map(tab => (
              <button key={tab.value} onClick={() => setFilterPillar(tab.value)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  filterPillar === tab.value
                    ? "bg-foreground/[0.08] text-foreground"
                    : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.05]"
                }`}>
                {tab.label}
                {counts[tab.value] != null && counts[tab.value] > 0 && (
                  <span className={`rounded px-1 text-[10px] font-bold tabular-nums ${
                    filterPillar === tab.value ? "text-foreground/50" : "text-foreground/25"
                  }`}>
                    {counts[tab.value]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/30" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-36 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/20 focus:w-48 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── List ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-foreground/[0.07] bg-card py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/[0.04]">
            <Sparkles className="h-5 w-5 text-foreground/20" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground/40">
              {search || filterPillar !== "all" ? "Sin resultados" : "El cerebro está vacío"}
            </p>
            <p className="mt-1 text-xs text-foreground/25">
              {search || filterPillar !== "all"
                ? "Probá con otros filtros."
                : "Agregá la primera pieza de conocimiento arriba."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => {
            const cfg    = pc(e.pillar)
            const src    = SOURCE_TYPES.find(s => s.value === e.source_type)
            const SrcIcon = src?.Icon ?? PenLine
            const isExp  = expanded === e.id

            return (
              <div key={e.id}
                className={`overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card border-l-[3px] ${cfg.border} transition-opacity ${!e.is_active ? "opacity-45" : ""}`}>

                {/* ── Card row ── */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => openEdit(e)} className="min-w-0 flex-1 text-left group">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-foreground group-hover:text-[#ffde21] transition-colors">
                        {e.title}
                      </span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-foreground/30">
                        <SrcIcon className="h-3 w-3" />{src?.label ?? "Manual"}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-foreground/40">
                      {e.content}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => toggleActive(e)} title={e.is_active ? "Desactivar" : "Activar"}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/25 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-all">
                      {e.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => remove(e.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/20 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => openEdit(e)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/30 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-all">
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExp ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* ── Inline edit ── */}
                {isExp && (
                  <div className="border-t border-foreground/[0.06] bg-foreground/[0.015] p-5 space-y-3">
                    <input value={editTitle} onChange={ev => setEditTitle(ev.target.value)}
                      className="w-full rounded-xl border border-foreground/[0.08] bg-card px-4 py-2.5 text-sm font-medium text-foreground focus:border-[#ffde21]/50 focus:outline-none focus:ring-2 focus:ring-[#ffde21]/10 transition" />
                    <div className="relative">
                      <textarea value={editContent} onChange={ev => setEditContent(ev.target.value)} rows={10}
                        className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-card px-4 py-3 text-sm text-foreground focus:border-[#ffde21]/50 focus:outline-none focus:ring-2 focus:ring-[#ffde21]/10 transition" />
                      <span className="pointer-events-none absolute bottom-3 right-3 text-[10px] text-foreground/25">
                        {editContent.length.toLocaleString()} chars
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-foreground/30">
                        Actualizado {new Date(e.updated_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <button onClick={() => saveEdit(e.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#ffe46b] active:scale-95">
                        <Save className="h-3.5 w-3.5" /> Guardar cambios
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
