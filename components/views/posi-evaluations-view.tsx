"use client"

/**
 * Posi — formularios de evaluación por nivel (8 niveles, secuenciales).
 *
 * El cliente responde el nivel actual; si aprueba (>= passing_score) se
 * destraba el siguiente y se avisa al equipo por Slack (#posi-evaluaciones).
 * El contenido (preguntas) es placeholder — admin lo edita inline acá mismo
 * (base para que Ann cargue el contenido real después).
 */

import { useEffect, useState, useCallback } from "react"
import { Lock, Check, Loader2, Pencil } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { isAdmin as isAdminRole } from "@/lib/auth/permissions"

interface Question {
  id: string
  text: string
  type: "multiple_choice" | "open"
  options?: string[]
  correct_index?: number
}

interface Level {
  id: string
  level_number: number
  title: string
  description: string | null
  questions: Question[]
  passing_score: number
}

interface Submission {
  level_id: string
  score: number | null
  passed: boolean
}

const inputCls = "w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-foreground/25 focus:border-[#dafc69]/40 focus:outline-none"

export function PosiEvaluationsView() {
  const activeClientId = useActiveClient()
  const [levels, setLevels] = useState<Level[]>([])
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({})
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, Record<string, any>>>({}) // level_id -> {question_id: answer}
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, { score: number; passed: boolean }>>({})
  const [editingLevel, setEditingLevel] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ title: string; description: string; passing_score: string; questionsJson: string }>({ title: "", description: "", passing_score: "80", questionsJson: "[]" })
  const [editError, setEditError] = useState("")

  const isAdmin = isAdminRole(userRole)

  const getToken = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const load = useCallback(async () => {
    if (!activeClientId) { setLoading(false); return }
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
        setUserRole((profile as any)?.role ?? null)
      }

      const [levelsRes, subsRes] = await Promise.all([
        fetch("/api/posi/levels", { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/posi/submissions?client_id=${encodeURIComponent(activeClientId)}`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const levelsJson = await levelsRes.json()
      const subsJson = await subsRes.json()
      if (levelsRes.ok) setLevels(levelsJson.levels ?? [])
      if (subsRes.ok) {
        const map: Record<string, Submission> = {}
        for (const s of (subsJson.submissions ?? [])) map[s.level_id] = s
        setSubmissions(map)
      }
    } finally {
      setLoading(false)
    }
  }, [activeClientId, getToken])

  useEffect(() => { load() }, [load])

  const setAnswer = (levelId: string, questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [levelId]: { ...prev[levelId], [questionId]: value } }))
  }

  const submitLevel = async (level: Level) => {
    if (!activeClientId) return
    setSubmitting(level.id)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch("/api/posi/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ client_id: activeClientId, level_id: level.id, answers: answers[level.id] ?? {} }),
      })
      const json = await res.json()
      if (res.ok) {
        setResult(prev => ({ ...prev, [level.id]: { score: json.score, passed: json.passed } }))
        setSubmissions(prev => ({ ...prev, [level.id]: { level_id: level.id, score: json.score, passed: json.passed } }))
      }
    } finally {
      setSubmitting(null)
    }
  }

  const startEdit = (level: Level) => {
    setEditingLevel(level.id)
    setEditError("")
    setEditDraft({
      title: level.title,
      description: level.description ?? "",
      passing_score: String(level.passing_score),
      questionsJson: JSON.stringify(level.questions, null, 2),
    })
  }

  const saveEdit = async (level: Level) => {
    let parsedQuestions: any
    try { parsedQuestions = JSON.parse(editDraft.questionsJson) } catch {
      setEditError("El JSON de preguntas no es válido.")
      return
    }
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch("/api/admin/posi-levels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: level.id,
          title: editDraft.title,
          description: editDraft.description,
          passing_score: Number(editDraft.passing_score) || 80,
          questions: parsedQuestions,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setEditError(json?.error ?? "Error al guardar"); return }
      setEditingLevel(null)
      load()
    } catch (err: any) {
      setEditError(err?.message ?? "Error inesperado")
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#dafc69]/40" /></div>
  }

  if (!activeClientId) {
    return (
      <div className="rounded-[14px] border border-dashed border-foreground/[0.08] bg-foreground/[0.02] px-5 py-10 text-center text-sm text-foreground/40">
        No hay un cliente activo seleccionado.
      </div>
    )
  }

  // Un nivel está destrabado si es el primero, o si el anterior ya se aprobó.
  let previousPassed = true

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#dafc69]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">Posi — Evaluaciones por Nivel</h1>
        </div>
        <p className="text-xs text-foreground/30 ml-[18px]">Aprobá cada nivel para destrabar el siguiente.</p>
      </div>

      {levels.map((level) => {
        const sub = submissions[level.id]
        const localResult = result[level.id]
        const passed = sub?.passed || localResult?.passed
        const unlocked = previousPassed
        const isCurrent = unlocked && !passed
        previousPassed = passed || false

        return (
          <div key={level.id} className={`rounded-[14px] border p-5 ${passed ? "border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/[0.04]" : unlocked ? "border-foreground/[0.08] bg-card" : "border-foreground/[0.06] bg-foreground/[0.015] opacity-60"}`}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5">
                {passed ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : unlocked ? null : <Lock className="h-3.5 w-3.5 text-foreground/30" />}
                <h3 className="text-[14px] font-bold text-foreground">{level.title}</h3>
                {passed && <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Aprobado ({sub?.score ?? localResult?.score}%)</span>}
              </div>
              {isAdmin && (
                <button onClick={() => (editingLevel === level.id ? setEditingLevel(null) : startEdit(level))}
                  className="flex items-center gap-1.5 rounded-lg border border-foreground/[0.08] px-2.5 py-1 text-[11px] font-semibold text-foreground/50 hover:text-foreground hover:bg-foreground/[0.05] transition-colors">
                  <Pencil className="h-3 w-3" /> {editingLevel === level.id ? "Cerrar" : "Editar contenido"}
                </button>
              )}
            </div>
            {level.description && <p className="text-[12px] text-foreground/40 mb-3">{level.description}</p>}

            {/* Edición admin */}
            {isAdmin && editingLevel === level.id && (
              <div className="mt-3 space-y-3 rounded-xl border border-[#dafc69]/25 bg-[#dafc69]/[0.04] p-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">Título</label>
                  <input className={inputCls} value={editDraft.title} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">Descripción</label>
                  <textarea className={inputCls} rows={2} value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} />
                </div>
                <div className="max-w-[140px]">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">Passing score (%)</label>
                  <input className={inputCls} type="number" min="1" max="100" value={editDraft.passing_score} onChange={e => setEditDraft(d => ({ ...d, passing_score: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">
                    Preguntas (JSON) — type: "multiple_choice" (con options/correct_index) u "open"
                  </label>
                  <textarea className={`${inputCls} font-mono text-[12px]`} rows={10} value={editDraft.questionsJson} onChange={e => setEditDraft(d => ({ ...d, questionsJson: e.target.value }))} />
                </div>
                {editError && <p className="text-[12px] text-red-700 dark:text-red-400">{editError}</p>}
                <button onClick={() => saveEdit(level)} className="rounded-lg bg-[#dafc69] px-4 py-1.5 text-[12px] font-bold text-black hover:bg-[#f2ffc0] transition-colors">
                  Guardar contenido
                </button>
              </div>
            )}

            {/* Formulario del nivel actual */}
            {isCurrent && (
              <div className="space-y-4 mt-3">
                {level.questions.map((q) => (
                  <div key={q.id}>
                    <p className="text-[13px] font-medium text-foreground/80 mb-2">{q.text}</p>
                    {q.type === "multiple_choice" ? (
                      <div className="space-y-1.5">
                        {(q.options ?? []).map((opt, i) => (
                          <label key={i} className="flex items-center gap-2 text-[13px] text-foreground/70 cursor-pointer">
                            <input type="radio" name={`${level.id}-${q.id}`} checked={answers[level.id]?.[q.id] === i} onChange={() => setAnswer(level.id, q.id, i)} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea className={inputCls} rows={3} value={answers[level.id]?.[q.id] ?? ""} onChange={e => setAnswer(level.id, q.id, e.target.value)} placeholder="Tu respuesta…" />
                    )}
                  </div>
                ))}
                <button
                  onClick={() => submitLevel(level)}
                  disabled={submitting === level.id}
                  className="rounded-xl bg-[#dafc69] px-5 py-2 text-sm font-bold text-black hover:bg-[#f2ffc0] disabled:opacity-50 transition-colors"
                >
                  {submitting === level.id ? "Enviando…" : "Enviar"}
                </button>
                {localResult && !localResult.passed && (
                  <p className="text-[12px] text-red-700 dark:text-red-400">
                    Sacaste {localResult.score}% — necesitás {level.passing_score}% para aprobar. Podés reintentar.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
