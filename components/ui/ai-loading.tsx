"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

interface AiLoadingProps {
  steps?: string[]
  title?: string
}

const DEFAULT_STEPS = [
  "Conectando con la fuente…",
  "Obteniendo métricas…",
  "Transcribiendo audio…",
  "Generando análisis con IA…",
  "Casi listo…",
]

export function AiLoading({ steps = DEFAULT_STEPS, title = "Investigando contenido" }: AiLoadingProps) {
  const [stepIdx, setStepIdx] = useState(0)
  const [dots, setDots] = useState("")

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStepIdx(i => (i + 1) % steps.length)
    }, 2800)
    return () => clearInterval(stepTimer)
  }, [steps.length])

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots(d => d.length >= 3 ? "" : d + ".")
    }, 400)
    return () => clearInterval(dotTimer)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center space-y-6">
      {/* Rings animation */}
      <div className="relative flex items-center justify-center">
        <span className="absolute h-16 w-16 rounded-full border border-[#ffde21]/10 animate-ping" style={{ animationDuration: "2s" }} />
        <span className="absolute h-12 w-12 rounded-full border border-[#ffde21]/20 animate-ping" style={{ animationDuration: "1.5s", animationDelay: "0.3s" }} />
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#ffde21]/30 bg-[#ffde21]/[0.06]">
          <Sparkles className="h-5 w-5 text-[#ffde21]" />
        </span>
      </div>

      {/* Title */}
      <div>
        <p className="text-sm font-semibold text-white/80">{title}</p>
        <p className="text-xs text-white/30 mt-1">Puede tardar 1-2 minutos</p>
      </div>

      {/* Step indicator */}
      <div className="w-full max-w-xs space-y-2">
        {steps.map((step, i) => {
          const isPast = i < stepIdx
          const isCurrent = i === stepIdx
          return (
            <div
              key={step}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-500 ${
                isCurrent ? "bg-[#ffde21]/[0.07] border border-[#ffde21]/20" :
                isPast    ? "opacity-40" : "opacity-20"
              }`}
            >
              <span className={`flex h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                isCurrent ? "bg-[#ffde21] animate-pulse" :
                isPast    ? "bg-white/40" : "bg-white/15"
              }`} />
              <p className={`text-xs ${isCurrent ? "text-white/80" : "text-white/40"}`}>
                {isCurrent ? `${step}${dots}` : step}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Compact inline version for buttons/smaller areas
export function AiLoadingInline({ label = "Procesando" }: { label?: string }) {
  const [dots, setDots] = useState("")

  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 400)
    return () => clearInterval(t)
  }, [])

  return (
    <span className="inline-flex items-center gap-2 text-sm text-white/60">
      <Sparkles className="h-3.5 w-3.5 text-[#ffde21] animate-pulse" />
      {label}{dots}
    </span>
  )
}
