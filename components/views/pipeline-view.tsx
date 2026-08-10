"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, X, Loader2, Star, Instagram, ExternalLink, Trash2, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import type { Lead } from "@/components/views/admin-leads-view"
import { igHref, igLabel, fmtDate } from "@/components/views/admin-leads-view"
import { PipelineBoard } from "@/components/leads-pipeline/PipelineBoard"
import { PIPELINE_COLUMNS, effectiveStage } from "@/components/leads-pipeline/constants"

// Vista cliente-facing del pipeline de prospectos propio (Paso 1 de
// Fundaciones del roadmap multi-tenant). Reusa el mismo motor de Kanban
// que el pipeline interno (components/leads-pipeline/*) contra la ruta
// /api/client/prospects — cada cliente ve y edita solo su propia cartera,
// aislada a nivel de base de datos (ver migración client_prospects).

async function authHeaders() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error("Sin sesión")
  return { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }
}

function StarRating({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          className="p-0.5"
        >
          <Star
            className={`h-5 w-5 transition-colors ${
              (value ?? 0) >= n ? "fill-[#dafc69] text-[#dafc69]" : "text-foreground/15"
            }`}
          />
        </button>
      ))}
    </div>
  )
}

function fieldInput(
  label: string,
  value: string,
  onBlur: (v: string) => void,
  placeholder = "",
) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">{label}</p>
      <input
        type="text"
        defaultValue={value}
        placeholder={placeholder}
        onBlur={e => onBlur(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
        className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all"
      />
    </div>
  )
}

