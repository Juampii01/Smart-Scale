"use client"

/**
 * Founder → POSI: links directos por nivel (para pegar en Slack cuando el
 * cliente llega a ese nivel), editor de contenido, y tabla de respuestas
 * recibidas. El formulario en sí vive fuera de acá — en /posi/[level],
 * standalone, sin nav (ver components/views/posi-form-view.tsx).
 */

import { useEffect, useState, useCallback } from "react"
import { Loader2, Copy, Check, X, Pencil, ChevronDown, ChevronUp, ClipboardList, Plus, Trash2 } from "lucide-react"
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
}

const inputCls = "w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:border-[#dafc69]/40 focus:outline-none"

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
    setEditDraft({ title: level.title, intro: level.intro ?? "", questions: level.questions.map((q) => ({ ...q })) })
  }

  const saveEdit = async (level: Level) => {
    const invalid = editDraft.questions.find(
      (q) => !q.label.trim() || (q.type === "multiple_choice" && (q.options ?? []).filter((o) => o.trim()).length < 2)
    )
    if (invalid) {
      setEditError("Cada pregunta necesita un enunciado, y las de opción múltiple necesitan al menos 2 opciones con texto.")
      return
    }
    setEditError("")
    const token = await getToken()
    if (!token) return
    const res = await fetch("/api/admin/posi-levels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: level.id, title: editDraft.title, intro: editDraft.intro, questions: editDraft.questions }),
    })
    const json = await res.json()
    if (!res.ok) { setEditError(json?.error ?? "Error al guardar"); return }
    setEditingLevel(null)
    load()
  }

  const addQuestion = () => {
    setEditDraft((d) => ({ ...d, questions: [...d.questions, { id: `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, label: "", type: "text" }] }))
  }

  const removeQuestion = (id: string) => {
    setEditDraft((d) => ({ ...d, questions: d.questions.filter((q) => q.id !== id) }))
  }

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setEditDraft((d) => ({ ...d, questions: d.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }))
  }

  const setQuestionType = (id: string, type: Question["type"]) => {
    updateQuestion(id, type === "multiple_choice" ? { type, options: ["", ""], correct_index: 0 } : { type, options: undefined, correct_index: undefined })
  }

  const setCorrectIndex = (id: string, index: number) => {
    updateQuestion(id, { correct_index: index })
  }

  const addOption = (id: string) => {
    setEditDraft((d) => ({
      ...d,
      questions: d.questions.map((q) => (q.id === id ? { ...q, options: [...(q.options ?? []), ""] } : q)),
    }))
  }

  const updateOption = (id: string, index: number, value: string) => {
    setEditDraft((d) => ({
      ...d,
      questions: d.questions.map((q) => (q.id === id ? { ...q, options: (q.options ?? []).map((o, i) => (i === index ? value : o)) } : q)),
    }))
  }

  const removeOption = (id: string, index: number) => {
    setEditDraft((d) => ({
      ...d,
      questions: d.questions.map((q) => {
        if (q.id !== id) return q
        const options = (q.options ?? []).filter((_, i) => i !== index)
        let correct_index = q.correct_index
        if (correct_index !== undefined) {
          if (correct_index === index) correct_index = 0
          else if (correct_index > index) correct_index -= 1
        }
        return { ...q, options, correct_index }
      }),
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
          <div className="space-y-2.5 rounded-xl border border-[#dafc69]/25 bg-[#dafc69]/[0.04] p-4 max-w-xl">
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
              <div className="mt-4 space-y-3 rounded-xl border border-[#dafc69]/25 bg-[#dafc69]/[0.04] p-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">Título</label>
                  <input className={inputCls} value={editDraft.title} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">Intro</label>
                  <textarea className={inputCls} rows={3} value={editDraft.intro} onChange={(e) => setEditDraft((d) => ({ ...d, intro: e.target.value }))} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40">Preguntas</label>
                    <button type="button" onClick={addQuestion} className="flex items-center gap-1 text-[11px] font-semibold text-foreground/50 hover:text-foreground transition-colors">
                      <Plus className="h-3 w-3" /> Agregar pregunta
                    </button>
                  </div>
                  <div className="space-y-3">
                    {editDraft.questions.map((q, qIdx) => (
                      <div key={q.id} className="rounded-lg border border-foreground/[0.08] bg-background/40 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-[11px] font-bold text-foreground/30 mt-2.5 shrink-0">{qIdx + 1}.</span>
                          <input
                            className={inputCls}
                            placeholder="Enunciado de la pregunta"
                            value={q.label}
                            onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                          />
                          <select
                            className="rounded-lg border border-foreground/[0.08] bg-foreground/[0.04] px-2 py-2 text-[12px] text-foreground focus:border-[#dafc69]/40 focus:outline-none shrink-0"
                            value={q.type}
                            onChange={(e) => setQuestionType(q.id, e.target.value as Question["type"])}
                          >
                            <option value="text">Texto libre</option>
                            <option value="yesno">Sí / No</option>
                            <option value="multiple_choice">Opción múltiple</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeQuestion(q.id)}
                            className="p-2 text-foreground/30 hover:text-red-700 dark:hover:text-red-400 transition-colors shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {q.type === "multiple_choice" && (
                          <div className="pl-6 space-y-1.5">
                            <p className="text-[10px] text-foreground/35">Marcá cuál opción es la respuesta correcta:</p>
                            {(q.options ?? []).map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct-${q.id}`}
                                  checked={q.correct_index === oIdx}
                                  onChange={() => setCorrectIndex(q.id, oIdx)}
                                  className="h-3.5 w-3.5 accent-[#dafc69] shrink-0"
                                />
                                <input
                                  className={`${inputCls} py-1.5`}
                                  placeholder={`Opción ${oIdx + 1}`}
                                  value={opt}
                                  onChange={(e) => updateOption(q.id, oIdx, e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(q.id, oIdx)}
                                  disabled={(q.options?.length ?? 0) <= 2}
                                  className="p-1.5 text-foreground/30 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors shrink-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addOption(q.id)} className="flex items-center gap-1 text-[11px] font-semibold text-foreground/45 hover:text-foreground transition-colors">
                              <Plus className="h-3 w-3" /> Agregar opción
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {editDraft.questions.length === 0 && (
                      <p className="text-[12px] text-foreground/35 italic">Todavía no hay preguntas.</p>
                    )}
                  </div>
                </div>
                {editError && <p className="text-[12px] text-red-700 dark:text-red-400">{editError}</p>}
                <button onClick={() => saveEdit(level)} className="rounded-lg bg-[#dafc69] px-4 py-1.5 text-[12px] font-bold text-black hover:bg-[#f2ffc0] transition-colors">
                  Guardar
                </button>
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
                        const correct = isCorrectAnswer(q, s.answers[q.id])
                        return (
                          <div key={q.id}>
                            <div className="flex items-center gap-1.5">
                              <p className="text-[12px] font-semibold text-foreground/60">{q.label}</p>
                              {correct === true && <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
                              {correct === false && <X className="h-3 w-3 text-red-700 dark:text-red-400" />}
                            </div>
                            <p className="text-[13px] text-foreground/85 mt-0.5">{formatAnswer(q, s.answers[q.id])}</p>
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
