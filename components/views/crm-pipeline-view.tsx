"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Loader2, Plus, X, Phone, Archive, Kanban } from "lucide-react"

interface Prospect {
  id: string
  name: string
  handle: string | null
  estimated_value: number | null
  stage: string
  call_tag: string | null
  source: string | null
  notes: string | null
  archived_at: string | null
  last_movement_at: string
  created_at: string
}

const STAGES: { key: string; label: string; desc: string }[] = [
  { key: "conversacion",         label: "Conversación",        desc: "DM abierto. Todavía no sabés si encaja." },
  { key: "calificado",           label: "Calificado",          desc: "Encaja con tu oferta. Falta la propuesta." },
  { key: "offerdoc_enviado",     label: "OfferDoc enviado",    desc: "La propuesta está en su bandeja." },
  { key: "offerdoc_respondido",  label: "OfferDoc respondido", desc: "Contestó. Acá se cierra o se pierde." },
  { key: "cerrado",              label: "Cerrado",              desc: "Este mes. Va derecho al reporte." },
]

// Sin regla numérica explícita en el spec — 5+ días sin moverse = atrasando
// (filete ámbar), 10+ = ya se pasó (filete rojo). Ajustable si Ann pide otra cosa.
function urgency(daysSince: number): "" | "att" | "risk" {
  if (daysSince >= 10) return "risk"
  if (daysSince >= 5) return "att"
  return ""
}

