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

interface WrongAnswer {
  id: string
  label: string
  your_answer: string | null
  correct_answer: string | null
}

// Solo viene en la respuesta del POST que auto-aprueba (3er intento
// fallido) — ver app/api/posi/submissions/route.ts. No existe endpoint
// GET que lo devuelva.
interface Feedback {
  auto_approved: boolean
  attempt_number: number
  wrong: WrongAnswer[]
}

// Viene en toda respuesta del POST cuando el nivel queda aprobado (real o
// auto-aprobado) — nunca trae el email ni el nombre del curso de Skool,
// eso es admin-only (ver app/api/posi/submissions/route.ts).
interface Unlock {
  pending: boolean
  level_title: string | null
  // Única excepción a "el cliente no se entera de por qué no se destrabó" —
  // sin email cargado no hay nada que el sistema pueda hacer, y es lo único
  // que el cliente puede resolver por su cuenta (avisando al equipo).
  blocked_no_email: boolean
}

const inputCls = "w-full rounded-xl border border-border bg-secondary px-4 py-3 text-[15px] text-foreground placeholder:text-text-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"

function computeScore(level: Level | null, answers: Record<string, any>): { correct: number; total: number } | null {
  if (!level) return null
  const scored = level.questions.filter((q) => q.type === "multiple_choice" && typeof q.correct_index === "number")
  if (scored.length === 0) return null
  const correct = scored.filter((q) => answers[q.id] === q.correct_index).length
  return { correct, total: scored.length }
}

// El botón de reintentar sale siempre, haya aprobado o no — pedido explícito
// del equipo (antes solo se ofrecía si reprobaba). Cada envío queda como
// intento propio en el historial (insert, no upsert — ver submissions/route.ts).
//
// `score` es opcional: correct_index nunca se le manda a un cliente real
// (levels/route.ts lo saca para todo el que no sea admin), así que
// computeScore da null para el 99% de los casos reales — ahí se muestra
// el resultado sin el detalle de puntaje, nunca "score: undefined/0".
// Línea de pie para el mail de Skool — nunca decir "ya tenés acceso" ni
// "desbloqueado": Skool manda una invitación que hay que aceptar, tarda
// 10-15 minutos y no es instantánea. Prometer acceso inmediato acá es
// soporte que después tiene que absorber Ann.
function UnlockNotice({ unlock }: { unlock?: Unlock | null }) {
  if (unlock?.pending) {
    return (
      <p className="mt-4 text-[13px] text-text-2">
        Ya se activó tu acceso a <span className="font-semibold text-foreground">{unlock.level_title}</span> — te va a
        llegar un mail de Skool en los próximos minutos, abrilo y aceptá el acceso desde ahí.
      </p>
    )
  }
  if (unlock?.blocked_no_email) {
    return (
      <p className="mt-4 text-[13px] text-text-2">
        Avisale al equipo de Smart Scale que te habilite el siguiente módulo.
      </p>
    )
  }
  return null
}

function ResultBanner({ passed, score, levelTitle, onRetry, feedback, unlock }: {
  passed: boolean
  score: { correct: number; total: number } | null
  levelTitle?: string
  onRetry?: () => void
  feedback?: Feedback | null
  unlock?: Unlock | null
}) {
  // Aprobado, pero por regla (3er intento fallido) — no por nota real:
  // tono intermedio (ámbar, no rojo ni verde pleno) y el detalle de lo
  // que erró, para que repase antes de seguir.
  if (feedback?.auto_approved) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-100 dark:bg-amber-500/10 p-8">
        <div className="text-center">
          <Check className="h-8 w-8 text-amber-700 dark:text-amber-400 mx-auto mb-3" />
          <p className="text-[18px] font-bold text-amber-700 dark:text-amber-400">Aprobado — con observaciones</p>
          <p className="text-[13px] text-text-2 mt-1">
            Completaste el {levelTitle ?? "nivel"} en {feedback.attempt_number} intentos. Te damos el nivel por
            aprobado, pero repasá estos puntos antes de seguir:
          </p>
          <UnlockNotice unlock={unlock} />
        </div>

        {feedback.wrong.length > 0 && (
          <div className="mt-5 space-y-2.5 text-left">
            {feedback.wrong.map((w) => (
              <div key={w.id} className="rounded-xl border border-border bg-secondary px-4 py-3">
                <p className="text-[13px] font-semibold text-foreground">{w.label}</p>
                <p className="text-[13px] text-text-3 mt-1">
                  Tu respuesta: <span className="text-text-2">{w.your_answer ?? "(sin responder)"}</span>
                </p>
                <p className="text-[13px] text-text-3">
                  Respuesta correcta: <span className="text-text-2">{w.correct_answer ?? "—"}</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {onRetry && (
          <div className="text-center">
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 rounded-xl border border-border px-5 py-2.5 text-[13px] font-medium text-foreground transition hover:bg-secondary"
            >
              Volver a responder
            </button>
          </div>
        )}
      </div>
    )
  }

  if (passed) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-100 dark:bg-emerald-500/10 p-8 text-center">
        <Check className="h-8 w-8 text-emerald-700 dark:text-emerald-400 mx-auto mb-3" />
        <p className="text-[18px] font-bold text-emerald-700 dark:text-emerald-400">Has aprobado 🎉</p>
        <p className="text-[13px] text-text-2 mt-1">
          Gracias por completar {levelTitle ?? "el nivel"}.
          {score && ` Respondiste correctamente ${score.correct} de ${score.total}.`}
        </p>
        <UnlockNotice unlock={unlock} />
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 rounded-xl border border-border px-5 py-2.5 text-[13px] font-medium text-foreground transition hover:bg-secondary"
          >
            Volver a responder
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-100 dark:bg-red-500/10 p-8 text-center">
      <X className="h-8 w-8 text-red-700 dark:text-red-400 mx-auto mb-3" />
      <p className="text-[18px] font-bold text-red-700 dark:text-red-400">No has aprobado</p>
      <p className="text-[13px] text-text-2 mt-1">
        {score && `Respondiste correctamente ${score.correct} de ${score.total} en `}
        {levelTitle ?? "Este nivel"}. Repasá el contenido en Skool antes de seguir.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-xl btn-accent px-5 py-2.5 text-[13px] font-bold transition"
        >
          Volver a intentar
        </button>
      )}
    </div>
  )
}

