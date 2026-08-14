"use client"

/**
 * Formulario POSI standalone — se accede solo por link directo (compartido
 * por Slack cuando el cliente llega a ese nivel), nunca desde el nav del
 * portal. Requiere sesión real (no hay selector de nombre — la identidad
 * es quien está logueado), pero deliberadamente NO usa <DashboardLayout>:
 * no debe verse como parte de la plataforma.
 */

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { Loader2, Check, X } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { BrandLogo } from "@/components/theme/brand-logo"

interface Question {
  id: string
  label: string
  type: "text" | "yesno" | "multiple_choice"
  options?: string[]
  correct_index?: number
}

interface Level {
  id: string
  level_number: number
  title: string
  intro: string | null
  questions: Question[]
}

const inputCls = "w-full rounded-xl border border-foreground/[0.1] bg-foreground/[0.03] px-4 py-3 text-[15px] text-foreground placeholder:text-foreground/25 focus:border-[#dafc69]/50 focus:outline-none focus:ring-1 focus:ring-[#dafc69]/25"

// Umbral de aprobación — solo sobre preguntas multiple_choice con correct_index definido.
const PASS_THRESHOLD = 0.7

function computeScore(level: Level | null, answers: Record<string, any>): { correct: number; total: number } | null {
  if (!level) return null
  const scored = level.questions.filter((q) => q.type === "multiple_choice" && typeof q.correct_index === "number")
  if (scored.length === 0) return null
  const correct = scored.filter((q) => answers[q.id] === q.correct_index).length
  return { correct, total: scored.length }
}

function ResultBanner({ passed, score, levelTitle, alreadyDone }: {
  passed: boolean
  score: { correct: number; total: number }
  levelTitle?: string
  alreadyDone?: boolean
}) {
  if (passed) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-100 dark:bg-emerald-500/10 p-8 text-center">
        <Check className="h-8 w-8 text-emerald-700 dark:text-emerald-400 mx-auto mb-3" />
        <p className="text-[17px] font-bold text-emerald-700 dark:text-emerald-400">Has aprobado 🎉</p>
        <p className="text-sm text-foreground/60 mt-1">
          {alreadyDone ? `Ya completaste ${levelTitle ?? "este nivel"} — ` : `Gracias por completar ${levelTitle ?? "el nivel"}. `}
          Respondiste correctamente {score.correct} de {score.total}.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-100 dark:bg-red-500/10 p-8 text-center">
      <X className="h-8 w-8 text-red-700 dark:text-red-400 mx-auto mb-3" />
      <p className="text-[17px] font-bold text-red-700 dark:text-red-400">No has aprobado</p>
      <p className="text-sm text-foreground/60 mt-1">
        Respondiste correctamente {score.correct} de {score.total} en {levelTitle ?? "este nivel"}. Repasá el contenido con el equipo de Smart Scale antes de seguir.
      </p>
    </div>
  )
}

