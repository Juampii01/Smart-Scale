"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient, useSelectedMonth } from "@/components/layout/dashboard-layout"
import { Card } from "@/components/ui/card"
import { useAnnualMetrics } from "@/contexts/annual-metrics-context"

// ─── Audit data ──────────────────────────────────────────────────────────────

const sections = [
  {
    title: "Audit del Ecosistema Circular (menos de $20k/mes) 🟠",
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
    title: "Audit del Ecosistema Circular (más de $20k/mes) 🟢",
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
          <h3 className="text-lg font-semibold uppercase tracking-[0.14em] text-zinc-200">
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
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200"
        >
          {line.replace(/^>\s+/, "")}
        </div>
      )
    }

    if (line.startsWith("- ")) {
      return (
        <div key={`bullet-${index}`} className="flex items-start gap-3 text-sm leading-7 text-zinc-300">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-white/70" />
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
      <p key={`p-${index}`} className="text-sm leading-7 text-zinc-300 md:text-[15px]">
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

  const getColor = (value: string) => {
    if (value === "red") return "bg-red-500"
    if (value === "yellow") return "bg-yellow-400"
    if (value === "green") return "bg-green-500"
    return "bg-zinc-700"
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
    <div className="p-6 space-y-8">
        <h1 className="text-3xl font-bold text-white">Auditoría Estratégica</h1>
        <Card className="border-border bg-card/70 backdrop-blur-sm">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Revenue total rolling 12 meses
              </p>
              <div className="text-3xl font-bold text-white md:text-4xl">
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
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Audit activo
              </span>
              <span
                className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold ${
                  annualRevenue >= 20000
                    ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30'
                    : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30'
                }`}
              >
                {annualRevenue >= 20000 ? 'Más de $20k' : 'Menos de $20k'}
              </span>
            </div>
          </div>
        </Card>
        {loadingAudit ? (
          <p className="text-white/60">Cargando tipo de auditoría…</p>
        ) : (
          <>
            {sections
              .filter((section, idx) =>
                (auditType === 'menos20k' && idx === 0) || (auditType === 'mas20k' && idx === 1)
              )
              .map((section) => (
                <div key={section.title} className="space-y-4">
                  <h2 className="text-xl font-semibold text-zinc-300 tracking-wide">
                    {section.title}
                  </h2>
                  {section.items.map((item) => (
                    <Card
                      key={item.id}
                      className="p-6 bg-card/70 backdrop-blur-sm border-border transition-all duration-300 hover:scale-[1.01] hover:shadow-lg"
                    >
                      <div className="flex items-center justify-between gap-6">
                        <div>
                          <div className="text-sm text-zinc-400">{item.id}</div>
                          <div className="font-medium">{item.label}</div>
                        </div>
                        <div className="flex gap-6">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-zinc-400">No está</span>
                            <button
                              onClick={() => setStatus(item.id, "red")}
                              className={`
                                w-7 h-7 rounded-full transition-all duration-200
                                ${scores[item.id] === "red" ? "bg-red-500 scale-110 ring-2 ring-red-400" : "bg-zinc-700 hover:bg-red-400"}
                              `}
                            />
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-zinc-400">Parcial</span>
                            <button
                              onClick={() => setStatus(item.id, "yellow")}
                              className={`
                                w-7 h-7 rounded-full transition-all duration-200
                                ${scores[item.id] === "yellow" ? "bg-yellow-400 scale-110 ring-2 ring-yellow-300" : "bg-zinc-700 hover:bg-yellow-400"}
                              `}
                            />
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-zinc-400">Sí está</span>
                            <button
                              onClick={() => setStatus(item.id, "green")}
                              className={`
                                w-7 h-7 rounded-full transition-all duration-200
                                ${scores[item.id] === "green" ? "bg-green-500 scale-110 ring-2 ring-green-400" : "bg-zinc-700 hover:bg-green-400"}
                              `}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ))}
          </>
        )}

        <div className="pt-10 space-y-6">
          <Card className="overflow-hidden border-border bg-card/70 backdrop-blur-sm">
            <div className="border-b border-white/10 bg-gradient-to-r from-white/10 via-white/5 to-transparent px-6 py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">
                    Audit Controls
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-white">
                    Generar diagnóstico estratégico
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-300">
                    {selectedAnswersCount} respuestas seleccionadas
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-300">
                    {annualRevenue >= 20000 ? "Audit +20k" : "Audit -20k"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 px-6 py-6 md:flex-row md:items-center">
              <button
                onClick={autoSelectRandom}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
              >
                Seleccionar respuestas al azar
              </button>
              <button
                onClick={generateAIResponse}
                className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Generando..." : "Generar Diagnóstico Estratégico"}
              </button>
            </div>
          </Card>

          {aiResponse && (
            <Card className="overflow-hidden border-border bg-card/70 shadow-[0_20px_80px_rgba(0,0,0,0.22)] backdrop-blur-sm">
              <div className="border-b border-white/10 bg-gradient-to-r from-white/10 via-white/5 to-transparent px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">
                      Strategic Output
                    </p>
                    <h3 className="mt-1 text-xl font-semibold text-white">
                      Diagnóstico Estratégico
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                      Una lectura ejecutiva del cuello de botella, las debilidades y la prioridad estratégica del negocio.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-300">
                    {loading ? "Procesando" : "Listo"}
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 md:px-8 md:py-8">
                {aiResponse.startsWith("Diagnóstico en proceso") || aiResponse.startsWith("El diagnóstico está tardando") ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-sm leading-7 text-amber-100">
                    {aiResponse}
                  </div>
                ) : aiResponse.startsWith("No se pudo") || aiResponse.startsWith("Error") ? (
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-sm leading-7 text-red-100">
                    {aiResponse}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {diagnosisContent}
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="overflow-hidden border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-sm">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_38%),linear-gradient(90deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03),transparent)] px-6 py-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-400">
                    Audit Archive
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    Historial de diagnósticos
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                    Revisá auditorías anteriores, compará estados y abrí cualquier diagnóstico guardado en un clic.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      Registros
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {loadingHistory ? "..." : diagnosisHistory.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6 md:px-7 md:py-7">
              {loadingHistory ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5 text-sm leading-7 text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  Cargando diagnósticos guardados...
                </div>
              ) : diagnosisHistory.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-5 text-sm leading-7 text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  Todavía no hay diagnósticos guardados para este cliente.
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {diagnosisHistory.map((item, index) => {
                    const statusMeta = getStatusMeta(item.status)
                    const statusCopy = getStatusCopy(item.status)
                    const isActiveDiagnosis = !!item.result && aiResponse === item.result
                    return (
                      <div
                        key={item.request_id}
                        className={`group flex flex-col h-full justify-between rounded-3xl border-2 p-6 shadow-lg transition-all duration-300 ${
                          isActiveDiagnosis
                            ? "border-emerald-400/40 bg-gradient-to-br from-emerald-900/30 to-black/60 shadow-emerald-900/30"
                            : "border-white/10 bg-gradient-to-br from-zinc-900/40 to-black/60 hover:border-emerald-400/30 hover:shadow-emerald-900/10"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                            #{String(diagnosisHistory.length - index).padStart(2, "0")}
                          </span>
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusMeta.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClassName}`} />
                            {statusMeta.label}
                          </span>
                          <span className="ml-auto text-xs text-zinc-500 font-mono">
                            {formatDiagnosisDate(item.created_at)}
                          </span>
                        </div>
                        <div className="mb-3 min-h-[48px] text-xs text-zinc-400 flex items-center gap-2">
                          <span className="font-semibold text-zinc-300">Request ID:</span>
                          <span className="break-all font-mono">{item.request_id}</span>
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 shadow-inner min-h-[120px] mb-4">
                            <div className="text-sm leading-7 text-zinc-200 whitespace-pre-line max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-700/40 scrollbar-track-transparent">
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
                            className={`mt-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all duration-200 tracking-wide shadow ${
                              isActiveDiagnosis
                                ? "border-emerald-400 bg-emerald-400/90 text-black hover:bg-emerald-400"
                                : "border-white/10 bg-white/[0.04] text-white hover:border-emerald-400/40 hover:bg-emerald-400/10"
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
          </Card>
        </div>
    </div>
  )
}