export function PosiFormView({ levelNumber }: { levelNumber: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const overrideClientId = searchParams.get("client_id")

  const [status, setStatus] = useState<"loading" | "ready" | "no-client" | "not-found" | "submitting" | "done" | "error">("loading")
  const [level, setLevel] = useState<Level | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  // Verdad del servidor sobre si aprobó — null en niveles sin preguntas
  // calificables (checklist/texto puro). No confundir con computeScore(),
  // que para un cliente real siempre da null (correct_index nunca se le manda).
  const [lastPassed, setLastPassed] = useState<boolean | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [unlock, setUnlock] = useState<Unlock | null>(null)
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

    const levelsRes = await fetch("/api/posi/levels", { headers: { Authorization: `Bearer ${session.access_token}` } })
    const levelsJson = await levelsRes.json()

    const foundLevel: Level | undefined = (levelsJson.levels ?? []).find((l: any) => l.level_number === levelNumber)
    if (!foundLevel) { setStatus("not-found"); return }
    setLevel(foundLevel)

    // Se puede reintentar las veces que quiera, haya aprobado o no —
    // pedido explícito (antes se bloqueaba si ya había aprobado, y la
    // versión intermedia solo destrababa si reprobaba). Cada envío queda
    // como intento propio en el historial (ver app/api/posi/submissions/
    // route.ts, insert en vez de upsert) — no hace falta mirar intentos
    // previos acá, el formulario siempre arranca en blanco.
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
      setLastPassed(json?.submission?.passed ?? null)
      setFeedback(json?.feedback ?? null)
      setUnlock(json?.unlock ?? null)
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
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-text-3" /></div>
        )}

        {status === "no-client" && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-[13px] text-text-2">Todavía no tenés un negocio vinculado a tu cuenta. Avisale al equipo de Smart Scale.</p>
          </div>
        )}

        {status === "not-found" && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-[13px] text-text-2">Este nivel no existe.</p>
          </div>
        )}

        {status === "done" && (() => {
          const retry = () => { setErrorMsg(""); setAnswers({}); setFeedback(null); setUnlock(null); setStatus("ready") }
          // Nivel sin preguntas calificables (checklist/texto puro) — no hay
          // concepto de aprobar/reprobar, mismo mensaje genérico de siempre.
          if (lastPassed === null) {
            return (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/[0.06] p-8 text-center">
                <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
                <p className="text-[15px] font-semibold text-foreground">¡Listo, quedó enviado! 🎉</p>
                <p className="text-[13px] text-text-2 mt-1">Gracias por completar el {level?.title}.</p>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-5 rounded-xl border border-border px-5 py-2.5 text-[13px] font-medium text-foreground transition hover:bg-secondary"
                >
                  Volver a responder
                </button>
              </div>
            )
          }
          return (
            <ResultBanner
              passed={lastPassed}
              score={computeScore(level, answers)}
              levelTitle={level?.title}
              onRetry={retry}
              feedback={feedback}
              unlock={unlock}
            />
          )
        })()}

        {(status === "ready" || status === "submitting" || status === "error") && level && (
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h1 className="text-[24px] font-bold text-foreground mb-1">{level.title}</h1>
            {level.intro && (
              <p className="text-[13px] text-text-2 mb-6 whitespace-pre-line leading-relaxed">{level.intro}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {level.questions.map((q) => (
                <div key={q.id}>
                  <label className="block text-[15px] font-medium text-foreground mb-2">{q.label}</label>
                  {q.type === "text" && (
                    <textarea className={inputCls} rows={2} value={answers[q.id] ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} required />
                  )}
                  {q.type === "yesno" && (
                    <div className="flex gap-3">
                      {["Sí", "No"].map((opt, i) => (
                        <label key={opt} className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium cursor-pointer transition-colors ${answers[q.id] === (i === 0) ? "border-accent bg-secondary text-foreground" : "border-border text-text-2 hover:bg-secondary"}`}>
                          <input type="radio" name={q.id} className="sr-only" checked={answers[q.id] === (i === 0)} onChange={() => setAnswer(q.id, i === 0)} required />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === "multiple_choice" && (
                    <div className="space-y-2">
                      {(q.options ?? []).map((opt, i) => (
                        <label key={i} className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[13px] cursor-pointer transition-colors ${answers[q.id] === i ? "border-accent bg-secondary text-foreground" : "border-border text-foreground hover:bg-secondary"}`}>
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
                className="w-full flex items-center justify-center gap-2 rounded-xl btn-accent px-5 py-3 text-[13px] font-bold disabled:opacity-50 transition-colors"
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