export function PosiFormView({ levelNumber }: { levelNumber: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const overrideClientId = searchParams.get("client_id")

  const [status, setStatus] = useState<"loading" | "ready" | "already-done" | "no-client" | "not-found" | "submitting" | "done" | "error">("loading")
  const [level, setLevel] = useState<Level | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, any> | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent(`/posi/${levelNumber}${overrideClientId ? `?client_id=${overrideClientId}` : ""}`)}`)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace("/login"); return }

    const { data: profile } = await supabase.from("profiles").select("role, client_id").eq("id", user.id).maybeSingle()
    const role = String((profile as any)?.role ?? "").toLowerCase()
    const isInternal = role === "admin" || role === "team" || role === "setter" || role === "developer"
    const clientId = isInternal ? (overrideClientId || (profile as any)?.client_id) : (profile as any)?.client_id

    if (!clientId) { setStatus("no-client"); return }

    const [levelsRes, subsRes] = await Promise.all([
      fetch("/api/posi/levels", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      fetch(`/api/posi/submissions?client_id=${encodeURIComponent(clientId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
    ])
    const levelsJson = await levelsRes.json()
    const subsJson = await subsRes.json()

    const foundLevel: Level | undefined = (levelsJson.levels ?? []).find((l: any) => l.level_number === levelNumber)
    if (!foundLevel) { setStatus("not-found"); return }
    setLevel(foundLevel)

    const existingSubmission = (subsJson.submissions ?? []).find((s: any) => s.level_id === foundLevel.id)
    if (existingSubmission && !overrideClientId) {
      setSubmittedAnswers(existingSubmission.answers ?? {})
      setStatus("already-done")
      return
    }

    setStatus("ready")
  }, [levelNumber, overrideClientId, router])

  useEffect(() => { load() }, [load])

  const setAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!level) return
    setStatus("submitting")
    setErrorMsg("")
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from("profiles").select("role, client_id").eq("id", user!.id).maybeSingle()
      const role = String((profile as any)?.role ?? "").toLowerCase()
      const isInternal = role === "admin" || role === "team" || role === "setter" || role === "developer"
      const clientId = isInternal ? (overrideClientId || (profile as any)?.client_id) : (profile as any)?.client_id

      const res = await fetch("/api/posi/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ client_id: clientId, level_id: level.id, answers }),
      })
      const json = await res.json()
      if (!res.ok) { setStatus("error"); setErrorMsg(json?.error ?? "Error al enviar"); return }
      setStatus("done")
    } catch (err: any) {
      setStatus("error")
      setErrorMsg(err?.message ?? "Error inesperado")
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-center mb-8">
          <BrandLogo size={32} wordmarkSize={16} />
        </div>

        {status === "loading" && (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-foreground/30" /></div>
        )}

        {status === "no-client" && (
          <div className="rounded-2xl border border-foreground/10 bg-card p-8 text-center">
            <p className="text-sm text-foreground/60">Todavía no tenés un negocio vinculado a tu cuenta. Avisale al equipo de Smart Scale.</p>
          </div>
        )}

        {status === "not-found" && (
          <div className="rounded-2xl border border-foreground/10 bg-card p-8 text-center">
            <p className="text-sm text-foreground/60">Este nivel no existe.</p>
          </div>
        )}

        {status === "already-done" && (() => {
          const score = computeScore(level, submittedAnswers ?? {})
          if (!score) {
            return (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/[0.06] p-8 text-center">
                <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
                <p className="text-[15px] font-semibold text-foreground">Ya completaste este nivel.</p>
                <p className="text-sm text-foreground/50 mt-1">No hace falta que lo vuelvas a enviar.</p>
              </div>
            )
          }
          const passed = score.correct / score.total >= PASS_THRESHOLD
          return <ResultBanner passed={passed} score={score} levelTitle={level?.title} alreadyDone />
        })()}

        {status === "done" && (() => {
          const score = computeScore(level, answers)
          if (!score) {
            return (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/[0.06] p-8 text-center">
                <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
                <p className="text-[15px] font-semibold text-foreground">¡Listo, quedó enviado! 🎉</p>
                <p className="text-sm text-foreground/50 mt-1">Gracias por completar el {level?.title}.</p>
              </div>
            )
          }
          const passed = score.correct / score.total >= PASS_THRESHOLD
          return <ResultBanner passed={passed} score={score} levelTitle={level?.title} />
        })()}

        {(status === "ready" || status === "submitting" || status === "error") && level && (
          <div className="rounded-2xl border border-foreground/10 bg-card p-6 sm:p-8">
            <h1 className="text-xl font-bold text-foreground mb-1">{level.title}</h1>
            {level.intro && (
              <p className="text-[13px] text-foreground/50 mb-6 whitespace-pre-line leading-relaxed">{level.intro}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {level.questions.map((q) => (
                <div key={q.id}>
                  <label className="block text-[14px] font-medium text-foreground/85 mb-2">{q.label}</label>
                  {q.type === "text" && (
                    <textarea className={inputCls} rows={2} value={answers[q.id] ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} required />
                  )}
                  {q.type === "yesno" && (
                    <div className="flex gap-3">
                      {["Sí", "No"].map((opt, i) => (
                        <label key={opt} className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors ${answers[q.id] === (i === 0) ? "border-[#dafc69]/60 bg-[#dafc69]/10 text-foreground" : "border-foreground/[0.1] text-foreground/60 hover:bg-foreground/[0.03]"}`}>
                          <input type="radio" name={q.id} className="sr-only" checked={answers[q.id] === (i === 0)} onChange={() => setAnswer(q.id, i === 0)} required />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === "multiple_choice" && (
                    <div className="space-y-2">
                      {(q.options ?? []).map((opt, i) => (
                        <label key={i} className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm cursor-pointer transition-colors ${answers[q.id] === i ? "border-[#dafc69]/60 bg-[#dafc69]/10 text-foreground" : "border-foreground/[0.1] text-foreground/70 hover:bg-foreground/[0.03]"}`}>
                          <input type="radio" name={q.id} className="sr-only" checked={answers[q.id] === i} onChange={() => setAnswer(q.id, i)} required />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {status === "error" && <p className="text-[13px] text-red-700 dark:text-red-400">{errorMsg}</p>}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#dafc69] px-5 py-3 text-sm font-bold text-black hover:bg-[#f2ffc0] disabled:opacity-50 transition-colors"
              >
                {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
                {status === "submitting" ? "Enviando…" : "Enviar"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
