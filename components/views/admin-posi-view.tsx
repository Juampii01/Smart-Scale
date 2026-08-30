"use client"

/**
 * Founder → POSI: links directos por nivel (para pegar en Slack cuando el
 * cliente llega a ese nivel), editor de contenido, y tabla de respuestas
 * recibidas. El formulario en sí vive fuera de acá — en /posi/[level],
 * standalone, sin nav (ver components/views/posi-form-view.tsx).
 */

import { useEffect, useState, useCallback } from "react"
import { Loader2, Copy, Check, Pencil, ChevronDown, ChevronUp, ClipboardList, Plus, Trash2, GripVertical, X } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { SectionHeader } from "@/components/ui/section-header"

interface Question {
  id: string
  label: string
  type: "text" | "yesno" | "multiple_choice"
  options?: string[]
  /** Índice (dentro de options) de la respuesta correcta. Solo aplica a multiple_choice; sin esto no se marca como corregible. */
  correct_index?: number
}

interface Level {
  id: string
  level_number: number
  title: string
  intro: string | null
  questions: Question[]
}

interface Submission {
  id: string
  client_id: string
  client_name: string
  level_id: string
  answers: Record<string, any>
  submitted_at: string
  passed?: boolean | null
  wrong_question_ids?: string[]
}

const inputCls = "w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:border-accent focus:outline-none"

const QUESTION_TYPE_OPTIONS: { value: Question["type"]; label: string }[] = [
  { value: "text", label: "Texto libre" },
  { value: "yesno", label: "Sí o no" },
  { value: "multiple_choice", label: "Opción múltiple" },
]

function genQuestionId(existing: Question[]): string {
  const nums = existing.map((q) => parseInt(q.id.replace(/^q/i, ""), 10)).filter((n) => !isNaN(n))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `q${next}`
}

function formatAnswer(q: Question, raw: any): string {
  if (raw === undefined || raw === null || raw === "") return "(sin responder)"
  if (q.type === "multiple_choice" && typeof raw === "number") return q.options?.[raw] ?? String(raw)
  if (q.type === "yesno") return raw ? "Sí" : "No"
  return String(raw)
}

/** null = pregunta sin respuesta correcta definida (no se corrige). */
function isCorrectAnswer(q: Question, raw: any): boolean | null {
  if (q.type !== "multiple_choice" || typeof q.correct_index !== "number") return null
  return raw === q.correct_index
}

function computeScore(level: Level | undefined, answers: Record<string, any>): { correct: number; total: number } | null {
  if (!level) return null
  const scored = level.questions.filter((q) => q.type === "multiple_choice" && typeof q.correct_index === "number")
  if (scored.length === 0) return null
  const correct = scored.filter((q) => answers[q.id] === q.correct_index).length
  return { correct, total: scored.length }
}

