"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { ChevronDown, ExternalLink, Check } from "lucide-react"

// ─── Checklist data ───────────────────────────────────────────────────────────

const programData = [
  {
    month: "Mes 1 — Implementación",
    weeks: [
      {
        title: "Semana 1 - Visión y Modelo",
        tasks: [
          { label: "Completar tu Form de Onboarding - Nivel 0 Onboarding", link: "https://airtable.com" },
          { label: "Presentarte en Slack canal #general Nivel 0 Onboarding", link: "https://slack.com" },
          { label: "Guardar los días y horarios de las llamadas grupales en tu Calendario", link: "https://skool.com" },
          { label: "Separa 10 min cada lunes en tu calendario y lanza tus monday wins", link: "https://skool.com" },
          { label: "Separa 15 min en tu calendario cada mes para tus monthly report", link: "https://skool.com" },
          { label: "Pedir el libro Dollars Flow to me Easily (no hay en español pero si puedes leer en inglés es importante que lo leas) Nivel 0 Onboarding", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=0479e58fae32495ca6922040269a4faf" },
          { label: "Revisa Ann AI y guárdalo en tus GPT’s -Nivel 0 Onboarding", link: "https://chat.openai.com/g/g-695303d24ad08191955f15ba514cb456-descubre-tu-sistema-operativo-central" },
          { label: "Accede a tu plataforma de performance y familiarízate -Nivel 0 Onboarding", link: "https://skool.com" },
          { label: "Tu Actual Sistema Operativo revisa el GPT", link: "https://chatgpt.com/g/g-695303d24ad08191955f15ba514cb456-descubre-tu-sistema-operativo-central" },
          { label: "La Trampa del apalancamiento", link: "https://www.skool.com/strategy-consulting/classroom/fa0f6055?md=6a92a4c76ae54f3b8ea194c6b629d509" },
        ],
      },
      {
        title: "Semana 2",
        tasks: [
          { label: "Investigación de Mercado para definir a tu Cliente Ideal", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=5517d71b489548e6aa1ed63890d0a600" },
          { label: "Tu Simple Oferta", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=8ab64a0d4cf34a979f914fc2fd8eac62" },
          { label: "Constructor de tu Simple Oferta", link: "https://chatgpt.com/g/g-695470be71ec8191b89266dbd1948663-simple-offer-builder" },
          { label: "Tu Avatar Worksheet", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=57892d6c6c7040c6a6fd4e3f27ab38c4" },
          { label: "Tu Roadmap", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=3038e1c85d064ea3af2e30952a1c71b6" },
        ],
      },
      {
        title: "Semana 3",
        tasks: [
          { label: "Tu Offer Doc creación", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=9bfa0b4c8323478ca0436e75aa3ad902" },
          { label: "Tu Simple Video (VSL)", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=0bbae3a1de594f5b958e7affe859a652" },
          { label: "Quick Cash Menu (Elige el que mejor se adapte a tu instancia y toma feedback de Ann)", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Lanza tu Cash Sprint", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
        ],
      },
      {
        title: "Semana 4 - Comunidad Email",
        tasks: [
          { label: "Conecta tu dominio a KIT (o la plataforma que uses)", link: "" },
          { label: "Usa Google Workspace + tu email profesional", link: "" },
          { label: "Crea tu mini-curso magnet en Youtube", link: "" },
          { label: "Crear video para skool", link: "" },
        ],
      },
    ],
  },
  {
    month: "Mes 2 — Fascinación y Conexión",
    weeks: [
      {
        title: "Semana 1",
        tasks: [
          { label: "El Diamante de Autoridad", link: "" },
          { label: "Grabar Playbook Skool", link: "" },
          { label: "Tu creador inteligente y banco de ideas", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=b75b68859e534048bf6fcdec697b0457" },
          { label: "Optimizacion de Perfil BIO IG/Youtube/Linkedin", link: "" },
          { label: "Grabar Skool", link: "" },
          { label: "Tus Historias de Conversión", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=50f9815603874c5b859b0f70aac2d15a" },
        ],
      },
      {
        title: "Semana 2",
        tasks: [
          { label: "Tu Storytellink pineado en tu Ig", link: "" },
          { label: "Tu Mecanismo Único pineado en tu Ig", link: "" },
          { label: "Prueba social pineado en tu IG", link: "https://www.instagram.com/p/DHbiubtR6TT/?img_index=1" },
          { label: "Optimiza tu calendario", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=dde2660eda3e48b09383936180dd1e1b" },
          { label: "Crea 1 post al día (reel o carrousel)", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=2c6a3a66e89642188d34e5210dee125b" },
        ],
      },
      {
        title: "Tus historias de conversión",
        tasks: [
          { label: "Valores principales /aspiraciones", link: "" },
          { label: "Testimonios (screenshots o videos)", link: "" },
        ],
      },
      {
        title: "Semana 3",
        tasks: [
          { label: "DM closing to chat flow", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=a9d8934b41fd4138ab26c9fabc44322f" },
          { label: "Crea tu flow", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=5a5803ca0e294156913c67c5a2d221ad" },
          { label: "Crea tu pitch de venta si todavía tomas llamadas", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=7dd701d43d7a48209b5f061aa832abf8" },
          { label: "Revisa todo el módulo y arma tu pitch", link: "" },
          { label: "Crea tu Hot List y empieza a hablar con min 5 leads 5 estrellas al día", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=a1738fc7ca8d49a7b4ecffb313fcac3d" },
        ],
      },
      {
        title: "Semana 4",
        tasks: [
          { label: "Mapea tu Blueprint de Marca con Identidad", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=cfd8870603c54aff944465e90f275111" },
        ],
      },
    ],
  },
  {
    month: "Mes 3 — Youtube y No Negociables",
    weeks: [
      {
        title: "Semana 1",
        tasks: [
          { label: "Youtube Mastery (1 video por semana)", link: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=42479de7dc754395b7ae750d6ab6f974" },
          { label: "Elige el estilo de formato largo", link: "" },
          { label: "Elige el estilo de las miniaturas", link: "" },
        ],
      },
      {
        title: "Semana 2",
        tasks: [
          { label: "Estructura tus No Negociables diarios y semanales (trata de completarlos antes del medio día)", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=c5c75f6311a645a5867f213dde41731b" },
          { label: "Auditoría en la plataforma de performance", link: "" },
        ],
      },
    ],
  },
  {
    month: "Mes 4 — Tu DDE lanzamiento",
    weeks: [
      {
        title: "Lanzamiento",
        tasks: [
          { label: "Elige una fecha para tu workshop", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Estructura título y tema principal del workshop", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Crea la landing page del Workshop con el copy", link: "" },
          { label: "Crea la secuencia de 5 días de emails para el workshop", link: "" },
          { label: "Lanza la campaña en Ig, email y Youtube", link: "" },
          { label: "Lanza tu primer Workshop y toma data", link: "" },
        ],
      },
    ],
  },
  {
    month: "Mes 5 — Sistemas + AI",
    weeks: [
      {
        title: "Automatización y AI",
        tasks: [
          { label: "Airtable +CRM", link: "" },
          { label: "Crea tu propio Coach AI para ganar tiempo", link: "https://www.skool.com/strategy-consulting/classroom/70b44121?md=7921fc8744fe4ef08f93a16766fa2ed6" },
          { label: "Automatizando lo necesario", link: "https://www.skool.com/strategy-consulting/classroom/70b44121?md=4633193f06c64e6eb95614d4d9b511b4" },
        ],
      },
    ],
  },
  {
    month: "Mes 6 — Escalando",
    weeks: [
      {
        title: "Escalando",
        tasks: [
          { label: "Crear el Roadmap de tu Cliente", link: "" },
          { label: "Revisar tu proceso de Onboarding", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=6ab1072e74324d14b2b666f30f5a7092" },
          { label: "Priorizando tu pipeline de leads 5 estrellas", link: "" },
          { label: "Auditoría de tu Ecosistema Circular", link: "" },
          { label: "Enmarca tu Siguiente Paso para enfocarte", link: "" },
        ],
      },
    ],
  },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function ProgramChecklistView() {
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
    <div className="p-10 space-y-10 max-w-5xl mx-auto">
      <div className="space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Checklist para completar tu ecosistema circular mínimo viable
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
  )
}