function fmtMoney(n: number | null) {
  if (n == null) return null
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function fmtDays(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return "hoy"
  if (days === 1) return "1 día"
  return `${days} días`
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export function CrmPipelineView({ clientId, readOnly }: { clientId: string | null; readOnly?: boolean }) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"todos" | "atrasados" | "cerrados">("todos")
  const [selected, setSelected] = useState<Prospect | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const getToken = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const qs = clientId ? `?client_id=${clientId}` : ""
      const res = await fetch(`/api/client/crm/prospects${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (res.ok) setProspects(json.prospects ?? [])
    } finally {
      setLoading(false)
    }
  }, [getToken, clientId])

  useEffect(() => { load() }, [load])

  const thisMonth = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [])

  const totals = useMemo(() => {
    const active = prospects.filter((p) => !p.archived_at)
    const value = active.reduce((s, p) => s + (p.estimated_value ?? 0), 0)
    const atrasados = active.filter((p) => urgency(daysSince(p.last_movement_at)) !== "").length
    const cerradosMes = active.filter((p) => p.stage === "cerrado" && p.last_movement_at.slice(0, 7) === thisMonth).length
    return { count: active.length, value, atrasados, cerradosMes }
  }, [prospects, thisMonth])

  const visible = useMemo(() => {
    const active = prospects.filter((p) => !p.archived_at)
    if (filter === "atrasados") return active.filter((p) => urgency(daysSince(p.last_movement_at)) !== "")
    if (filter === "cerrados") return active.filter((p) => p.stage === "cerrado" && p.last_movement_at.slice(0, 7) === thisMonth)
    return active
  }, [prospects, filter, thisMonth])

  const byStage = useMemo(() => {
    const map: Record<string, Prospect[]> = {}
    for (const s of STAGES) map[s.key] = []
    for (const p of visible) (map[p.stage] ??= []).push(p)
    return map
  }, [visible])

  const patch = async (id: string, body: Record<string, any>) => {
    if (readOnly) return
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch("/api/client/crm/prospects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, client_id: clientId, ...body }),
      })
      if (res.ok) {
        const json = await res.json()
        setProspects((prev) => prev.map((p) => (p.id === id ? json.prospect : p)))
        setSelected((s) => (s?.id === id ? json.prospect : s))
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-foreground/30" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/40">Pipeline · {new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</p>
          <div className="mt-1 flex items-baseline gap-4">
            <span className="text-[26px] font-extrabold tracking-tight text-foreground">{totals.count} prospecto{totals.count !== 1 ? "s" : ""}</span>
            {totals.value > 0 && <span className="text-[13px] text-foreground/45">{fmtMoney(totals.value)} en juego</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-foreground/[0.1] bg-card overflow-hidden">
            {([["todos", `Todos ${totals.count}`], ["atrasados", `Atrasados ${totals.atrasados}`], ["cerrados", `Cerrados este mes ${totals.cerradosMes}`]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-[12px] font-medium border-r last:border-r-0 border-foreground/[0.08] transition-colors ${
                  filter === key ? "bg-foreground text-background font-semibold" : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {!readOnly && (
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#dafc69] px-3 py-1.5 text-[12.5px] font-bold text-black hover:bg-[#f2ffc0] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar prospecto
            </button>
          )}
        </div>
      </div>

      {totals.count === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-foreground/[0.1] bg-foreground/[0.02] py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-foreground/[0.08] bg-card">
            <Kanban className="h-5 w-5 text-foreground/25" />
          </div>
          <p className="text-sm font-medium text-foreground/60">Todavía no cargaste ningún prospecto.</p>
          {!readOnly && (
            <button onClick={() => setShowNew(true)} className="mt-1 rounded-lg bg-[#dafc69] px-4 py-2 text-[13px] font-bold text-black hover:bg-[#f2ffc0] transition-colors">
              Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5 lg:gap-0 lg:rounded-2xl lg:border lg:border-foreground/[0.08]">
          {STAGES.map((stage, i) => {
            const items = byStage[stage.key] ?? []
            const value = items.reduce((s, p) => s + (p.estimated_value ?? 0), 0)
            return (
              <div key={stage.key} className={`flex min-h-[280px] flex-col rounded-2xl border border-foreground/[0.08] bg-card lg:rounded-none lg:border-0 lg:border-r lg:last:border-r-0 ${i > 0 ? "lg:border-l-0" : ""}`}>
                <div className="border-b border-foreground/[0.06] px-4 pb-3 pt-3.5">
                  <p className="text-[13px] font-semibold text-foreground">{stage.label}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[20px] font-extrabold tracking-tight text-foreground tabular-nums">{items.length}</span>
                    {value > 0 && <span className="text-[11px] text-foreground/40 tabular-nums">{fmtMoney(value)}</span>}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-foreground/40">{stage.desc}</p>
                </div>
                <div className="flex-1 space-y-2 p-2.5">
                  {items.length === 0 && <p className="px-1.5 py-2 text-[11px] leading-relaxed text-foreground/30">Sin prospectos acá.</p>}
                  {items.map((p) => {
                    const u = urgency(daysSince(p.last_movement_at))
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className={`w-full rounded-xl border border-foreground/[0.08] bg-background p-2.5 text-left transition-colors hover:border-foreground/20 ${
                          u === "att" ? "border-l-2 border-l-amber-500" : u === "risk" ? "border-l-2 border-l-red-500" : ""
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold text-foreground">{p.name}</span>
                          {p.estimated_value != null && <span className="shrink-0 text-[12.5px] font-bold text-foreground/70 tabular-nums">{fmtMoney(p.estimated_value)}</span>}
                        </div>
                        <p className="mt-0.5 text-[11px] text-foreground/40">
                          {p.handle ? `@${p.handle} · ` : ""}{fmtDays(p.last_movement_at)}
                        </p>
                        {p.call_tag && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-foreground/[0.1] px-1.5 py-0.5 text-[10.5px] text-foreground/55">
                            <Phone className="h-2.5 w-2.5" /> {p.call_tag === "llamada_agendada" ? "llamada agendada" : "llamada asistida"}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11.5px] leading-relaxed text-foreground/35">
        Las cinco etapas salen de los campos que ya te medimos todos los meses: llamadas agendadas · llamadas calificadas · OfferDocs enviados · OfferDocs respondidos · cierres por OfferDoc.
        La llamada no es una etapa obligatoria.
      </p>

      {selected && (
        <ProspectPanel
          prospect={selected}
          readOnly={readOnly}
          saving={saving}
          onClose={() => setSelected(null)}
          onStageChange={(stage) => patch(selected.id, { stage })}
          onArchive={() => { patch(selected.id, { archive: true }); setSelected(null) }}
          onSaveNotes={(notes) => patch(selected.id, { notes })}
        />
      )}

      {showNew && !readOnly && (
        <NewProspectModal
          onClose={() => setShowNew(false)}
          onCreate={async (fields) => {
            setSaving(true)
            try {
              const token = await getToken()
              if (!token) return
              const res = await fetch("/api/client/crm/prospects", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ client_id: clientId, ...fields }),
              })
              if (res.ok) { await load(); setShowNew(false) }
            } finally {
              setSaving(false)
            }
          }}
          saving={saving}
        />
      )}
    </div>
  )
}