export function AdminPosiView() {
  const [levels, setLevels] = useState<Level[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedLevel, setCopiedLevel] = useState<number | null>(null)
  const [editingLevel, setEditingLevel] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ title: string; intro: string; questions: Question[] }>({ title: "", intro: "", questions: [] })
  const [editError, setEditError] = useState("")
  const [savingLevel, setSavingLevel] = useState(false)
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null)
  const [siteOrigin, setSiteOrigin] = useState("")

  const [pageSettings, setPageSettings] = useState({ title: "POSI", subtitle: "" })
  const [editingHeader, setEditingHeader] = useState(false)
  const [headerDraft, setHeaderDraft] = useState({ title: "", subtitle: "" })
  const [headerSaving, setHeaderSaving] = useState(false)

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
      const [levelsRes, subsRes, settingsRes] = await Promise.all([
        fetch("/api/posi/levels", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/posi/submissions", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/posi-page-settings", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const levelsJson = await levelsRes.json()
      const subsJson = await subsRes.json()
      const settingsJson = await settingsRes.json()
      if (levelsRes.ok) setLevels(levelsJson.levels ?? [])
      if (subsRes.ok) setSubmissions(subsJson.submissions ?? [])
      if (settingsRes.ok && settingsJson.settings) setPageSettings(settingsJson.settings)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSiteOrigin(window.location.origin) }, [])

  const startEditHeader = () => {
    setHeaderDraft({ title: pageSettings.title, subtitle: pageSettings.subtitle })
    setEditingHeader(true)
  }

  const saveHeader = async () => {
    setHeaderSaving(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch("/api/admin/posi-page-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(headerDraft),
      })
      const json = await res.json()
      if (res.ok && json.settings) {
        setPageSettings(json.settings)
        setEditingHeader(false)
      }
    } finally {
      setHeaderSaving(false)
    }
  }

  const copyLink = (levelNumber: number) => {
    navigator.clipboard.writeText(`${siteOrigin}/posi/${levelNumber}`)
    setCopiedLevel(levelNumber)
    setTimeout(() => setCopiedLevel(null), 1500)
  }

  const startEdit = (level: Level) => {
    setEditingLevel(level.id)
    setEditError("")
    setEditDraft({ title: level.title, intro: level.intro ?? "", questions: level.questions.map((q) => ({ ...q, options: q.options ? [...q.options] : undefined })) })
  }

  const saveEdit = async (level: Level) => {
    const emptyLabel = editDraft.questions.find((q) => !q.label.trim())
    if (emptyLabel) { setEditError("Todas las preguntas necesitan un texto."); return }
    const badOptions = editDraft.questions.find((q) => q.type === "multiple_choice" && (q.options ?? []).filter((o) => o.trim()).length < 2)
    if (badOptions) { setEditError('Las preguntas de "opción múltiple" necesitan al menos 2 opciones.'); return }

    setEditError("")
    setSavingLevel(true)
    try {
      const token = await getToken()
      if (!token) return
      // Al filtrar opciones vacías, correct_index puede quedar apuntando a
      // otra opción — se recalcula contra los índices que sobreviven.
      const cleanQuestions = editDraft.questions.map((q) => {
        if (q.type !== "multiple_choice") {
          return { ...q, label: q.label.trim(), options: undefined, correct_index: undefined }
        }
        const trimmed = (q.options ?? []).map((o) => o.trim())
        const keptIndices: number[] = []
        const options = trimmed.filter((o, i) => {
          if (!o) return false
          keptIndices.push(i)
          return true
        })
        const remapped = q.correct_index !== undefined ? keptIndices.indexOf(q.correct_index) : -1
        return {
          ...q,
          label: q.label.trim(),
          options,
          correct_index: remapped >= 0 ? remapped : undefined,
        }
      })
      const res = await fetch("/api/admin/posi-levels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: level.id, title: editDraft.title, intro: editDraft.intro, questions: cleanQuestions }),
      })
      const json = await res.json()
      if (!res.ok) { setEditError(json?.error ?? "Error al guardar"); return }
      setEditingLevel(null)
      load()
    } finally {
      setSavingLevel(false)
    }
  }

  const addQuestion = () => {
    setEditDraft((d) => ({ ...d, questions: [...d.questions, { id: genQuestionId(d.questions), label: "", type: "text" }] }))
  }
  const removeQuestion = (idx: number) => {
    setEditDraft((d) => ({ ...d, questions: d.questions.filter((_, i) => i !== idx) }))
  }
  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setEditDraft((d) => {
      const target = idx + dir
      if (target < 0 || target >= d.questions.length) return d
      const next = [...d.questions]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return { ...d, questions: next }
    })
  }
  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setEditDraft((d) => ({ ...d, questions: d.questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)) }))
  }
  const setQuestionType = (idx: number, type: Question["type"]) => {
    updateQuestion(idx, { type, options: type === "multiple_choice" ? ["", ""] : undefined, correct_index: undefined })
  }
  const addOption = (qIdx: number) => {
    setEditDraft((d) => ({ ...d, questions: d.questions.map((q, i) => (i === qIdx ? { ...q, options: [...(q.options ?? []), ""] } : q)) }))
  }
  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setEditDraft((d) => ({ ...d, questions: d.questions.map((q, i) => (i === qIdx ? { ...q, options: (q.options ?? []).map((o, j) => (j === oIdx ? value : o)) } : q)) }))
  }
  const removeOption = (qIdx: number, oIdx: number) => {
    setEditDraft((d) => ({
      ...d,
      questions: d.questions.map((q, i) => {
        if (i !== qIdx) return q
        const options = (q.options ?? []).filter((_, j) => j !== oIdx)
        let correct_index = q.correct_index
        if (correct_index === oIdx) correct_index = undefined
        else if (correct_index !== undefined && correct_index > oIdx) correct_index = correct_index - 1
        return { ...q, options, correct_index }
      }),
    }))
  }
  const setCorrectOption = (qIdx: number, oIdx: number) => {
    setEditDraft((d) => ({
      ...d,
      questions: d.questions.map((q, i) => (i === qIdx ? { ...q, correct_index: q.correct_index === oIdx ? undefined : oIdx } : q)),
    }))
  }

  const submissionsByLevel = submissions.reduce<Record<string, Submission[]>>((acc, s) => {
    (acc[s.level_id] ??= []).push(s)
    return acc
  }, {})

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#dafc69]/40" /></div>
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        {editingHeader ? (
          <div className="space-y-2.5 rounded-xl border border-accent/20 bg-accent-soft p-4 max-w-xl">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">Título</label>
              <input className={inputCls} value={headerDraft.title} onChange={(e) => setHeaderDraft((d) => ({ ...d, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">Subtítulo</label>
              <textarea className={inputCls} rows={2} value={headerDraft.subtitle} onChange={(e) => setHeaderDraft((d) => ({ ...d, subtitle: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={saveHeader} disabled={headerSaving} className="rounded-lg bg-[#dafc69] px-4 py-1.5 text-[12px] font-bold text-black hover:bg-[#f2ffc0] disabled:opacity-50 transition-colors">
                {headerSaving ? "Guardando…" : "Guardar"}
              </button>
              <button onClick={() => setEditingHeader(false)} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-foreground/50 hover:text-foreground transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-bold text-foreground leading-tight">{pageSettings.title}</h1>
              <p className="text-[13px] text-foreground/50 mt-0.5 max-w-xl">{pageSettings.subtitle}</p>
            </div>
            <button
              onClick={startEditHeader}
              className="flex items-center gap-1.5 rounded-lg border border-foreground/[0.08] px-2.5 py-1 text-[11px] font-semibold text-foreground/50 hover:text-foreground hover:bg-foreground/[0.05] transition-colors shrink-0"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {levels.map((level) => (
          <div key={level.id} className="rounded-2xl border border-foreground/[0.08] bg-card p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="h-4 w-4 text-foreground/30" />
                <h3 className="text-[14px] font-bold text-foreground">{level.title}</h3>
                <span className="text-[11px] text-foreground/35">
                  {(submissionsByLevel[level.id] ?? []).length} respuesta{(submissionsByLevel[level.id] ?? []).length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyLink(level.level_number)}
                  className="flex items-center gap-1.5 rounded-lg border border-foreground/[0.08] px-2.5 py-1 text-[11px] font-semibold text-foreground/60 hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                >
                  {copiedLevel === level.level_number ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedLevel === level.level_number ? "Copiado" : "Copiar link"}
                </button>
                <button
                  onClick={() => (editingLevel === level.id ? setEditingLevel(null) : startEdit(level))}
                  className="flex items-center gap-1.5 rounded-lg border border-foreground/[0.08] px-2.5 py-1 text-[11px] font-semibold text-foreground/50 hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                >
                  <Pencil className="h-3 w-3" /> {editingLevel === level.id ? "Cerrar" : "Editar"}
                </button>
              </div>
            </div>
            <p className="text-[12px] text-foreground/35 mt-1.5 font-mono">{siteOrigin}/posi/{level.level_number}</p>

            {editingLevel === level.id && (
              <div className="mt-4 rounded-2xl border border-border bg-secondary/20 p-5 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/45 mb-1.5">Título del nivel</label>
                    <input
                      className="w-full rounded-lg border border-foreground/[0.1] bg-card px-3.5 py-2.5 text-[14px] font-semibold text-foreground placeholder:text-foreground/25 focus:border-accent focus:outline-none"
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/45 mb-1.5">Intro (arriba de las preguntas)</label>
                    <textarea
                      className="w-full rounded-lg border border-foreground/[0.1] bg-card px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-foreground/25 focus:border-accent focus:outline-none resize-y leading-relaxed"
                      rows={2}
                      value={editDraft.intro}
                      onChange={(e) => setEditDraft((d) => ({ ...d, intro: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-foreground/45">
                      Preguntas <span className="font-normal normal-case text-foreground/35">({editDraft.questions.length})</span>
                    </label>
                  </div>

                  <div className="space-y-2.5">
                    {editDraft.questions.map((q, idx) => (
                      <div key={q.id} className="rounded-xl border border-foreground/[0.08] bg-card p-3.5">
                        <div className="flex items-start gap-2.5">
                          <div className="flex flex-col items-center gap-0.5 pt-1.5 shrink-0">
                            <GripVertical className="h-3.5 w-3.5 text-foreground/20" />
                            <span className="text-[10px] font-bold text-foreground/30 tabular-nums">{idx + 1}</span>
                          </div>

                          <div className="flex-1 min-w-0 space-y-2.5">
                            <input
                              className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-[13.5px] font-medium text-foreground placeholder:text-foreground/25 focus:border-accent focus:outline-none"
                              placeholder="Texto de la pregunta…"
                              value={q.label}
                              onChange={(e) => updateQuestion(idx, { label: e.target.value })}
                            />

                            <div className="flex flex-wrap items-center gap-1.5">
                              {QUESTION_TYPE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setQuestionType(idx, opt.value)}
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                    q.type === opt.value
                                      ? "border-accent bg-secondary text-foreground"
                                      : "border-foreground/[0.1] text-foreground/50 hover:text-foreground hover:border-foreground/20"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>

                            {q.type === "multiple_choice" && (
                              <div className="space-y-1.5 pl-1">
                                {(q.options ?? []).map((opt, oIdx) => (
                                  <div key={oIdx} className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-foreground/25 w-4 shrink-0 tabular-nums">{oIdx + 1}.</span>
                                    <button
                                      type="button"
                                      onClick={() => setCorrectOption(idx, oIdx)}
                                      title="Marcar como respuesta correcta"
                                      aria-label="Marcar como respuesta correcta"
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                        q.correct_index === oIdx
                                          ? "border-emerald-500 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                                          : "border-foreground/[0.15] text-transparent hover:border-emerald-500/60 hover:text-emerald-600/60 dark:hover:text-emerald-400/50"
                                      }`}
                                    >
                                      <Check className="h-3 w-3" />
                                    </button>
                                    <input
                                      className="flex-1 rounded-md border border-foreground/[0.08] bg-foreground/[0.02] px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-foreground/25 focus:border-accent focus:outline-none"
                                      placeholder={`Opción ${oIdx + 1}`}
                                      value={opt}
                                      onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeOption(idx, oIdx)}
                                      disabled={(q.options ?? []).length <= 1}
                                      className="flex h-6 w-6 items-center justify-center rounded-md text-foreground/30 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 disabled:opacity-30 disabled:pointer-events-none transition-colors shrink-0"
                                      aria-label="Sacar opción"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => addOption(idx)}
                                  className="inline-flex items-center gap-1 pl-5 text-[11.5px] font-semibold text-foreground/45 hover:text-foreground transition-colors"
                                >
                                  <Plus className="h-3 w-3" /> Agregar opción
                                </button>
                                <p className="pl-5 text-[10.5px] text-foreground/30">
                                  Tocá el círculo para marcar la respuesta correcta (opcional — sin marcar, esta pregunta no cuenta para aprobar el nivel).
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveQuestion(idx, -1)}
                              disabled={idx === 0}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06] disabled:opacity-20 disabled:pointer-events-none transition-colors"
                              aria-label="Subir pregunta"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveQuestion(idx, 1)}
                              disabled={idx === editDraft.questions.length - 1}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06] disabled:opacity-20 disabled:pointer-events-none transition-colors"
                              aria-label="Bajar pregunta"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeQuestion(idx)}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-foreground/30 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors mt-1"
                              aria-label="Borrar pregunta"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addQuestion}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-foreground/[0.15] py-2.5 text-[12.5px] font-semibold text-foreground/50 hover:text-foreground hover:border-foreground/30 hover:bg-foreground/[0.02] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar pregunta
                  </button>
                </div>

                {editError && <p className="text-[12.5px] text-red-700 dark:text-red-400">{editError}</p>}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveEdit(level)}
                    disabled={savingLevel}
                    className="flex items-center gap-2 rounded-lg bg-[#dafc69] px-4 py-2 text-[12.5px] font-bold text-black hover:bg-[#f2ffc0] disabled:opacity-50 transition-colors"
                  >
                    {savingLevel && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {savingLevel ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    onClick={() => setEditingLevel(null)}
                    className="rounded-lg px-3 py-2 text-[12.5px] font-semibold text-foreground/50 hover:text-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div>
        <SectionHeader icon={ClipboardList} title="Respuestas recibidas" subtitle={`${submissions.length} en total`} className="mb-4" />
        {submissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foreground/[0.08] bg-foreground/[0.02] px-6 py-10 text-center text-sm text-foreground/35">
            Todavía no llegó ninguna respuesta.
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map((s) => {
              const level = levels.find((l) => l.id === s.level_id)
              const isExpanded = expandedSubmission === s.id
              const score = computeScore(level, s.answers)
              return (
                <div key={s.id} className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedSubmission(isExpanded ? null : s.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-foreground/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-semibold text-foreground/85">{s.client_name}</span>
                      <span className="text-[12px] text-foreground/45">{level?.title ?? "—"}</span>
                      {s.passed === true && (
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400">Aprobado</span>
                      )}
                      {s.passed === false && (
                        <span className="rounded-full bg-red-100 dark:bg-red-500/10 px-2 py-0.5 text-[10.5px] font-bold text-red-700 dark:text-red-400">No aprobado</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {score && (
                        <span className={`text-[11px] font-semibold ${score.correct === score.total ? "text-emerald-700 dark:text-emerald-400" : "text-foreground/45"}`}>
                          {score.correct}/{score.total} correctas
                        </span>
                      )}
                      <span className="text-[11px] text-foreground/35">{new Date(s.submitted_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-foreground/30" /> : <ChevronDown className="h-3.5 w-3.5 text-foreground/30" />}
                    </div>
                  </button>
                  {isExpanded && level && (
                    <div className="px-4 pb-4 space-y-3 border-t border-foreground/[0.06] pt-3">
                      {level.questions.map((q) => {
                        const isWrong = (s.wrong_question_ids ?? []).includes(q.id)
                        return (
                          <div key={q.id}>
                            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground/60">
                              {q.label}
                              {isWrong && <span className="text-red-700 dark:text-red-400">✕ incorrecta</span>}
                            </p>
                            <p className={`text-[13px] mt-0.5 ${isWrong ? "text-red-700 dark:text-red-400" : "text-foreground/85"}`}>
                              {formatAnswer(q, s.answers[q.id])}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
