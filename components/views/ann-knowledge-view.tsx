"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { Sparkles, Plus, Trash2, Loader2, Brain, Eye, EyeOff, ChevronDown, ChevronUp, Save } from "lucide-react"

interface Entry {
  id: string
  title: string
  content: string
  pillar: string
  source_type: string
  is_active: boolean
  updated_at: string
}

const PILLARS = [
  { value: "general", label: "General" },
  { value: "F", label: "Fascinate" },
  { value: "E", label: "Educate" },
  { value: "T", label: "Transform" },
  { value: "I", label: "Invite" },
]
const pillarLabel = (p: string) => PILLARS.find(x => x.value === p)?.label ?? "General"

async function authedFetch(path: string, opts: RequestInit = {}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token ?? ""}`, ...(opts.headers ?? {}) },
  })
}

export function AnnKnowledgeView() {
  const [items, setItems] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // add form
  const [title, setTitle] = useState("")
  const [pillar, setPillar] = useState("general")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editTitle, setEditTitle] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/ann-knowledge")
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Error al cargar"); return }
      setItems(data.items ?? [])
    } catch (e: any) { setError(e?.message ?? "Error") } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!title.trim() || !content.trim() || saving) return
    setSaving(true); setError(null)
    try {
      const res = await authedFetch("/api/admin/ann-knowledge", {
        method: "POST",
        body: JSON.stringify({ title, content, pillar }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Error al guardar"); return }
      setItems(prev => [...prev, data.item])
      setTitle(""); setContent(""); setPillar("general")
    } finally { setSaving(false) }
  }

  const toggleActive = async (e: Entry) => {
    const res = await authedFetch("/api/admin/ann-knowledge", {
      method: "PATCH", body: JSON.stringify({ id: e.id, is_active: !e.is_active }),
    })
    if (res.ok) { const d = await res.json(); setItems(prev => prev.map(x => x.id === e.id ? d.item : x)) }
  }

  const saveEdit = async (id: string) => {
    const res = await authedFetch("/api/admin/ann-knowledge", {
      method: "PATCH", body: JSON.stringify({ id, title: editTitle, content: editContent }),
    })
    if (res.ok) { const d = await res.json(); setItems(prev => prev.map(x => x.id === id ? d.item : x)); setExpanded(null) }
  }

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta entrada del cerebro?")) return
    const res = await authedFetch("/api/admin/ann-knowledge", { method: "DELETE", body: JSON.stringify({ id }) })
    if (res.ok) setItems(prev => prev.filter(x => x.id !== id))
  }

  const openEdit = (e: Entry) => {
    if (expanded === e.id) { setExpanded(null); return }
    setExpanded(e.id); setEditTitle(e.title); setEditContent(e.content)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffde21] shadow-[0_0_24px_rgba(255,222,33,0.30)]">
          <Brain className="h-5 w-5 text-black" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-none">Cerebro de Ann</h1>
          <p className="text-[12px] text-foreground/40 mt-1.5">Todo lo que cargues acá, Ann AI lo usa para responder.</p>
        </div>
      </div>

      {/* Add form */}
      <div className="rounded-2xl border border-foreground/[0.08] bg-card p-5 space-y-3">
        <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-[#ffde21]" /><h2 className="text-sm font-bold text-foreground">Agregar conocimiento</h2></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Título (ej: Cómo construir una oferta irresistible)"
            className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/25 focus:border-[#ffde21]/40 focus:outline-none"
          />
          <select value={pillar} onChange={e => setPillar(e.target.value)}
            className="rounded-xl border border-foreground/[0.08] bg-card px-4 py-2.5 text-sm text-foreground/80 focus:outline-none">
            {PILLARS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <textarea
          value={content} onChange={e => setContent(e.target.value)} rows={6}
          placeholder="Pegá acá el contenido: metodología, transcripción de un video, un marco de trabajo, un SOP… todo lo que Ann enseñe."
          className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-foreground/25 focus:border-[#ffde21]/40 focus:outline-none"
        />
        <button onClick={add} disabled={saving || !title.trim() || !content.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe46b] disabled:opacity-40">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar al cerebro
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-500/20 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-foreground/30" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-foreground/[0.07] bg-card py-14 text-center">
          <Sparkles className="h-6 w-6 text-foreground/20" />
          <p className="text-sm text-foreground/40">El cerebro está vacío. Agregá la primera pieza de conocimiento arriba.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="px-1 text-xs text-foreground/30">{items.length} entrada{items.length !== 1 ? "s" : ""} · {items.filter(i => i.is_active).length} activa{items.filter(i => i.is_active).length !== 1 ? "s" : ""}</p>
          {items.map(e => (
            <div key={e.id} className={`overflow-hidden rounded-2xl border bg-card transition-all ${e.is_active ? "border-foreground/[0.08]" : "border-foreground/[0.05] opacity-55"}`}>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <button onClick={() => openEdit(e)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground truncate">{e.title}</span>
                    <span className="shrink-0 rounded-md bg-[#ffde21]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ffde21]/80">{pillarLabel(e.pillar)}</span>
                  </div>
                  <p className="text-[11px] text-foreground/35 truncate mt-0.5">{e.content.slice(0, 90)}…</p>
                </button>
                <button onClick={() => toggleActive(e)} title={e.is_active ? "Desactivar" : "Activar"}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/30 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-all">
                  {e.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button onClick={() => remove(e.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/25 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => openEdit(e)} className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/30 hover:text-foreground/70">{expanded === e.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
              </div>
              {expanded === e.id && (
                <div className="border-t border-foreground/[0.06] p-5 space-y-3">
                  <input value={editTitle} onChange={ev => setEditTitle(ev.target.value)}
                    className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-2.5 text-sm text-foreground focus:border-[#ffde21]/40 focus:outline-none" />
                  <textarea value={editContent} onChange={ev => setEditContent(ev.target.value)} rows={8}
                    className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-3 text-sm text-foreground focus:border-[#ffde21]/40 focus:outline-none" />
                  <button onClick={() => saveEdit(e.id)} className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-sm font-bold text-black hover:bg-[#ffe46b]"><Save className="h-4 w-4" /> Guardar cambios</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
