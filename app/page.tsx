"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card } from "@/components/ui/card"

export default function WelcomePage() {
  return (
    <DashboardLayout>
      <div className="p-16 max-w-6xl mx-auto space-y-20">

        {/* BIENVENIDA PRINCIPAL */}
        <div className="space-y-8">
          <h1 className="text-6xl font-bold tracking-tight text-white">
            Bienvenido a tu Sistema.
          </h1>

          <p className="text-2xl text-zinc-400 leading-relaxed max-w-4xl">
            Este no es un dashboard más. Es tu centro de decisiones.
            Acá no reaccionás. Diseñás.
          </p>

          <p className="text-lg text-zinc-500 leading-relaxed max-w-4xl">
            Cada número que ves representa una decisión tomada o postergada.
            Cada métrica es una conversación con tu negocio.
            Y cada mes que analizás con claridad es una ventaja competitiva que otros no tienen.
          </p>
        </div>

        {/* BLOQUES ESTRATÉGICOS */}
        <div className="grid md:grid-cols-3 gap-10">

          <Card className="p-10 bg-zinc-900 border-zinc-800">
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-white">
                Claridad
              </h3>
              <p className="text-zinc-400 leading-relaxed">
                Si no podés medirlo, no podés mejorarlo. La claridad elimina el caos.
                Este sistema existe para que veas lo que antes ignorabas.
              </p>
            </div>
          </Card>

          <Card className="p-10 bg-zinc-900 border-zinc-800">
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-white">
                Decisión
              </h3>
              <p className="text-zinc-400 leading-relaxed">
                Los negocios no se estancan por falta de talento.
                Se estancan por falta de decisiones estratégicas sostenidas.
              </p>
            </div>
          </Card>

          <Card className="p-10 bg-zinc-900 border-zinc-800">
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-white">
                Escalabilidad
              </h3>
              <p className="text-zinc-400 leading-relaxed">
                Escalar no es hacer más cosas.
                Es optimizar lo que ya funciona y eliminar lo que drena energía.
              </p>
            </div>
          </Card>

        </div>

        {/* MENSAJE FINAL */}
        <Card className="p-12 bg-gradient-to-r from-zinc-900 to-zinc-800 border-zinc-800">
          <div className="space-y-8">
            <h2 className="text-3xl font-semibold text-white">
              Tu negocio refleja tu nivel de estructura.
            </h2>

            <p className="text-zinc-400 leading-relaxed max-w-4xl">
              Este dashboard no está hecho para que mires números.
              Está hecho para que construyas un negocio predecible.
              Usalo con intención. Analizá con criterio.
              Y decidí como un estratega, no como un operador.
            </p>
          </div>
        </Card>

      </div>
    </DashboardLayout>
  )
}
