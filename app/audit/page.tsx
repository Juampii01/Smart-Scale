"use client"

import { useState } from "react"
import { DashboardLayout } from "../../components/dashboard-layout"
import { Card } from "../../components/ui/card"

const sections = [
  {
    title: "ATRACCIÓN Y POSICIONAMIENTO",
    items: [
      { id: "F1", label: "Atraigo nuevos seguidores calificados todos los días" },
      { id: "F2", label: "Tengo claridad absoluta sobre qué publicar para crecer y convertir" },
      { id: "F3", label: "Genero al menos 5 conversaciones calificadas por día sin depender de ads" },
    ],
  },
  {
    title: "AUTORIDAD Y SISTEMA",
    items: [
      { id: "E1", label: "Envío mínimo un email estratégico por semana" },
      { id: "E2", label: "Mido leads, conversaciones, pagos y progreso con sistema claro" },
      { id: "E3", label: "Solo invierto tiempo en prospectos 4-5★ altamente calificados" },
    ],
  },
  {
    title: "CONVERSIÓN Y CIERRE",
    items: [
      { id: "I1", label: "Mis clientes consiguen su primer gran resultado en los primeros 30 días" },
      { id: "I2", label: "Mi onboarding genera claridad y dirección inmediata" },
      { id: "I3", label: "Puedo duplicar clientes sin perder calidad ni quemarme" },
    ],
  },
  {
    title: "OFERTA Y ESCALABILIDAD",
    items: [
      { id: "T1", label: "Mi oferta resuelve un dolor profundo que el mercado ya reconoce" },
      { id: "T2", label: "Tengo 5+ casos de estudio sólidos que prueban mi transformación" },
      { id: "T3", label: "Tengo una oferta principal clara y posicionada por encima de $3k" },
    ],
  },
]

export default function AuditPage() {
  const [scores, setScores] = useState<Record<string, string>>({})
  const [aiResponse, setAiResponse] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const setStatus = (id: string, value: string) => {
    setScores((prev) => {
      // If the same value is clicked again, deselect it
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
    const answers = Object.entries(scores)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")

    return `
Actúa como estratega de negocios digitales high-ticket.

Este es el resultado de una auditoría estratégica:

${answers}

En base a esto:
1) Detecta las áreas más débiles.
2) Explica el impacto estratégico de esas debilidades.
3) Prioriza qué debería corregirse primero.
4) Da un plan de acción claro en 3 pasos.

Responde en tono firme, estratégico y directo.
No uses relleno.
`
  }

  const generateAIResponse = async () => {
    setLoading(true)
    try {
      const prompt = buildPrompt()

      const res = await fetch("/api/ai-diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })

      const data = await res.json()
      setAiResponse(data.response || "No se pudo generar el diagnóstico.")
    } catch (err) {
      setAiResponse("Error generando diagnóstico.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        <h1 className="text-3xl font-bold">Auditoría Estratégica del Flywheel</h1>

        {sections.map((section) => (
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

        <div className="pt-10 space-y-6">
          <button
            onClick={generateAIResponse}
            className="px-6 py-3 bg-white text-black rounded-lg font-semibold hover:opacity-90 transition"
          >
            {loading ? "Generando..." : "Generar Diagnóstico Estratégico"}
          </button>

          {aiResponse && (
            <Card className="p-6 bg-card/70 backdrop-blur-sm border-border">
              <h3 className="text-lg font-semibold mb-4">Diagnóstico Estratégico</h3>
              <p className="whitespace-pre-line text-zinc-300">
                {aiResponse}
              </p>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
