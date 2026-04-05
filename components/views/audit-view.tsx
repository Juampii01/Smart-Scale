"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient, useSelectedMonth } from "@/components/layout/dashboard-layout"
import { useAnnualMetrics } from "@/contexts/annual-metrics-context"
import { AiLoading } from "@/components/ui/ai-loading"

// ─── Audit data ──────────────────────────────────────────────────────────────

const sections = [
  {
    title: "Ecosistema Circular — menos de $20k/mes",
    items: [
      { id: "F1", label: "Atraigo nuevos seguidores de forma consistente con mi contenido todos los días" },
      { id: "F2", label: "Me siento seguro/a sabiendo qué publicar cada semana para crecer y convertir" },
      { id: "F3", label: "Puedo iniciar 5 conversaciones de calidad por DM todos los días sin depender solo de ADS" },
      { id: "F4", label: "Me llegan DM's calificados y agendas del quick cash DM" },
      { id: "E1", label: "Mando de forma consistente al menos un email por semana a mi lista" },
      { id: "E2", label: "Tengo un sistema para hacer seguimiento de leads, conversaciones, pagos y progreso de clientes" },
      { id: "E3", label: "Solo dedico tiempo a hablar con prospectos 4+5★ con el DM-Close™" },
      { id: "I1", label: "Mis clientes logran su primera gran victoria en los primeros 30 días" },
      { id: "I2", label: "Mi onboarding y recursos hacen que los clientes sepan exactamente qué esperar" },
      { id: "I3", label: "Podría duplicar mis clientes mañana sin quemarme" },
      { id: "T1", label: "Mi programa resuelve un dolor profundo que mi audiencia ya está intentando solucionar" },
      { id: "T2", label: "Tengo al menos 5 entrevistas de casos de exito que muestran la transformación que prometo" },
      { id: "T3", label: "Tengo una oferta central clara que puedo vender por al menos $3k" },
    ],
  },
  {
    title: "Ecosistema Circular — más de $20k/mes",
    items: [
      { id: "F4", label: "Mis publicaciones de contenido corto generan consultas de leads entrantes todos los días" },
      { id: "F5", label: "Mi contenido genera guardados, compartidos y DMs de forma constante sin publicidad" },
      { id: "F6", label: "Mi calendario de marketing está claramente planificado para el próximo mes" },
      { id: "F7", label: "Recupere ROI de la inversion en Smart Scale con los DM QUICK CASH (O Cash Menu)" },
      { id: "E4", label: "Aparezco de forma consistente cada semana en formato largo para construir mi Marca Autentica™" },
      { id: "E5", label: "Los clientes compran sin necesitar persuasión en DMs ni en una llamada de ventas (puede ser llamada corta de 15 min logistica)" },
      { id: "E6", label: "Puedo llenar de forma consistente un taller (Workshop) con una campaña de 7 días" },
      { id: "I4", label: "Tengo un ritmo y una cadencia repetible para incorporar nuevos clientes de forma consistente" },
      { id: "I5", label: "Mi proceso de onboarding es sin fricción, claro y no me requiere a mí" },
      { id: "I6", label: "No soy el cuello de botella, mis clientes avanzan incluso cuando estoy offline" },
      { id: "T4", label: "Mi comunidad de clientes genera amistades reales y referidos" },
      { id: "T5", label: "Solo hago trabajo de alta traccion en mi Zona de Genialidad que me da energía al máximo" },
      { id: "T6", label: "Puedo generar casos de exito todos los meses" },
    ],
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type DiagnosisHistoryItem = {
  request_id: string
  status: string
  created_at: string | null
  updated_at: string | null
  result: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderDiagnosisContent(content: string) {
  const lines = content.split("\n")

  return lines.map((rawLine, index) => {
    const line = rawLine.trim()

    if (!line) {
      return <div key={`spacer-${index}`} className="h-3" />
    }

    if (line === "---") {
      return <div key={`divider-${index}`} className="my-5 h-px w-full bg-white/10" />
    }

    if (line.startsWith("# ")) {
      return (
        <h2
          key={`h1-${index}`}
          className="text-2xl font-semibold tracking-tight text-white md:text-3xl"
        >
          {line.replace(/^#\s+/, "")}
        </h2>
      )
    }

    if (line.startsWith("## ")) {
      return (
        <div key={`h2-wrap-${index}`} className="pt-3">
          <h3 className="text-lg font-semibold uppercase tracking-[0.14em] text-white/80">
            {line.replace(/^##\s+/, "")}
          </h3>
          <div className="mt-2 h-px w-full bg-white/10" />
        </div>
      )
    }

    if (line.startsWith("### ")) {
      return (
        <h4 key={`h3-${index}`} className="pt-2 text-base font-semibold text-white">
          {line.replace(/^###\s+/, "")}
        </h4>
      )
    }

    if (line.startsWith("> ")) {
      return (
        <div
          key={`quote-${index}`}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70"
        >
          {line.replace(/^>\s+/, "")}
        </div>
      )
    }

    if (line.startsWith("- ")) {
      return (
        <div key={`bullet-${index}`} className="flex items-start gap-3 text-sm leading-7 text-white/60">
          <span className="mt-2.5 h-1 w-1 rounded-full bg-[#ffde21]/60 flex-shrink-0" />
          <span>{line.replace(/^-\s+/, "")}</span>
        </div>
      )
    }

    if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      return (
        <p key={`strong-${index}`} className="text-sm font-semibold leading-7 text-white">
          {line.replace(/^\*\*/, "").replace(/\*\*$/, "")}
        </p>
      )
    }

    const parts = line.split(/(\*\*.*?\*\*)/g)

    return (
      <p key={`p-${index}`} className="text-sm leading-7 text-white/60 md:text-[15px]">
        {parts.map((part, partIndex) => {
          if (/^\*\*.*\*\*$/.test(part)) {
            return (
              <strong key={`strong-inline-${index}-${partIndex}`} className="font-semibold text-white">
                {part.slice(2, -2)}
              </strong>
            )
          }

          return <Fragment key={`text-${index}-${partIndex}`}>{part}</Fragment>
        })}
      </p>
    )
  })
}

function formatDiagnosisDate(value: string | null) {
  if (!value) return "Sin fecha"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin fecha"

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function getStatusMeta(status: string) {
  if (status === "completed") {
    return {
      label: "Completado",
      className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
      dotClassName: "bg-emerald-400",
    }
  }

  if (status === "failed") {
    return {
      label: "Fallido",
      className: "border-red-400/20 bg-red-500/10 text-red-200",
      dotClassName: "bg-red-400",
    }
  }

  return {
    label: "Pendiente",
    className: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    dotClassName: "bg-amber-400",
  }
}

function getStatusCopy(status: string) {
  if (status === "completed") {
    return "Diagnóstico listo para revisar"
  }

  if (status === "failed") {
    return "Hubo un error en la generación"
  }

  return "Todavía en procesamiento"
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AuditView() {
  const [scores, setScores] = useState<Record<string, string>>({})
  const [aiResponse, setAiResponse] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [diagnosisHistory, setDiagnosisHistory] = useState<DiagnosisHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const activeClientId = useActiveClient()
  const selectedMonth = useSelectedMonth() ?? "2025-12"
  const { annualMetrics, loading: loadingAudit, error } = useAnnualMetrics()
  const annualRevenue = annualMetrics?.total_revenue ?? 0
  const auditType: 'menos20k' | 'mas20k' = annualRevenue >= 20000 ? 'mas20k' : 'menos20k'

  const diagnosisContent = useMemo(() => {
    if (!aiResponse) return null
    return renderDiagnosisContent(aiResponse)
  }, [aiResponse])

  const selectedAnswersCount = useMemo(() => Object.keys(scores).length, [scores])

  const loadDiagnosisHistory = useCallback(async () => {
    if (!userId) {
      setDiagnosisHistory([])
      return
    }

    setLoadingHistory(true)

    try {
      const supabase = createClient()

      let query = supabase
        .from("ai_diagnosis_requests")
        .select(`
          id,
          status,
          created_at,
          updated_at,
          ai_diagnosis_results (
            result,
            created_at
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20)

      if (activeClientId) {
        query = query.eq("client_id", activeClientId)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error loading diagnosis history:", error)
        setDiagnosisHistory([])
        return
      }

      const normalized: DiagnosisHistoryItem[] = (data ?? []).map((item: any) => {
        const latestResult = Array.isArray(item?.ai_diagnosis_results)
          ? [...item.ai_diagnosis_results].sort((a: any, b: any) => {
              const aTime = new Date(a?.created_at ?? 0).getTime()
              const bTime = new Date(b?.created_at ?? 0).getTime()
              return bTime - aTime
            })[0] ?? null
          : null

        return {
          request_id: item.id,
          status: item.status ?? "pending",
          created_at: item.created_at ?? null,
          updated_at: item.updated_at ?? null,
          result: latestResult?.result ?? null,
        }
      })

      setDiagnosisHistory(normalized)
    } catch (error) {
      console.error("Unexpected error loading diagnosis history:", error)
      setDiagnosisHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [activeClientId, userId])

  const activeSection = sections.find((_, idx) =>
    (auditType === 'menos20k' && idx === 0) || (auditType === 'mas20k' && idx === 1)
  )

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      setUserId(data?.user?.id ?? null)
    }

    loadUser()
  }, [])

  useEffect(() => {
    loadDiagnosisHistory()
  }, [loadDiagnosisHistory])

  const setStatus = (id: string, value: string) => {
    setScores((prev) => {
      if (prev[id] === value) {
        const updated = { ...prev }
        delete updated[id]
        return updated
      }
      return { ...prev, [id]: value }
    })
  }

  const buildPrompt = () => {
    const activeItems = activeSection?.items ?? []

    const groupedAnswers = {
      red: activeItems.filter((item) => scores[item.id] === "red"),
      yellow: activeItems.filter((item) => scores[item.id] === "yellow"),
      green: activeItems.filter((item) => scores[item.id] === "green"),
      unanswered: activeItems.filter((item) => !scores[item.id]),
    }

    const formatItems = (items: { id: string; label: string }[], colorLabel: string) => {
      if (items.length === 0) return "- Ninguno"
      return items
        .map((item) => `- [${colorLabel}] ${item.id}: ${item.label}`)
        .join("\n")
    }

    return `PUNTOS EN ROJO (críticos):
${formatItems(groupedAnswers.red, "ROJO")}

PUNTOS EN NARANJA (debilitados):
${formatItems(groupedAnswers.yellow, "NARANJA")}

PUNTOS EN VERDE (fortalezas actuales):
${formatItems(groupedAnswers.green, "VERDE")}

PUNTOS SIN RESPONDER:
${formatItems(groupedAnswers.unanswered, "SIN RESPUESTA")}`
  }

  const pollDiagnosisResult = async (requestId: string, retries = 20, interval = 3000) => {
    for (let i = 0; i < retries; i++) {
      const res = await fetch(`/api/ai-diagnosis?request_id=${requestId}`)
      const data = await res.json()
      if (data.status === "completed" && data.result) {
        setAiResponse(data.result)
        setLoading(false)
        loadDiagnosisHistory()
        return
      }

      if (data.status === "failed") {
        setAiResponse(data.result || "El diagnóstico falló. Revisá el historial para más contexto.")
        setLoading(false)
        loadDiagnosisHistory()
        return
      }
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
    setAiResponse("El diagnóstico está tardando más de lo esperado. Intenta actualizar en unos minutos.")
    setLoading(false)
  }

  const generateAIResponse = async () => {
    setLoading(true)
    setAiResponse("")
    try {
      const prompt = buildPrompt()
      if (!userId) {
        setAiResponse("No se pudo identificar el usuario autenticado.")
        setLoading(false)
        return
      }

      const res = await fetch("/api/ai-diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          auditType,
          annualRevenue,
          selectedMonth,
          clientId: activeClientId,
          userId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setAiResponse(
          data?.detail || data?.error || "No se pudo generar el diagnóstico."
        )
        setLoading(false)
        loadDiagnosisHistory()
        return
      }

      setAiResponse("Diagnóstico en proceso... Esto puede demorar unos segundos.")
      if (data.request_id) {
        loadDiagnosisHistory()
        pollDiagnosisResult(data.request_id)
      } else {
        setAiResponse("No se pudo obtener el ID del diagnóstico.")
        setLoading(false)
      }
    } catch (err: any) {
      setAiResponse(err?.message || "Error generando diagnóstico.")
      setLoading(false)
    }
  }

  const autoSelectRandom = () => {
    if (!activeSection) return
    const options = ["red", "yellow", "green"]
    const randomScores: Record<string, string> = {}
    for (const item of activeSection.items) {
      const random = options[Math.floor(Math.random() * options.length)]
      randomScores[item.id] = random
    }
    setScores(randomScores)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-white/70">Auditoría Estratégica</h1>
        </div>
        <p className="text-xs text-white/30 ml-[18px]">Evaluación del Ecosistema Circular · {selectedMonth}</p>
      </div>

      {/* Revenue card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
        <div className={`h-[2px] w-full ${annualRevenue >= 20000 ? "bg-emerald-500/60" : "bg-amber-500/60"}`} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.04),transparent_55%)]" />
        <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
              Revenue total rolling 12 meses
            </p>
            <div className="text-3xl font-bold tracking-tight text-white">
              {annualMetrics && typeof annualMetrics.total_revenue === 'number'
                ? annualMetrics.total_revenue.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  })
                : '—'}
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
              Audit activo
            </span>
            <span
              className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold ${
                annualRevenue >= 20000
                  ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/20'
                  : 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/20'
              }`}
            >
              {annualRevenue >= 20000 ? 'Más de $20k' : 'Menos de $20k'}
            </span>
          </div>
        </div>
      </div>

      {loadingAudit ? (
        <p className="text-white/40 text-sm">Cargando tipo de auditoría…</p>
      ) : (
        <>
          {sections
            .filter((section, idx) =>
              (auditType === 'menos20k' && idx === 0) || (auditType === 'mas20k' && idx === 1)
            )
            .map((section) => (
              <div key={section.title} className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-[2px] rounded-full bg-[#ffde21]/60" />
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-white/45">
                    {section.title}
                  </h2>
                </div>

                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] transition-all duration-200 hover:border-white/15"
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.02),transparent_60%)]" />
                    <div className="relative flex items-center justify-between gap-6 p-5">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">{item.id}</div>
                        <div className="text-sm text-white/70">{item.label}</div>
                      </div>
                      <div className="flex gap-5 flex-shrink-0">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[10px] text-white/30 uppercase tracking-wider">No está</span>
                          <button
                            onClick={() => setStatus(item.id, "red")}
                            className={`w-7 h-7 rounded-full transition-all duration-200 ${
                              scores[item.id] === "red"
                                ? "bg-red-500 scale-110 ring-2 ring-red-400/50"
                                : "bg-white/[0.06] hover:bg-red-500/60"
                            }`}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[10px] text-white/30 uppercase tracking-wider">Parcial</span>
                          <button
                            onClick={() => setStatus(item.id, "yellow")}
                            className={`w-7 h-7 rounded-full transition-all duration-200 ${
                              scores[item.id] === "yellow"
                                ? "bg-[#ffde21] scale-110 ring-2 ring-[#ffde21]/50"
                                : "bg-white/[0.06] hover:bg-[#ffde21]/60"
                            }`}
                          />
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[10px] text-white/30 uppercase tracking-wider">Sí está</span>
                          <button
                            onClick={() => setStatus(item.id, "green")}
                            className={`w-7 h-7 rounded-full transition-all duration-200 ${
                              scores[item.id] === "green"
                                ? "bg-emerald-500 scale-110 ring-2 ring-emerald-400/50"
                                : "bg-white/[0.06] hover:bg-emerald-500/60"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </>
      )}

      {/* Controls */}
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
          <div className="h-[2px] w-full bg-gradient-to-r from-[#ffde21]/20 via-[#ffde21]/40 to-[#ffde21]/20" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.04),transparent_55%)]" />

          <div className="relative border-b border-white/[0.05] px-6 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1">
                  Audit Controls
                </p>
                <h3 className="text-base font-semibold text-white">
                  Generar diagnóstico estratégico
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                  {selectedAnswersCount} respuestas
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                  {annualRevenue >= 20000 ? "Audit +20k" : "Audit -20k"}
                </span>
              </div>
            </div>
          </div>

          <div className="relative flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center">
            <button
              onClick={autoSelectRandom}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              Seleccionar respuestas al azar
            </button>
            <button
              onClick={generateAIResponse}
              disabled={loading}
              className="rounded-xl bg-[#ffde21] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe46b] disabled:opacity-50"
            >
              {loading ? "Generando…" : "Generar Diagnóstico Estratégico"}
            </button>
          </div>
        </div>

        {/* AI Loading */}
        {loading && !aiResponse && (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
            <div className="h-[2px] w-full bg-gradient-to-r from-[#ffde21]/20 via-[#ffde21]/40 to-[#ffde21]/20" />
            <AiLoading
              title="Generando diagnóstico estratégico"
              steps={[
                "Analizando respuestas del cuestionario…",
                "Identificando cuellos de botella…",
                "Evaluando el ecosistema circular…",
                "Generando recomendaciones con IA…",
                "Casi listo…",
              ]}
            />
          </div>
        )}

        {/* AI Response */}
        {aiResponse && (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
            <div className="h-[2px] w-full bg-gradient-to-r from-[#ffde21]/20 via-[#ffde21]/40 to-[#ffde21]/20" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.04),transparent_55%)]" />

            <div className="relative border-b border-white/[0.05] px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1">
                    Strategic Output
                  </p>
                  <h3 className="text-base font-semibold text-white">
                    Diagnóstico Estratégico
                  </h3>
                  <p className="mt-1.5 text-xs text-white/35 max-w-lg">
                    Una lectura ejecutiva del cuello de botella, las debilidades y la prioridad estratégica del negocio.
                  </p>
                </div>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                  {loading ? "Procesando" : "Listo"}
                </span>
              </div>
            </div>

            <div className="relative px-6 py-6">
              {aiResponse.startsWith("Diagnóstico en proceso") || aiResponse.startsWith("El diagnóstico está tardando") ? (
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-sm leading-7 text-amber-200">
                  {aiResponse}
                </div>
              ) : aiResponse.startsWith("No se pudo") || aiResponse.startsWith("Error") ? (
                <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-sm leading-7 text-red-200">
                  {aiResponse}
                </div>
              ) : (
                <div className="space-y-3">
                  {diagnosisContent}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,222,33,0.03),transparent_55%)]" />

          <div className="relative border-b border-white/[0.05] px-6 py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1">
                  Audit Archive
                </p>
                <h3 className="text-base font-semibold text-white">
                  Historial de diagnósticos
                </h3>
                <p className="mt-1 text-xs text-white/35 max-w-lg">
                  Revisá auditorías anteriores, compará estados y abrí cualquier diagnóstico guardado en un clic.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Registros</p>
                <p className="mt-0.5 text-lg font-bold text-white">
                  {loadingHistory ? "…" : diagnosisHistory.length}
                </p>
              </div>
            </div>
          </div>

          <div className="relative px-6 py-6">
            {loadingHistory ? (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-5 text-sm text-white/40">
                Cargando diagnósticos guardados…
              </div>
            ) : diagnosisHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-5 py-5 text-sm text-white/35">
                Todavía no hay diagnósticos guardados para este cliente.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {diagnosisHistory.map((item, index) => {
                  const statusMeta = getStatusMeta(item.status)
                  const isActiveDiagnosis = !!item.result && aiResponse === item.result
                  return (
                    <div
                      key={item.request_id}
                      className={`flex flex-col h-full justify-between rounded-2xl border p-5 transition-all duration-200 ${
                        isActiveDiagnosis
                          ? "border-[#ffde21]/30 bg-[#ffde21]/[0.04]"
                          : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                          #{String(diagnosisHistory.length - index).padStart(2, "0")}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${statusMeta.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClassName}`} />
                          {statusMeta.label}
                        </span>
                        <span className="ml-auto text-[10px] text-white/25 font-mono">
                          {formatDiagnosisDate(item.created_at)}
                        </span>
                      </div>

                      <div className="mb-3 text-[10px] text-white/25 font-mono break-all">
                        {item.request_id}
                      </div>

                      <div className="flex-1 flex flex-col justify-between">
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 min-h-[100px] mb-4">
                          <div className="text-xs leading-6 text-white/50 whitespace-pre-line max-h-40 overflow-y-auto">
                            {item.result
                              ? item.result
                              : item.status === "pending"
                              ? "Diagnóstico en proceso. Todavía no hay contenido final disponible."
                              : "No hay resultado almacenado para este diagnóstico."}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (item.result) {
                              setAiResponse(item.result)
                            }
                          }}
                          disabled={!item.result}
                          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all duration-150 ${
                            isActiveDiagnosis
                              ? "bg-[#ffde21] text-black"
                              : "border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {isActiveDiagnosis ? "Diagnóstico abierto" : "Ver diagnóstico completo"}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
