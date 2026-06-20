"use client"

import { Fragment, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { useMonthlyReports, type MonthlyReport } from "@/hooks/use-monthly-reports"
import { useSelectedMonth } from "@/components/layout/dashboard-layout"
import { Sk } from "@/components/ui/skeleton"

// ─────────────────────────────────────────────────────────────────────────────
// "Tu Performance Status" — adaptación del flywheel status de Scale20.
// Estado real por cliente calculado con el reporte mensual (Ecosistema Circular):
//   Tracción de Oferta = 10+ ventas (new_clients acumulado) Y 5+ casos de éxito
//   Tracción de Leads  = 300+ nuevos email subs en el mes
//   Apalancamiento     = 30+ consultas inbound en el mes
// ─────────────────────────────────────────────────────────────────────────────

const SALES_GOAL   = 10
const CASES_GOAL   = 5
const LEADS_GOAL   = 300
const INBOUND_GOAL = 30

type SignalKey = "oferta" | "leads" | "apalancamiento"
type StageState = "done" | "current" | "todo"

interface Stage {
  name:    string
  signals: SignalKey[]
  focus:   string[]
}

// El índice de cada etapa coincide con cuántas señales encendidas hacen falta.
const STAGES: Stage[] = [
  { name: "Construyendo", signals: ["oferta", "leads"],                    focus: ["Proceso", "Prueba", "Conversaciones"] },
  { name: "Cargado",      signals: ["oferta", "leads"],                    focus: ["Base de Email", "Crecer Audiencia", "Automatizar Leads"] },
  { name: "En marcha",    signals: ["oferta", "leads"],                    focus: ["Tiempo en Marca", "Entrega Escalable"] },
  { name: "Escalando",    signals: ["oferta", "leads", "apalancamiento"],  focus: ["Sistemas", "IA", "Contratar Cracks"] },
]

const SIGNAL_LABEL: Record<SignalKey, string> = {
  oferta:         "Tracción de Oferta",
  leads:          "Tracción de Leads",
  apalancamiento: "Apalancamiento",
}

function computeStatus(reports: MonthlyReport[], cur: MonthlyReport | null) {
  const sales = reports.reduce((s, r) => s + (r.new_clients || 0), 0)
  const cases = reports.reduce((m, r) => Math.max(m, r.case_studies || 0), 0)
  const emailNew = cur?.email_new_subscribers ?? 0
  const inbound  = cur?.inbound_messages ?? 0

  const met: Record<SignalKey, boolean> = {
    oferta:         sales >= SALES_GOAL && cases >= CASES_GOAL,
    leads:          emailNew >= LEADS_GOAL,
    apalancamiento: inbound >= INBOUND_GOAL,
  }
  const detail: Record<SignalKey, string> = {
    oferta:         `${sales}/${SALES_GOAL} ventas · ${cases}/${CASES_GOAL} casos`,
    leads:          `${emailNew}/${LEADS_GOAL} nuevos email este mes`,
    apalancamiento: `${inbound}/${INBOUND_GOAL} consultas inbound este mes`,
  }

  // Etapa alcanzada: gate secuencial por señal.
  const reached = !met.oferta ? 0 : !met.leads ? 1 : !met.apalancamiento ? 2 : 3
  return { met, detail, reached }
}

// ── Nodo del progreso ─────────────────────────────────────────────────────────
function Node({ state }: { state: StageState }) {
  if (state === "done") return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <Check className="h-4 w-4" strokeWidth={3} />
    </span>
  )
  if (state === "current") return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500/15">
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  )
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-foreground/15">
      <span className="h-2 w-2 rounded-full bg-foreground/15" />
    </span>
  )
}

