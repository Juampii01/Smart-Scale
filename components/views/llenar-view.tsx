"use client"

import { useState } from "react"
import { Trophy, DollarSign, FileBarChart, ArrowLeft } from "lucide-react"
import { MondayWinView } from "@/components/views/monday-win-view"
import { ChiChangView } from "@/components/views/chi-chang-view"
import { ReportInputView } from "@/components/views/report-input-view"

type Choice = "monday-win" | "cha-ching" | "reporte" | null

const OPTIONS = [
  {
    id: "monday-win" as const,
    icon: Trophy,
    title: "Monday Win",
    desc: "Tus logros de la semana, tu foco y el bloqueo principal.",
    color: "#F59E0B",
  },
  {
    id: "cha-ching" as const,
    icon: DollarSign,
    title: "Cha-Ching 💰",
    desc: "Registrá una venta cerrada: valor del trato y cash collected.",
    color: "#22C55E",
  },
  {
    id: "reporte" as const,
    icon: FileBarChart,
    title: "Reporte Mensual",
    desc: "Tus métricas del mes: revenue, contenido, email y reflexiones.",
    color: "#5B8DEF",
  },
]

export function LlenarView() {
  const [choice, setChoice] = useState<Choice>(null)

  // Vista de carga seleccionada
  if (choice) {
    return (
      <div>
        <button
          onClick={() => setChoice(null)}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/50 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a elegir
        </button>
        {choice === "monday-win" && <MondayWinView />}
        {choice === "cha-ching"  && <ChiChangView />}
        {choice === "reporte"    && <ReportInputView />}
      </div>
    )
  }

  // Selector
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <FileBarChart className="h-6 w-6 text-[#ffde21]" />
          Llenar reporte
        </h1>
        <p className="text-sm text-foreground/50 mt-1.5">¿Qué querés cargar hoy?</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {OPTIONS.map((o) => {
          const Icon = o.icon
          return (
            <button
              key={o.id}
              onClick={() => setChoice(o.id)}
              className="group flex flex-col items-start gap-3 rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)]"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                style={{ backgroundColor: `color-mix(in srgb, ${o.color} 15%, transparent)` }}
              >
                <Icon className="h-5 w-5" style={{ color: o.color }} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-foreground">{o.title}</h2>
                <p className="text-[12.5px] text-foreground/50 mt-1 leading-relaxed">{o.desc}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