function ProspectPanel({
  prospect, readOnly, saving, onClose, onStageChange, onArchive, onSaveNotes,
}: {
  prospect: Prospect
  readOnly?: boolean
  saving: boolean
  onClose: () => void
  onStageChange: (stage: string) => void
  onArchive: () => void
  onSaveNotes: (notes: string) => void
}) {
  const [notes, setNotes] = useState(prospect.notes ?? "")
  useEffect(() => { setNotes(prospect.notes ?? "") }, [prospect.id, prospect.notes])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-foreground/[0.1] bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold text-foreground">{prospect.name}</h3>
            {prospect.handle && <p className="text-[12px] text-foreground/40">@{prospect.handle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground/40 hover:bg-foreground/[0.05] hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/40">Etapa</p>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <button
                key={s.key}
                disabled={readOnly}
                onClick={() => onStageChange(s.key)}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  s.key === prospect.stage ? "border-[#dafc69]/60 bg-[#dafc69]/15 text-foreground font-semibold" : "border-foreground/[0.1] text-foreground/55 hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/40">Notas</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (prospect.notes ?? "") && onSaveNotes(notes)}
            disabled={readOnly}
            rows={3}
            className="w-full rounded-lg border border-foreground/[0.1] bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-foreground/25 focus:border-[#dafc69]/40 focus:outline-none disabled:opacity-60"
            placeholder="Contexto de la conversación..."
          />
        </div>

        {!readOnly && (
          <button
            onClick={onArchive}
            disabled={saving}
            className="mt-4 flex items-center gap-1.5 text-[12px] font-medium text-foreground/45 hover:text-red-700 dark:hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" /> Marcar como perdido (se archiva, no se borra)
          </button>
        )}
      </div>
    </div>
  )
}

function NewProspectModal({ onClose, onCreate, saving }: { onClose: () => void; onCreate: (f: any) => void; saving: boolean }) {
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [value, setValue] = useState("")
  const [source, setSource] = useState("")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-foreground/[0.1] bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-foreground">Nuevo prospecto</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground/40 hover:bg-foreground/[0.05] hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre *" className="w-full rounded-lg border border-foreground/[0.1] bg-background px-3 py-2 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-[#dafc69]/40 focus:outline-none" />
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle de Instagram (sin @)" className="w-full rounded-lg border border-foreground/[0.1] bg-background px-3 py-2 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-[#dafc69]/40 focus:outline-none" />
          <input value={value} onChange={(e) => setValue(e.target.value)} type="number" placeholder="Valor estimado (US$)" className="w-full rounded-lg border border-foreground/[0.1] bg-background px-3 py-2 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-[#dafc69]/40 focus:outline-none" />
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Origen (ej: contenido, referido)" className="w-full rounded-lg border border-foreground/[0.1] bg-background px-3 py-2 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-[#dafc69]/40 focus:outline-none" />
        </div>
        <button
          disabled={!name.trim() || saving}
          onClick={() => onCreate({ name, handle: handle || undefined, estimated_value: value ? Number(value) : undefined, source: source || undefined })}
          className="mt-4 w-full rounded-lg bg-[#dafc69] px-4 py-2.5 text-[13px] font-bold text-black hover:bg-[#f2ffc0] disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando…" : "Agregar a Conversación"}
        </button>
      </div>
    </div>
  )
}