// ── Card de etapa ─────────────────────────────────────────────────────────────
function StageCard({ stage, state, met, detail }: {
  stage: Stage; state: StageState; met: Record<SignalKey, boolean>; detail: Record<SignalKey, string>
}) {
  const current = state === "current"
  return (
    <div className={cn(
      "rounded-[14px] border p-4 transition-colors",
      current
        ? "border-emerald-500/40 bg-emerald-500/[0.05]"
        : "border-foreground/[0.07] bg-foreground/[0.02]"
    )}>
      <div className="flex items-center justify-between mb-3">
        <p className={cn("text-[14px] font-bold", current ? "text-emerald-700 dark:text-emerald-300" : "text-foreground")}>
          {stage.name}
        </p>
        <div className="flex gap-1">
          {stage.signals.map((_, i) => (
            <span key={i} className={cn("h-1.5 w-1.5 rounded-full", current ? "bg-emerald-500/70" : "bg-foreground/20")} />
          ))}
        </div>
      </div>

      {/* Señales — el punto refleja si la señal está realmente encendida */}
      <div className="space-y-1.5 mb-3">
        {stage.signals.map(key => (
          <div key={key} className="flex items-center gap-2" title={detail[key]}>
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", met[key] ? "bg-emerald-500" : "bg-danger/70")} />
            <span className="text-[12px] text-foreground/70">{SIGNAL_LABEL[key]}</span>
          </div>
        ))}
      </div>

      {/* Foco */}
      <div className="pt-3 border-t border-foreground/[0.06]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/35 mb-2">Foco</p>
        <div className="flex flex-wrap gap-1.5">
          {stage.focus.map(f => (
            <span key={f} className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-medium",
              current
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-foreground/[0.05] text-foreground/50"
            )}>
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PerformanceStatus() {
  const { reports, loading } = useMonthlyReports()
  const selectedMonth = useSelectedMonth()

  const cur = useMemo(() => {
    if (reports.length === 0) return null
    const m = String(selectedMonth ?? "")
    const month = /^\d{4}-\d{2}/.test(m) ? m.slice(0, 7) : reports[reports.length - 1].month
    return reports.find(r => r.month === month) ?? reports[reports.length - 1]
  }, [reports, selectedMonth])

  const { met, detail, reached } = useMemo(() => computeStatus(reports, cur), [reports, cur])

  if (loading) {
    return <Sk className="h-[360px] rounded-[14px]" />
  }

  const hasData = reports.length > 0
  const currentName = STAGES[reached].name
  const nextName    = STAGES[reached + 1]?.name ?? null

  const subtitle = !hasData
    ? "Cargá tu reporte mensual para ver en qué etapa de tu Ecosistema estás."
    : reached === 0 ? "Conseguí 10+ ventas y 5+ casos de éxito para encender la Tracción de Oferta."
    : reached === 1 ? "Tracción de Oferta lista. Llegá a 300 nuevos emails en el mes para pasar a En marcha."
    : reached === 2 ? "Oferta + Leads encendidas. Sumá 30 consultas inbound en el mes para empezar a Escalar."
    : "Las tres señales encendidas — estás en la etapa de apalancamiento. 🚀"

  return (
    <div className="rounded-[14px] border border-foreground/[0.07] bg-card p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/35 mb-1">Smart Scale Progress</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[22px] font-bold text-foreground leading-tight">Tu Performance Status</h2>
            {hasData && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {currentName} · etapa {reached + 1} de {STAGES.length}
              </span>
            )}
          </div>
          <p className="text-[13px] text-foreground/50 mt-1.5">{subtitle}</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="flex items-center my-6 px-1">
        {STAGES.map((s, i) => {
          const state: StageState = i < reached ? "done" : i === reached ? "current" : "todo"
          return (
            <Fragment key={s.name}>
              <Node state={state} />
              {i < STAGES.length - 1 && (
                <span className={cn(
                  "h-[2px] flex-1 mx-1.5 rounded-full",
                  i < reached ? "bg-emerald-500" : "bg-foreground/10"
                )} />
              )}
            </Fragment>
          )
        })}
      </div>

      {/* Cards de etapas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s, i) => (
          <StageCard
            key={s.name}
            stage={s}
            state={i < reached ? "done" : i === reached ? "current" : "todo"}
            met={met}
            detail={detail}
          />
        ))}
      </div>
    </div>
  )
}
