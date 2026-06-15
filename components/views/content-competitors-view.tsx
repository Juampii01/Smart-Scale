"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { Plus, X, Instagram, Youtube, Loader2, ExternalLink } from "lucide-react"

type Channel = "instagram" | "youtube"

interface Competitor {
  id: string
  name: string | null
  handle: string | null
  url: string | null
  notes: string | null
  created_at: string
}

const supabase = createClient()

export function ContentCompetitorsView({ channel }: { channel: Channel }) {
  const clientId = useActiveClient()
  const [items, setItems] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [url, setUrl] = useState("")
  const [notes, setNotes] = useState("")

  const isIG = channel === "instagram"
  const Icon = isIG ? Instagram : Youtube
  const iconColor = isIG ? "#818cf8" : "#f87171"
  const channelLabel = isIG ? "Instagram" : "YouTube"
  const entityLabel = isIG ? "perfil" : "canal"

  useEffect(() => {
    let alive = true
    if (!clientId) { setLoading(false); setItems([]); return () => { alive = false } }
    setLoading(true)
    supabase
      .from("content_competitors")
      .select("id, name, handle, url, notes, created_at")
      .eq("client_id", clientId)
      .eq("channel", channel)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (alive) { setItems((data as Competitor[]) ?? []); setLoading(false) } })
    return () => { alive = false }
  }, [clientId, channel])

  async function handleAdd() {
    if (!name.trim() || !clientId || saving) return
    setSaving(true)
    const { data, error } = await supabase
      .from("content_competitors")
      .insert({ client_id: clientId, channel, name: name.trim(), handle: handle.trim() || null, url: url.trim() || null, notes: notes.trim() || null })
      .select("id, name, handle, url, notes, created_at")
      .single()
    setSaving(false)
    if (error || !data) return
    setItems(prev => [data as Competitor, ...prev])
    setName(""); setHandle(""); setUrl(""); setNotes(""); setOpen(false)
  }

  async function handleRemove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from("content_competitors").delete().eq("id", id)
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-foreground leading-tight">{channelLabel} — Competitors</h1>
          <p className="text-[13px] text-foreground/50 mt-0.5">{items.length} {items.length === 1 ? "competidor" : "competidores"}</p>
        </div>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-[8px] bg-[#ffde21] px-4 py-2 text-[13px] font-semibold text-black hover:bg-[#ffe84d] transition-colors">
          <Plus className="h-4 w-4" /> Agregar {entityLabel}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 text-foreground/40"><Loader2 className="h-5 w-5 animate-spin" /></div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[14px]"
            style={{ backgroundColor: `${iconColor}15`, boxShadow: `0 0 0 1px ${iconColor}25` }}>
            <Icon className="h-7 w-7" style={{ color: iconColor }} />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-foreground/70">Todavía no tenés competidores</p>
            <p className="text-[13px] text-foreground/40 mt-1">Agregá un {entityLabel} de {channelLabel} para empezar a comparar.</p>
          </div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(c => (
            <div key={c.id} className="group relative rounded-[14px] border border-foreground/[0.07] bg-card p-4 hover:border-foreground/[0.12] transition-colors">
              <button onClick={() => handleRemove(c.id)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06]">
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${iconColor}18`, boxShadow: `0 0 0 1px ${iconColor}30` }}>
                  <Icon className="h-4 w-4" style={{ color: iconColor }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-foreground leading-tight truncate">{c.name}</p>
                  {c.handle && <p className="text-[12px] text-foreground/40 truncate">{c.handle}</p>}
                </div>
              </div>
              {c.url && (
                <a href={c.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-foreground/50 hover:text-foreground transition-colors truncate max-w-full mt-1">
                  <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{c.url}</span>
                </a>
              )}
              {c.notes && <p className="text-[11px] text-foreground/35 mt-1.5 line-clamp-2">{c.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-[460px] rounded-[14px] border border-foreground/[0.10] bg-card shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-foreground/[0.07]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${iconColor}18` }}>
                  <Icon className="h-4 w-4" style={{ color: iconColor }} />
                </div>
                <h2 className="text-[15px] font-bold text-foreground">Agregar {entityLabel}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-md text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/60">Nombre <span className="text-danger">*</span></label>
                <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={isIG ? "Nombre del perfil" : "Nombre del canal"}
                  className="w-full rounded-[8px] border border-foreground/[0.10] bg-foreground/[0.04] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/[0.25] transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/60">{isIG ? "@handle" : "Handle / @"}</label>
                <input value={handle} onChange={e => setHandle(e.target.value)} placeholder={isIG ? "@usuario" : "@canal"}
                  className="w-full rounded-[8px] border border-foreground/[0.10] bg-foreground/[0.04] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/[0.25] transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/60">Link</label>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
                  className="w-full rounded-[8px] border border-foreground/[0.10] bg-foreground/[0.04] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/[0.25] transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/60">Notas</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Por qué seguirlo, qué hace bien…" rows={2}
                  className="w-full rounded-[8px] border border-foreground/[0.10] bg-foreground/[0.04] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/[0.25] transition-colors resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-5">
              <button onClick={() => setOpen(false)} className="rounded-[8px] border border-foreground/[0.10] px-4 py-2 text-[13px] font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/[0.20] transition-colors">Cancelar</button>
              <button onClick={handleAdd} disabled={!name.trim() || saving}
                className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[13px] font-semibold text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: iconColor }}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
