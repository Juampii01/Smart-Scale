"use client"

/**
 * Founder → POSI: links directos por nivel (para pegar en Slack cuando el
 * cliente llega a ese nivel), editor de contenido, y tabla de respuestas
 * recibidas. El formulario en sí vive fuera de acá — en /posi/[level],
 * standalone, sin nav (ver components/views/posi-form-view.tsx).
 */

import { useEffect, useState, useCallback } from "react"
import { Loader2, Copy, Check, Pencil, ChevronDown, ChevronUp, ClipboardList } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { SectionHeader } from "@/components/ui/section-header"

interface Question {
  id: string
  label: string
  type: "text" | "yesno" | "multiple_choice"
  options?: string[]
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

export function AdminPosiView() {
  const [levels, setLevels] = useState<Level[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedLevel, setCopiedLevel] = useState<number | null>(null)
  const [editingLevel, setEditingLevel] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ title: "", intro: "", questionsJson: "[]" })
  const [editError, setEditError] = useState("")
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null)
  const [siteOrigin, setSiteOrigin] = useState("")

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
      const [levelsRes, subsRes] = await Promise.all([
        fetch("/api/posi/levels", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/posi/submissions", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const levelsJson = await levelsRes.json()
      const subsJson = await subsRes.json()
      if (levelsRes.ok) setLevels(levelsJson.levels ?? [])
      if (subsRes.ok) setSubmissions(subsJson.submissions ?? [])
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSiteOrigin(window.location.origin) }, [])

  const copyLink = (levelNumber: number) => {
    navigator.clipboard.writeText(`${siteOrigin}/posi/${levelNumber}`)
    setCopiedLevel(levelNumber)
    setTimeout(() => setCopiedLevel(null), 1500)
  }

  const startEdit = (level: Level) => {
    setEditingLevel(level.id)
    setEditError("")
    setEditDraft({ title: level.title, intro: level.intro ?? "", questionsJson: JSON.stringify(level.questions, null, 2) })
  }

  const saveEdit = async (level: Level) => {
    let parsedQuestions: any
    try { parsedQuestions = JSON.parse(editDraft.questionsJson) } catch {
      setEditError("El JSON de preguntas no es válido.")
      return
    }
    const token = await getToken()
    if (!token) return
    const res = await fetch("/api/admin/posi-levels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: level.id, title: editDraft.title, intro: editDraft.intro, questions: parsedQuestions }),
    })
    const json = await res.json()
    if (!res.ok) { setEditError(json?.error ?? "Error al guardar"); return }
    setEditingLevel(null)
    load()
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
        <h1 className="text-[22px] font-bold text-foreground leading-tight">POSI</h1>
        <p className="text-[13px] text-foreground/50 mt-0.5">
          Un link por nivel — pegalo en Slack cuando el cliente llegue ahí. El formulario no está dentro de la plataforma: solo por link, logueado con su cuenta.
        </p>
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
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1">
                    Preguntas (JSON) — type: "text" | "yesno" | "multiple_choice" (con options)
                  </label>
                  <textarea className={`${inputCls} font-mono text-[12px]`} rows={12} value={editDraft.questionsJson} onChange={(e) => setEditDraft((d) => ({ ...d, questionsJson: e.target.value }))} />
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
                      <span className="text-[11px] text-foreground/35">{new Date(s.submitted_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-foreground/30" /> : <ChevronDown className="h-3.5 w-3.5 text-foreground/30" />}
                    </div>
                  </button>
                  {isExpanded && level && (
                    <div className="px-4 pb-4 space-y-3 border-t border-foreground/[0.06] pt-3">
                      {level.questions.map((q) => (
                        <div key={q.id}>
                          <p className="text-[12px] font-semibold text-foreground/60">{q.label}</p>
                          <p className="text-[13px] text-foreground/85 mt-0.5">{formatAnswer(q, s.answers[q.id])}</p>
                        </div>
                      ))}
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
