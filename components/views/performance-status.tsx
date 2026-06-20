"use client"

import { Check, X, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MonthlyReport } from "@/hooks/use-monthly-reports"

// ─── Umbrales (Ecosistema Circular MVP) ────────────────────────────────────────
// Tracción de Oferta = 10+ ventas full-price del core offer Y 5+ casos de éxito.
// Tracción de Leads   = 300+ nuevos email subs en el mes.
// Apalancamiento      = 30+ consultas inbound en el mes.
const SALES_GOAL    = 10
const CASES_GOAL    = 5
const LEADS_GOAL    = 300
const INBOUND_GOAL  = 30

type StateId = "construyendo" | "cargado" | "girando" | "compuesto"

const STATES: Record<StateId, {
  emoji: string; name: string; dots: string; focus: string
  accent: string; soft: string; ring: string
}> = {
  construyendo: {
    emoji: "🛠️", name: "Construyendo", dots: "🔴🔴",
    focus: "Proceso + Prueba + Conversaciones",
    accent: "text-foreground/70", soft: "bg-foreground/[0.05]", ring: "ring-foreground/10",
  },
  cargado: {
    emoji: "🔄", name: "Cargado", dots: "🟢🔴",
    focus: "Base de Email + Crecimiento de Audiencia + Automatización de Leads",
    accent: "text-amber-600 dark:text-amber-400", soft: "bg-amber-100 dark:bg-amber-500/10", ring: "ring-amber-400/30",
  },
  girando: {
    emoji: "🌀", name: "Girando", dots: "🟢🟢",
    focus: "Tiempo en Marca + Entrega Escalable",
    accent: "text-emerald-700 dark:text-emerald-400", soft: "bg-emerald-100 dark:bg-emerald-500/10", ring: "ring-emerald-400/30",
  },
  compuesto: {
    emoji: "📈", name: "Compuesto", dots: "🟢🟢🟢",
    focus: "Sistemas + IA + Contratación de A-Players",
    accent: "text-[#ffde21]", soft: "bg-[#ffde21]/[0.08]", ring: "ring-[#ffde21]/30",
  },
}

function computeSignals(reports: MonthlyReport[], cur: MonthlyReport | null) {
  // Oferta: acumulado histórico (ventas + casos de éxito documentados)
  const sales = reports.reduce((s, r) => s + (r.new_clients || 0), 0)
  const cases = reports.reduce((m, r) => Math.max(m, r.case_studies || 0), 0)
  const offerTraction = sales >= SALES_GOAL && cases >= CASES_GOAL

  // Leads + apalancamiento: totales del mes seleccionado
  const emailNew = cur?.email_new_subscribers ?? 0
  const inbound  = cur?.inbound_messages ?? 0
  const leadTraction = emailNew >= LEADS_GOAL
  const leverage     = inbound >= INBOUND_GOAL

  const state: StateId =
    !offerTraction ? "construyendo"
    : !leadTraction ? "cargado"
    : !leverage     ? "girando"
    : "compuesto"

  return { sales, cases, emailNew, inbound, offerTraction, leadTraction, leverage, state }
}

// ─── Signal row ─────────────────────────────────────────────────────────────────

function SignalRow({ met, label, detail, why }: {
  met: boolean; label: string; detail: string; why?: string
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className={cn(
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
        met ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
            : "bg-foreground/[0.06] text-foreground/35"
      )}>
        {met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className={cn("text-[13.5px] font-semibold", met ? "text-foreground" : "text-foreground/55")}>{label}</p>
          <p className={cn("text-[12px] font-semibold tabular-nums shrink-0", met ? "text-emerald-700 dark:text-emerald-400" : "text-foreground/40")}>{detail}</p>
        </div>
        {why && <p className="text-[11.5px] text-foreground/40 mt-0.5 leading-snug">{why}</p>}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PerformanceStatus({ reports, cur }: { reports: MonthlyReport[]; cur: MonthlyReport | null }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-[14px] border border-foreground/[0.07] bg-card px-5 py-8 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/35 mb-1">Tu Performance Status</p>
        <p className="text-[13px] text-foreground/45 flex items-center justify-center gap-1.5">
          <Minus className="h-3.5 w-3.5" /> Cargá tu reporte mensual para ver tu estado
        </p>
      </div>
    )
  }

  const s = computeSignals(reports, cur)
  const st = STATES[s.state]
  const steps: StateId[] = ["construyendo", "cargado", "girando", "compuesto"]
  const reachedIdx = steps.indexOf(s.state)

  return (
    <div className={cn("rounded-[14px] border border-foreground/[0.07] bg-card overflow-hidden ring-1", st.ring)}>
      {/* Hero */}
      <div className={cn("px-5 py-5 sm:px-6", st.soft)}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/40 mb-2">Tu Performance Status</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[34px] leading-none" aria-hidden>{st.emoji}</span>
            <div>
              <h2 className={cn("text-[24px] font-extrabold leading-none tracking-tight", st.accent)}>{st.name}</h2>
              <p className="text-[12px] text-foreground/45 mt-1">
                Enfoque: <span className="text-foreground/70 font-medium">{st.focus}</span>
              </p>
            </div>
          </div>
          {/* Stepper de etapas */}
          <div className="flex items-center gap-1.5">
            {steps.map((step, i) => (
              <span
                key={step}
                title={STATES[step].name}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i <= reachedIdx ? "w-7 bg-[#ffde21]" : "w-3.5 bg-foreground/15"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Señales */}
      <div className="px-5 sm:px-6 py-1 divide-y divide-foreground/[0.05]">
        <SignalRow
          met={s.offerTraction}
          label="Tracción de Oferta"
          detail={`${s.sales}/${SALES_GOAL} ventas · ${s.cases}/${CASES_GOAL} casos`}
          why="10+ ventas full-price del core offer + 5+ casos de éxito documentados (acumulado)."
        />
        <SignalRow
          met={s.leadTraction}
          label="Tracción de Leads"
          detail={`${s.emailNew}/${LEADS_GOAL} este mes`}
          why="300+ nuevos suscriptores de email en el mes (10/día)."
        />
        <SignalRow
          met={s.leverage}
          label="Apalancamiento"
          detail={`${s.inbound}/${INBOUND_GOAL} este mes`}
          why="30+ consultas inbound en el mes (1/día)."
        />
      </div>
    </div>
  )
}
