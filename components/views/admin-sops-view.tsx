"use client"

/**
 * SOPs — Standard Operating Procedures.
 *
 * Lista de playbooks operativos con steps numerados y templates copiables
 * para Skool/Slack/Email. Vive dentro de Centro Operativo (sección "SOPs").
 *
 * Crear / editar / borrar = admin only.
 * Lectura = admin / team / setter.
 *
 * Crear soporta 2 modos: Manual (form completo) y Con IA (descripción → Claude).
 */

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Plus, Search, Copy, Check, X, Trash2, Edit3, Sparkles,
  ChevronRight, Clock, FileText,
} from "lucide-react"
import { isAdmin as isAdminRole } from "@/lib/auth/permissions"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  order: number
  label: string
}

interface Template {
  channel: string
  label:   string
  body:    string
}

interface SOP {
  id:           string
  title:        string
  description:  string | null
  frequency:    string | null
  tags:         string[]
  steps:        Step[]
  templates:    Template[]
  ai_generated: boolean
  created_by:   string | null
  created_at:   string
  updated_at:   string
}

const CHANNEL_LABELS: Record<string, string> = {
  skool:    "Skool",
  slack:    "Slack",
  email:    "Email",
  whatsapp: "WhatsApp",
  other:    "Otro",
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const click = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={click}
      className={`inline-flex items-center gap-1.5 h-8 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 text-[12px] font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/20 transition-all ${className}`}
    >
      {copied
        ? <><Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /> Copiado</>
        : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
    </button>
  )
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  sop, isAdmin, onClose, onEdit, onDelete, deleting,
}: {
  sop:      SOP
  isAdmin:  boolean
  onClose:  () => void
  onEdit:   (sop: SOP) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[560px] flex-col border-l border-foreground/[0.08] shadow-2xl bg-card">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-foreground/[0.06] px-6 py-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {sop.ai_generated && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">
                  <Sparkles className="h-2.5 w-2.5" /> IA
                </span>
              )}
              {sop.frequency && (
                <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.05] px-2 py-0.5 text-[10px] font-semibold text-foreground/60">
                  <Clock className="h-2.5 w-2.5" /> {sop.frequency}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-foreground">{sop.title}</h2>
            {sop.description && (
              <p className="text-[13px] text-foreground/60 mt-1">{sop.description}</p>
            )}
            {sop.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {sop.tags.map(t => (
                  <span key={t} className="inline-flex items-center rounded-full border border-foreground/[0.08] bg-foreground/[0.03] px-2 py-0.5 text-[10px] font-medium text-foreground/60">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && (
              <>
                <button
                  onClick={() => onEdit(sop)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-all"
                  title="Editar"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(sop.id)}
                  disabled={deleting}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/30 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition-all disabled:opacity-40"
                  title="Borrar"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Steps */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40 mb-3">Steps</h3>
            {sop.steps.length === 0 ? (
              <p className="text-[13px] text-foreground/40 italic">Este SOP no tiene steps.</p>
            ) : (
              <ol className="space-y-2.5">
                {sop.steps.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-3 rounded-xl border border-foreground/[0.07] bg-foreground/[0.02] px-3 py-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffde21]/20 text-[12px] font-bold text-[#ffde21] border border-[#ffde21]/30">
                      {idx + 1}
                    </span>
                    <span className="text-[13.5px] text-foreground leading-relaxed">{s.label}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Templates */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40 mb-3">Templates</h3>
            {sop.templates.length === 0 ? (
              <p className="text-[13px] text-foreground/40 italic">Sin templates por ahora.</p>
            ) : (
              <div className="space-y-3">
                {sop.templates.map((t, idx) => (
                  <div key={idx} className="rounded-xl border border-foreground/[0.07] bg-foreground/[0.02] overflow-hidden">
                    <div className="flex items-center justify-between gap-2 border-b border-foreground/[0.06] px-3.5 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center rounded-md bg-blue-100 dark:bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:text-blue-300 capitalize shrink-0">
                          {CHANNEL_LABELS[t.channel] ?? t.channel}
                        </span>
                        <span className="text-[12px] font-semibold text-foreground/80 truncate">{t.label}</span>
                      </div>
                      <CopyButton text={t.body} />
                    </div>
                    <pre className="px-3.5 py-3 text-[13px] text-foreground/85 whitespace-pre-wrap font-mono leading-relaxed bg-foreground/[0.01] max-h-[400px] overflow-y-auto">{t.body}</pre>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-[11px] text-foreground/30 pt-2">
            Creado {fmtDate(sop.created_at)}{sop.created_at !== sop.updated_at ? ` · editado ${fmtDate(sop.updated_at)}` : ""}
          </p>
        </div>
      </div>
    </>
  )
}

// ─── Create / edit modal ──────────────────────────────────────────────────────

interface FormShape {
  title:       string
  description: string
  frequency:   string
  tags:        string  // comma-separated input
  steps:       string  // newline-separated
  templates:   Template[]
  ai_generated?: boolean
}

const EMPTY_FORM: FormShape = {
  title: "", description: "", frequency: "", tags: "", steps: "", templates: [],
}

function sopToForm(sop: SOP): FormShape {
  return {
    title:       sop.title,
    description: sop.description ?? "",
    frequency:   sop.frequency   ?? "",
    tags:        sop.tags.join(", "),
    steps:       sop.steps.map(s => s.label).join("\n"),
    templates:   sop.templates.map(t => ({ ...t })),
    ai_generated: sop.ai_generated,
  }
}

function CreateEditModal({
  initialSOP, onClose, onSaved,
}: {
  initialSOP: SOP | null
  onClose:    () => void
  onSaved:    (sop: SOP) => void
}) {
  const isEdit = Boolean(initialSOP)
  const [tab, setTab] = useState<"manual" | "ai">(isEdit ? "manual" : "ai")
  const [form, setForm] = useState<FormShape>(initialSOP ? sopToForm(initialSOP) : EMPTY_FORM)
  const [aiPrompt, setAiPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateField = (k: keyof FormShape) => (v: any) => setForm(f => ({ ...f, [k]: v }))

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("No autenticado"); return }

      const res = await fetch("/api/admin/sops/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ description: aiPrompt }),
      })
      const json = await res.json()
      if (!res.ok || !json.sop) {
        setError(json?.error ?? "Error generando con IA")
        return
      }
      const generated = json.sop
      setForm({
        title:        generated.title,
        description:  generated.description,
        frequency:    generated.frequency,
        tags:         (generated.tags ?? []).join(", "),
        steps:        (generated.steps ?? []).map((s: Step) => s.label).join("\n"),
        templates:    generated.templates ?? [],
        ai_generated: true,
      })
      setTab("manual")
    } catch (e: any) {
      setError(e?.message ?? "Error inesperado")
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!form.title.trim()) { setError("Falta el título"); return }
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("No autenticado"); return }

      const tagsArr  = form.tags.split(",").map(t => t.trim()).filter(Boolean)
      const stepsArr = form.steps.split("\n").map(l => l.trim()).filter(Boolean).map((label, idx) => ({ order: idx + 1, label }))

      const body = {
        ...(isEdit ? { id: initialSOP!.id } : {}),
        title:        form.title.trim(),
        description:  form.description.trim(),
        frequency:    form.frequency.trim(),
        tags:         tagsArr,
        steps:        stepsArr,
        templates:    form.templates,
        ai_generated: Boolean(form.ai_generated),
      }

      const res = await fetch("/api/admin/sops", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.sop) {
        setError(json?.error ?? "Error guardando")
        return
      }
      onSaved(json.sop)
    } catch (e: any) {
      setError(e?.message ?? "Error inesperado")
    } finally {
      setSaving(false)
    }
  }

  const addTemplate = () => {
    setForm(f => ({ ...f, templates: [...f.templates, { channel: "skool", label: "", body: "" }] }))
  }
  const updateTemplate = (idx: number, patch: Partial<Template>) => {
    setForm(f => ({ ...f, templates: f.templates.map((t, i) => i === idx ? { ...t, ...patch } : t) }))
  }
  const removeTemplate = (idx: number) => {
    setForm(f => ({ ...f, templates: f.templates.filter((_, i) => i !== idx) }))
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative flex h-full max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-foreground/[0.08] bg-card shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-foreground/[0.06] px-6 py-4 shrink-0">
            <h2 className="text-lg font-bold text-foreground">{isEdit ? "Editar SOP" : "Nuevo SOP"}</h2>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          {!isEdit && (
            <div className="flex border-b border-foreground/[0.06] px-6 shrink-0">
              <button
                onClick={() => setTab("ai")}
                className={`relative h-11 px-4 text-[13px] font-semibold transition-colors ${tab === "ai" ? "text-foreground" : "text-foreground/50 hover:text-foreground/80"}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Con IA
                </span>
                {tab === "ai" && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#ffde21]" />}
              </button>
              <button
                onClick={() => setTab("manual")}
                className={`relative h-11 px-4 text-[13px] font-semibold transition-colors ${tab === "manual" ? "text-foreground" : "text-foreground/50 hover:text-foreground/80"}`}
              >
                Manual
                {tab === "manual" && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#ffde21]" />}
              </button>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {tab === "ai" && !isEdit ? (
              <>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 mb-2">Descripción del proceso</label>
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="Ejemplo: Los jueves se hace una llamada que se graba en la nube. Después se sube el video a Skool en las dos comunidades, se avisa con un post en Skool y se manda mensaje al equipo en Slack con el link..."
                    className="w-full min-h-[180px] rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 py-3 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none resize-y"
                  />
                  <p className="mt-1.5 text-[11px] text-foreground/40">Lo describís en lenguaje natural y la IA te lo estructura. Después lo podés editar manualmente.</p>
                </div>
                <button
                  onClick={generateWithAI}
                  disabled={generating || !aiPrompt.trim()}
                  className="inline-flex items-center gap-2 h-10 rounded-xl bg-[#ffde21] px-4 text-[13px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {generating
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando…</>
                    : <><Sparkles className="h-4 w-4" /> Generar SOP</>}
                </button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 mb-1.5">Título</label>
                    <input
                      value={form.title}
                      onChange={e => updateField("title")(e.target.value)}
                      placeholder="Llamada del Jueves"
                      className="w-full h-10 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 mb-1.5">Descripción</label>
                    <textarea
                      value={form.description}
                      onChange={e => updateField("description")(e.target.value)}
                      rows={2}
                      placeholder="Workflow post-grabación del workshop semanal"
                      className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 mb-1.5">Frecuencia</label>
                    <input
                      value={form.frequency}
                      onChange={e => updateField("frequency")(e.target.value)}
                      placeholder="Semanal - Jueves"
                      className="w-full h-10 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 mb-1.5">Tags (separadas por coma)</label>
                    <input
                      value={form.tags}
                      onChange={e => updateField("tags")(e.target.value)}
                      placeholder="live, skool, workshop"
                      className="w-full h-10 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50 mb-1.5">Steps (uno por línea)</label>
                  <textarea
                    value={form.steps}
                    onChange={e => updateField("steps")(e.target.value)}
                    rows={6}
                    placeholder={"Empieza la llamada y se graba en la nube\nSubir grabación a Skool en ambas comunidades\nAvisar en Skool con el post\nAvisar en Slack con el link"}
                    className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none resize-y font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/50">Templates</label>
                    <button
                      onClick={addTemplate}
                      type="button"
                      className="inline-flex items-center gap-1 h-7 rounded-lg border border-foreground/[0.08] px-2.5 text-[11px] font-semibold text-foreground/60 hover:text-foreground hover:border-foreground/20 transition-all"
                    >
                      <Plus className="h-3 w-3" /> Agregar template
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {form.templates.length === 0 ? (
                      <p className="text-[12px] text-foreground/40 italic py-2">Sin templates. Agregá uno por canal (Skool, Slack, etc.).</p>
                    ) : form.templates.map((t, idx) => (
                      <div key={idx} className="rounded-xl border border-foreground/[0.07] bg-foreground/[0.02] p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={t.channel}
                            onChange={e => updateTemplate(idx, { channel: e.target.value })}
                            className="h-8 rounded-md border border-foreground/[0.08] bg-foreground/[0.03] px-2 text-[12px] font-semibold text-foreground focus:outline-none"
                          >
                            {Object.entries(CHANNEL_LABELS).map(([v, lbl]) => (
                              <option key={v} value={v}>{lbl}</option>
                            ))}
                          </select>
                          <input
                            value={t.label}
                            onChange={e => updateTemplate(idx, { label: e.target.value })}
                            placeholder="Aviso post-grabación"
                            className="flex-1 h-8 rounded-md border border-foreground/[0.08] bg-foreground/[0.03] px-2 text-[12.5px] text-foreground placeholder:text-foreground/30 focus:outline-none"
                          />
                          <button
                            onClick={() => removeTemplate(idx)}
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/30 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <textarea
                          value={t.body}
                          onChange={e => updateTemplate(idx, { body: e.target.value })}
                          rows={5}
                          placeholder="Contenido del mensaje. Para Skool, usá ➡️ al inicio de cada bullet."
                          className="w-full rounded-md border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-2 text-[12.5px] text-foreground placeholder:text-foreground/30 focus:outline-none resize-y font-mono"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="rounded-lg border border-red-300 bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 px-3 py-2 text-[12.5px] text-red-800 dark:text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-foreground/[0.06] px-6 py-3 shrink-0">
            <button
              onClick={onClose}
              type="button"
              className="h-9 rounded-lg border border-foreground/[0.08] px-4 text-[12.5px] font-semibold text-foreground/60 hover:text-foreground hover:border-foreground/20 transition-all"
            >
              Cancelar
            </button>
            {(isEdit || tab === "manual") && (
              <button
                onClick={save}
                disabled={saving || !form.title.trim()}
                className="inline-flex items-center gap-2 h-9 rounded-lg bg-[#ffde21] px-4 text-[12.5px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40"
              >
                {saving
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</>
                  : isEdit ? "Guardar cambios" : "Crear SOP"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AdminSOPsView({ userRole }: { userRole: string | null }) {
  const isAdmin = isAdminRole(userRole)

  const [sops,    setSops]    = useState<SOP[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [selected, setSelected] = useState<SOP | null>(null)
  const [editing,  setEditing]  = useState<SOP | null>(null)  // SOP being edited (or sentinel for "new")
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadSOPs = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const res = await fetch("/api/admin/sops", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      setSops(res.ok ? (json.sops ?? []) : [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSOPs() }, [loadSOPs])

  const allTags = Array.from(new Set(sops.flatMap(s => s.tags))).sort()

  const filtered = sops.filter(s => {
    if (activeTag && !s.tags.includes(activeTag)) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [s.title, s.description, s.frequency, ...s.tags]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q))
  })

  const onSaved = (saved: SOP) => {
    setSops(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
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
    if (!confirm("¿Borrar este SOP? La acción no se puede deshacer.")) return
    setDeletingId(id)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch("/api/admin/sops", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json?.error ?? "Error borrando")
        return
      }
      setSops(prev => prev.filter(s => s.id !== id))
      setSelected(null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-foreground tracking-tight">SOPs</h2>
          <span className="text-[12px] text-foreground/40">{sops.length} {sops.length === 1 ? "playbook" : "playbooks"}</span>
        </div>
        {isAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 h-9 rounded-xl bg-[#ffde21] px-4 text-[13px] font-bold text-black hover:bg-[#ffe84d] transition-all"
          >
            <Plus className="h-4 w-4" /> Nuevo SOP
          </button>
        )}
      </div>

      {/* Search + tag filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título, descripción, tag, frecuencia…"
            className="w-full h-10 rounded-xl border border-foreground/[0.08] bg-card pl-10 pr-3 text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTag(null)}
              className={`h-7 rounded-full border px-3 text-[11px] font-semibold transition-all ${activeTag == null ? "border-[#ffde21]/50 bg-[#ffde21]/15 text-[#ffde21]" : "border-foreground/[0.08] text-foreground/50 hover:text-foreground hover:border-foreground/20"}`}
            >
              Todas
            </button>
            {allTags.map(t => (
              <button
                key={t}
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                className={`h-7 rounded-full border px-3 text-[11px] font-medium transition-all ${activeTag === t ? "border-[#ffde21]/50 bg-[#ffde21]/15 text-[#ffde21]" : "border-foreground/[0.08] text-foreground/50 hover:text-foreground hover:border-foreground/20"}`}
              >
                {t}
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
        <div className="rounded-2xl border border-foreground/[0.08] bg-card py-16 text-center">
          <FileText className="mx-auto h-8 w-8 text-foreground/20 mb-2" />
          <p className="text-[14px] text-foreground/50">
            {sops.length === 0 ? "Todavía no hay SOPs." : "No hay SOPs que coincidan con el filtro."}
          </p>
          {sops.length === 0 && isAdmin && (
            <p className="text-[12px] text-foreground/30 mt-1">Tocá "Nuevo SOP" para crear el primero.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(sop => (
            <button
              key={sop.id}
              onClick={() => setSelected(sop)}
              className="group flex flex-col gap-2 rounded-2xl border border-foreground/[0.07] bg-card p-4 text-left hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {sop.ai_generated && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 dark:bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold text-violet-800 dark:text-violet-300">
                        <Sparkles className="h-2 w-2" /> IA
                      </span>
                    )}
                    {sop.frequency && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-foreground/[0.05] px-1.5 py-0.5 text-[9px] font-semibold text-foreground/60">
                        <Clock className="h-2 w-2" /> {sop.frequency}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[14.5px] font-bold text-foreground leading-snug group-hover:text-[#ffde21] transition-colors">{sop.title}</h3>
                  {sop.description && (
                    <p className="text-[12.5px] text-foreground/50 mt-1 line-clamp-2">{sop.description}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-foreground/30 group-hover:text-foreground/60 transition-colors shrink-0 mt-0.5" />
              </div>

              <div className="flex flex-wrap items-center gap-1 mt-1">
                {sop.tags.slice(0, 4).map(t => (
                  <span key={t} className="inline-flex items-center rounded-full border border-foreground/[0.08] bg-foreground/[0.02] px-1.5 py-0.5 text-[10px] font-medium text-foreground/55">
                    {t}
                  </span>
                ))}
                {sop.tags.length > 4 && (
                  <span className="text-[10px] text-foreground/40">+{sop.tags.length - 4}</span>
                )}
              </div>

              <div className="flex items-center gap-3 pt-1.5 border-t border-foreground/[0.05] mt-1">
                <span className="text-[10.5px] text-foreground/45">
                  {sop.steps.length} {sop.steps.length === 1 ? "paso" : "pasos"}
                </span>
                {sop.templates.length > 0 && (
                  <span className="text-[10.5px] text-foreground/45">
                    {sop.templates.length} template{sop.templates.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <DetailDrawer
          sop={selected}
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onEdit={(sop) => { setEditing(sop); setSelected(null) }}
          onDelete={onDelete}
          deleting={deletingId === selected.id}
        />
      )}

      {/* Create / edit modal */}
      {(creating || editing) && (
        <CreateEditModal
          initialSOP={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