function DetailModal({ prospect, onClose, onPatch, onDelete, deleting }: {
  prospect: Lead
  onClose:  () => void
  onPatch:  (id: string, updates: Partial<Lead>) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const ig = prospect.instagram?.trim()

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[440px] flex-col border-l border-foreground/[0.08] shadow-2xl" style={{ backgroundColor: "var(--card)" }}>
        <div className="flex items-start justify-between gap-4 border-b border-foreground/[0.06] px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{prospect.name ?? "Prospecto"}</h2>
            <p className="text-[12px] text-foreground/35 mt-0.5">{fmtDate(prospect.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onDelete(prospect.id)} disabled={deleting} aria-label="Eliminar prospecto"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/20 hover:text-foreground hover:bg-foreground/[0.08] transition-all disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose} aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-foreground/[0.06] px-6 py-4 space-y-3">
          <StarRating value={prospect.rating} onChange={n => onPatch(prospect.id, { rating: n || null })} />
          {ig && (
            <a href={igHref(ig)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-[13px] text-[#dafc69] hover:text-[#f2ffc0] transition-colors">
              <Instagram className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{igLabel(ig)}</span>
              <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
            </a>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Etapa del pipeline</p>
            <select
              value={effectiveStage(prospect) ?? "__none__"}
              onChange={e => {
                const val = e.target.value
                if (val === "__none__") { onPatch(prospect.id, { status: "nuevo", purchased: false }); return }
                onPatch(prospect.id, { status: val, purchased: val === "compraron" })
              }}
              className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground focus:border-foreground/20 focus:outline-none transition-all"
            >
              <option value="__none__">Sin calificar (no aparece en el pipeline)</option>
              {PIPELINE_COLUMNS.map(col => (
                <option key={col.id} value={col.id}>{col.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Próximo seguimiento</p>
              <input
                type="date"
                defaultValue={prospect.next_follow_up_at ?? ""}
                onChange={e => onPatch(prospect.id, { next_follow_up_at: e.target.value || null })}
                className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground focus:border-foreground/20 focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">&nbsp;</p>
              <button
                type="button"
                disabled={!prospect.next_follow_up_at}
                onClick={() => onPatch(prospect.id, { next_follow_up_at: null })}
                className="w-full h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] text-[13px] font-semibold text-foreground/60 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all disabled:opacity-40"
              >
                <CheckCircle2 className="h-4 w-4" />
                Marcar hecho
              </button>
            </div>
          </div>

          {fieldInput("Desde dónde llegó", prospect.source ?? "", v => onPatch(prospect.id, { source: v || null }), "ej: Instagram, referido, evento...")}
          {fieldInput("Nicho", prospect.niche ?? "", v => onPatch(prospect.id, { niche: v || null }), "ej: el rubro de este prospecto")}
          {fieldInput("Instagram", prospect.instagram ?? "", v => onPatch(prospect.id, { instagram: v || null }), "@usuario")}
          {fieldInput("Email", prospect.email ?? "", v => onPatch(prospect.id, { email: v || null }), "correo@ejemplo.com")}

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Notas</p>
            <textarea
              defaultValue={prospect.notes ?? ""}
              placeholder="Observaciones, contexto..."
              rows={4}
              onBlur={e => onPatch(prospect.id, { notes: e.target.value || null })}
              className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>
    </>
  )
}

function NewProspectModal({ onClose, onCreate, creating }: {
  onClose:  () => void
  onCreate: (data: Partial<Lead>) => Promise<void>
  creating: boolean
}) {
  const [name, setName] = useState("")
  const [instagram, setInstagram] = useState("")
  const [source, setSource] = useState("")
  const [rating, setRating] = useState(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onCreate({ name: name.trim(), instagram: instagram || null, source: source || null, rating: rating || null })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-[14px] border border-foreground/[0.10] shadow-2xl p-6 space-y-4"
          style={{ backgroundColor: "var(--card)" }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-foreground">Nuevo prospecto</h3>
            <button type="button" onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Nombre *</p>
            <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all" />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Instagram</p>
            <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)}
              placeholder="@usuario"
              className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all" />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Desde dónde llegó</p>
            <input type="text" value={source} onChange={e => setSource(e.target.value)}
              placeholder="ej: Instagram, referido, evento..."
              className="w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all" />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Calificación</p>
            <StarRating value={rating || null} onChange={n => setRating(n)} />
          </div>

          <button type="submit" disabled={!name.trim() || creating}
            className="w-full h-10 rounded-xl bg-foreground text-background text-[13px] font-bold hover:bg-foreground/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Crear prospecto
          </button>
        </form>
      </div>
    </>
  )
}

export function PipelineView() {
  const activeClientId = useActiveClient()
  const [prospects, setProspects] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchProspects = useCallback(async () => {
    if (!activeClientId) return
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/client/prospects?client_id=${activeClientId}`, { headers })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Error al cargar")
      setProspects(json.prospects ?? [])
      setError(null)
    } catch (err: any) {
      setError(err?.message ?? "Error al cargar")
    } finally {
      setLoading(false)
    }
  }, [activeClientId])

  useEffect(() => { fetchProspects() }, [fetchProspects])

  const handlePatch = useCallback(async (id: string, updates: Partial<Lead>) => {
    setProspects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    setSelected(prev => prev && prev.id === id ? { ...prev, ...updates } : prev)
    try {
      const headers = await authHeaders()
      await fetch("/api/client/prospects", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id, client_id: activeClientId, ...updates }),
      })
    } catch {
      // Reintentar en el próximo fetch — no bloqueamos la UI por un error de red puntual.
    }
  }, [activeClientId])

  const handleCreate = async (data: Partial<Lead>) => {
    setCreating(true)
    try {
      const headers = await authHeaders()
      const res = await fetch("/api/client/prospects", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...data, client_id: activeClientId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Error al crear")
      setProspects(prev => [json.prospect, ...prev])
      setShowNewForm(false)
    } catch (err: any) {
      setError(err?.message ?? "Error al crear")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const headers = await authHeaders()
      const res = await fetch("/api/client/prospects", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ id, client_id: activeClientId }),
      })
      if (!res.ok) { const json = await res.json(); throw new Error(json.error ?? "Error al borrar") }
      setProspects(prev => prev.filter(p => p.id !== id))
      setSelected(null)
    } catch (err: any) {
      setError(err?.message ?? "Error al borrar")
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-foreground/40 text-sm">Cargando pipeline...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pipeline</h1>
          <p className="text-[13px] text-foreground/40 mt-0.5">Tu cartera de prospectos, de punta a punta.</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="inline-flex items-center gap-1.5 h-9 rounded-xl bg-foreground px-3.5 text-[13px] font-bold text-background hover:bg-foreground/90 transition-all"
        >
          <Plus className="h-4 w-4" />
          Nuevo prospecto
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-[13px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <PipelineBoard leads={prospects} onSelect={setSelected} onPatch={handlePatch} />

      {selected && (
        <DetailModal
          prospect={selected}
          onClose={() => setSelected(null)}
          onPatch={handlePatch}
          onDelete={handleDelete}
          deleting={deletingId === selected.id}
        />
      )}

      {showNewForm && (
        <NewProspectModal
          onClose={() => setShowNewForm(false)}
          onCreate={handleCreate}
          creating={creating}
        />
      )}
    </div>
  )
}
