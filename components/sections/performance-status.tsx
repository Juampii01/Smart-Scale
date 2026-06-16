"use client"

import { Fragment } from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// "Tu Performance Status" — adaptación del flywheel status de Scale20.
// Visual estático por ahora (datos de ejemplo). El estado real por cliente se
// cablea más adelante; mientras tanto se muestra con un badge "Próximamente".
// ─────────────────────────────────────────────────────────────────────────────

type Signal = { label: string; done: boolean }
type StageState = "done" | "current" | "todo"
interface Stage {
  name:    string
  state:   StageState
  signals: Signal[]
  focus:   string[]
}

const STAGES: Stage[] = [
  {
    name: "Construyendo",
    state: "done",
    signals: [{ label: "Tracción de Oferta", done: true }, { label: "Tracción de Leads", done: true }],
    focus: ["Proceso", "Prueba", "Conversaciones"],
  },
  {
    name: "Cargado",
    state: "done",
    signals: [{ label: "Tracción de Oferta", done: true }, { label: "Tracción de Leads", done: true }],
    focus: ["Base de Email", "Crecer Audiencia", "Automatizar Leads"],
  },
  {
    name: "En marcha",
    state: "current",
    signals: [{ label: "Tracción de Oferta", done: true }, { label: "Tracción de Leads", done: true }],
    focus: ["Tiempo en Marca", "Entrega Escalable"],
  },
  {
    name: "Escalando",
    state: "todo",
    signals: [
      { label: "Tracción de Oferta", done: false },
      { label: "Tracción de Leads", done: false },
      { label: "Apalancamiento", done: false },
    ],
    focus: ["Sistemas", "IA", "Contratar Cracks"],
  },
]

const CURRENT_INDEX = STAGES.findIndex(s => s.state === "current")

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
function StageCard({ stage }: { stage: Stage }) {
  const current = stage.state === "current"
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

      {/* Señales */}
      <div className="space-y-1.5 mb-3">
        {stage.signals.map(sig => (
          <div key={sig.label} className="flex items-center gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
              sig.done ? "bg-emerald-500" : "bg-danger/70")} />
            <span className="text-[12px] text-foreground/70">{sig.label}</span>
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
  const stageNum = CURRENT_INDEX + 1
  const currentName = STAGES[CURRENT_INDEX]?.name ?? ""
  const nextName = STAGES[CURRENT_INDEX + 1]?.name ?? ""

  return (
    <div className="rounded-[14px] border border-foreground/[0.07] bg-card p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/35 mb-1">Smart Scale Progress</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[22px] font-bold text-foreground leading-tight">Tu Performance Status</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {currentName} · etapa {stageNum} de {STAGES.length}
            </span>
          </div>
          <p className="text-[13px] text-foreground/50 mt-1.5">
            <span className="text-foreground/80 font-medium">Tracción de Oferta + Tracción de Leads completadas.</span>{" "}
            Encendé la próxima señal para empezar a {nextName}.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center rounded-full border border-[#ffde21]/25 bg-[#ffde21]/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ffde21]">
          Próximamente
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="flex items-center my-6 px-1">
        {STAGES.map((s, i) => (
          <Fragment key={s.name}>
            <Node state={s.state} />
            {i < STAGES.length - 1 && (
              <span className={cn(
                "h-[2px] flex-1 mx-1.5 rounded-full",
                STAGES[i].state === "done" ? "bg-emerald-500" : "bg-foreground/10"
              )} />
            )}
          </Fragment>
        ))}
      </div>

      {/* Cards de etapas */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map(s => <StageCard key={s.name} stage={s} />)}
      </div>
    </div>
  )
}
