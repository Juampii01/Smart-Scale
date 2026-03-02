"use client";

import { useState, useEffect } from "react"
import { DashboardLayout } from "../../components/dashboard-layout"
import { Card } from "../../components/ui/card"
import { ChevronDown, ExternalLink, Check } from "lucide-react"

const programData = [
  {
    month: "Mes 1 — Orientación, Visión y Modelo",
    weeks: [
      {
        title: "Semana 1 — Bienvenida y Orientación",
        tasks: [
          { label: "Completar formulario de onboarding", link: "https://airtable.com" },
          { label: "Presentación en el canal #general", link: "https://slack.com" },
          { label: "Iniciar Auditoría de 7 días", link: "https://skool.com" },
          { label: "Flujo de dinero ordenado (Mentalidad Financiera)", link: "https://skool.com" },
          { label: "POSI - Nivel 0 - Comenzar aquí", link: "https://skool.com" },
        ],
      },
      {
        title: "Semana 2 — Estudio del Tiempo",
        tasks: [
          { label: "Completar Auditoría de 7 días + Feedback", link: "https://skool.com" },
          { label: "Ann IA Personalizada", link: "https://skool.com" },
          { label: "Acceso a Smart Scale (Portal de Performance)", link: "https://app.scale20.com" },
          { label: "Sistema Operativo Central GPT", link: "https://chatgpt.com" },
        ],
      },
    ],
  },
]

export default function ProgramChecklistPage() {
    useEffect(() => {
      document.title = "Smart Scale";
    }, []);
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({})
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [justCompleted, setJustCompleted] = useState<string | null>(null)

  // Cargar progreso guardado
  useEffect(() => {
    const savedCompleted = localStorage.getItem("program-checklist-completed")
    const savedOpenWeeks = localStorage.getItem("program-checklist-openWeeks")

    if (savedCompleted) {
      setCompleted(JSON.parse(savedCompleted))
    }

    if (savedOpenWeeks) {
      setOpenWeeks(JSON.parse(savedOpenWeeks))
    }
  }, [])

  // Guardar progreso automáticamente
  useEffect(() => {
    localStorage.setItem(
      "program-checklist-completed",
      JSON.stringify(completed)
    )
  }, [completed])

  useEffect(() => {
    localStorage.setItem(
      "program-checklist-openWeeks",
      JSON.stringify(openWeeks)
    )
  }, [openWeeks])

  const toggleWeek = (key: string) => {
    setOpenWeeks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleTask = (key: string) => {
    setCompleted((prev) => {
      const newState = { ...prev, [key]: !prev[key] }

      if (!prev[key]) {
        setJustCompleted(key)
        setTimeout(() => setJustCompleted(null), 400)
      }

      return newState
    })
  }

  const totalTasks = programData.flatMap((m) =>
    m.weeks.flatMap((w) => w.tasks)
  ).length

  const completedCount = Object.values(completed).filter(Boolean).length

  const progress = totalTasks
    ? Math.round((completedCount / totalTasks) * 100)
    : 0

  return (
    <DashboardLayout>
      <div className="p-10 space-y-10 max-w-5xl mx-auto">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Ruta del Programa
          </h1>

          <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden shadow-inner">
            <div
              className="h-4 bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-sm text-zinc-400">
            {completedCount}/{totalTasks} tareas completadas — {progress}% progreso
          </p>
        </div>

        {programData.map((month) => (
          <div key={month.month} className="space-y-8">
            <Card className="p-8 bg-gradient-to-r from-zinc-900 to-zinc-800 border-zinc-700 shadow-xl">
              <h2 className="text-2xl font-semibold text-white">
                {month.month}
              </h2>
            </Card>

            {month.weeks.map((week) => {
              const weekKey = week.title
              return (
                <div key={week.title} className="space-y-4">
                  <div
                    onClick={() => toggleWeek(weekKey)}
                    className="flex items-center justify-between cursor-pointer px-6 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition border border-zinc-700"
                  >
                    <span className="font-medium text-white">
                      {week.title}
                    </span>
                    <ChevronDown
                      className={`transition-transform text-white ${
                        openWeeks[weekKey] ? "rotate-180" : ""
                      }`}
                    />
                  </div>

                  {openWeeks[weekKey] && (
                    <div className="space-y-4 pl-6">
                      {week.tasks.map((task) => {
                        const taskKey = week.title + task.label
                        const isDone = completed[taskKey]

                        return (
                          <Card
                            key={task.label}
                            className={`p-5 rounded-xl transition-all duration-300 border transform ${
                              isDone
                                ? "bg-emerald-900/30 border-emerald-600"
                                : "bg-zinc-900 border-zinc-700 hover:border-emerald-500"
                            } ${justCompleted === taskKey ? "scale-105" : "scale-100"}`}
                            onClick={() => toggleTask(taskKey)}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex flex-col gap-2">
                                <span
                                  className={`text-white ${
                                    isDone ? "line-through opacity-60" : ""
                                  }`}
                                >
                                  {task.label}
                                </span>
                                <a
                                  href={task.link}
                                  target="_blank"
                                  className="text-xs text-emerald-400 flex items-center gap-1 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Ir al recurso <ExternalLink size={12} />
                                </a>
                              </div>

                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                                  isDone
                                    ? "bg-emerald-500 shadow-lg animate-pulse"
                                    : "bg-zinc-700"
                                }`}
                              >
                                {isDone && <Check size={14} className="text-black" />}
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </DashboardLayout>
  )
}
