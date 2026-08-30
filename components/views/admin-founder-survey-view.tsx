"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { SectionHeader } from "@/components/ui/section-header"
import { StatusPill } from "@/components/ui/status-pill"
import { SURVEY_SECTIONS, type SurveyQuestion, type SurveySection } from "@/lib/founder-survey-questions"

type Answers = Record<string, string | string[]>

interface SectionState {
  answers: Answers
  completed_at: string | null
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion
  value: string | string[] | undefined
  onChange: (val: string | string[]) => void
}) {
  if (question.type === "text") {
    return (
      <textarea
        value={(value as string) ?? ""}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder={question.placeholder ?? "Escribí tu respuesta..."}
        className="mt-2 w-full rounded-lg border border-foreground/[0.10] bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-text-3 focus:outline-none focus:ring-1 focus:ring-accent/20"
      />
    )
  }

  if (question.type === "single") {
    return (
      <div className="mt-2 space-y-1.5">
        {question.options?.map(opt => {
          const selected = value === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition-all",
                selected
                  ? "border-accent bg-secondary text-foreground font-semibold"
                  : "border-foreground/[0.08] text-foreground hover:border-foreground/20",
              )}
            >
              {selected ? <CheckCircle2 className="h-4 w-4 text-[#dafc69] shrink-0" /> : <Circle className="h-4 w-4 text-text-3 shrink-0" />}
              {opt}
            </button>
          )
        })}
      </div>
    )
  }

  // multi
  const selectedList = Array.isArray(value) ? value : []
  return (
    <div className="mt-2 space-y-1.5">
      {question.options?.map(opt => {
        const selected = selectedList.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              const next = selected ? selectedList.filter(o => o !== opt) : [...selectedList, opt]
              onChange(next)
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition-all",
              selected
                ? "border-accent bg-secondary text-foreground font-semibold"
                : "border-foreground/[0.08] text-foreground hover:border-foreground/20",
            )}
          >
            {selected ? <CheckCircle2 className="h-4 w-4 text-[#dafc69] shrink-0" /> : <Circle className="h-4 w-4 text-text-3 shrink-0" />}
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function SectionCard({
  section,
  state,
  onSave,
}: {
  section: SurveySection
  state: SectionState
  onSave: (section: string, answers: Answers, completed: boolean) => Promise<void>
}) {
  const [answers, setAnswers] = useState<Answers>(state.answers ?? {})
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  const answeredCount = section.questions.filter(q => {
    const v = answers[q.key]
    return Array.isArray(v) ? v.length > 0 : !!v
  }).length
  const isComplete = answeredCount === section.questions.length

  const handleSave = async (markComplete: boolean) => {
    setSaving(true)
    try {
      await onSave(section.section, answers, markComplete)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-foreground/[0.07] bg-card p-5">
      <SectionHeader
        icon={Sparkles}
        title={section.title}
        subtitle={section.subtitle}
        action={
          state.completed_at ? (
            <StatusPill variant="ok">completo</StatusPill>
          ) : (
            <StatusPill variant="idle">{answeredCount}/{section.questions.length}</StatusPill>
          )
        }
      />

      <div className="mt-5 space-y-5">
        {section.questions.map(q => (
          <div key={q.key}>
            <p className="text-[13px] font-semibold text-foreground">{q.label}</p>
            <QuestionField
              question={q}
              value={answers[q.key]}
              onChange={val => setAnswers(prev => ({ ...prev, [q.key]: val }))}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-3 text-[12.5px] font-semibold text-foreground hover:text-foreground hover:border-foreground/25 transition-all disabled:opacity-40"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Guardar borrador
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving || !isComplete}
          className="flex h-9 items-center gap-1.5 rounded-lg btn-accent px-3 text-[12.5px] font-bold transition-all disabled:opacity-40"
          title={!isComplete ? "Respondé todas las preguntas para marcar como completo" : undefined}
        >
          Marcar sección como completa
        </button>
        {savedMsg && <span className="text-[12px] text-emerald-700 dark:text-emerald-400">✓ Guardado</span>}
      </div>
    </div>
  )
}

export function AdminFounderSurveyView() {
  const [sections, setSections] = useState<Record<string, SectionState> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const getAuthHeader = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    return { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
  }, [])

  const fetchData = useCallback(async () => {
    const headers = await getAuthHeader()
    if (!headers) return
    const res = await fetch("/api/admin/founder-survey", { headers })
    if (!res.ok) { setError("No se pudo cargar la encuesta."); return }
    const json = await res.json()
    const bySection: Record<string, SectionState> = {}
    for (const s of SURVEY_SECTIONS) {
      const row = json.sections?.[s.section]
      bySection[s.section] = { answers: row?.answers ?? {}, completed_at: row?.completed_at ?? null }
    }
    setSections(bySection)
  }, [getAuthHeader])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = useCallback(async (section: string, answers: Answers, completed: boolean) => {
    const headers = await getAuthHeader()
    if (!headers) return
    await fetch("/api/admin/founder-survey", {
      method: "POST",
      headers,
      body: JSON.stringify({ section, answers, completed }),
    })
    await fetchData()
  }, [getAuthHeader, fetchData])

  const totalSections = SURVEY_SECTIONS.length
  const completedSections = sections ? Object.values(sections).filter(s => s.completed_at).length : 0

  return (
    <div className="max-w-[820px] mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Actualizar Sistema Operativo</h1>
        <p className="text-sm text-text-2 mt-0.5">
          Respondé estas preguntas para que todo el sistema de IA (Ann, los asistentes, y lo que se construya después) tenga el contexto real del negocio — sin tener que escribir markdown.
        </p>
        {sections && (
          <p className="text-[12px] text-text-3 mt-2">{completedSections}/{totalSections} secciones completas</p>
        )}
      </div>

      {error && <p className="text-[13px] text-red-700 dark:text-red-400">{error}</p>}

      {!sections ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#dafc69]/40" />
        </div>
      ) : (
        SURVEY_SECTIONS.map(s => (
          <SectionCard key={s.section} section={s} state={sections[s.section]} onSave={handleSave} />
        ))
      )}
    </div>
  )
}
