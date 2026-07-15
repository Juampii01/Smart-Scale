"use client"

import { Check, Sparkles, Repeat, Crown } from "lucide-react"

// ─── Ofertas ──────────────────────────────────────────────────────────────────
// priceMonthly: null → no se muestra la línea mensual. Cuando tengas los valores
// mensuales, reemplazá null por el texto (ej: "USD 800").
interface Offer {
  id: string
  badge: string
  icon: React.ElementType
  title: string
  tagline: string
  priceTotal: string        // pago único (ej: "USD 2.000")
  priceMonthly: string | null  // por mes (ej: "USD 800") — null = no mostrar
  highlight: boolean
  features: string[]
  footnote?: string
}

const OFFERS: Offer[] = [
  {
    id: "renovacion-sin",
    badge: "Renovación",
    icon: Repeat,
    title: "Renovación sin llamada",
    tagline: "Seguí con todo el ecosistema grupal del programa.",
    priceTotal: "USD 2.000",
    priceMonthly: "USD 497",
    highlight: false,
    features: [
      "Llamada semanal de Lab / Workshop",
      "Llamada quincenal de Automatizaciones y Sistemas",
      "Llamada mensual de Mentalidad",
      "Acceso completo a la comunidad y recursos",
    ],
  },
  {
    id: "scaleup",
    badge: "Máximo nivel · 1:1",
    icon: Crown,
    title: "ScaleUp",
    tagline: "Acompañamiento 1:1 directo + trabajo profundo sobre tu negocio.",
    priceTotal: "USD 12.000",
    priceMonthly: "USD 2.500",
    highlight: true,
    features: [
      "Soporte 1:1 con Ann por WhatsApp y llamadas",
      "Llamada semanal 1-1 con Ann",
      "Seguimiento constante de números y trackers semanales",
      "Trabajo profundo del backend: procesos, delivery, clientes y escalado con ads",
      "Todo el ecosistema grupal (Lab, Automatizaciones, Mentalidad y comunidad)",
    ],
    footnote: "El nivel más alto de acompañamiento del programa.",
  },
  {
    id: "renovacion-con",
    badge: "Renovación + 1:1",
    icon: Repeat,
    title: "Renovación con llamada",
    tagline: "El ecosistema grupal + soporte 1:1 con Ann.",
    priceTotal: "USD 5.000",
    priceMonthly: "USD 1.000",
    highlight: false,
    features: [
      "Llamada 1-1 mensual con Ann",
      "Llamada semanal de Lab / Workshop",
      "Llamada quincenal de Automatizaciones y Sistemas",
      "Llamada mensual de Mentalidad",
      "Acceso completo a la comunidad y recursos",
    ],
  },
]

export function RenovacionView() {
  return (
    <div className="mx-auto max-w-5xl pb-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[#dafc69]" />
          Próximo nivel
        </h1>
        <p className="text-sm text-foreground/50 mt-1.5 max-w-2xl">
          Tu programa puede seguir creciendo. Estas son las formas de continuar el acompañamiento
          y llevar tu negocio al siguiente nivel.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-5 lg:grid-cols-3 items-start">
        {OFFERS.map((o) => {
          const Icon = o.icon
          return (
            <div
              key={o.id}
              className="relative flex flex-col rounded-[14px] border bg-card p-6 transition-all"
              style={{
                borderColor: o.highlight ? "#dafc69" : "var(--border)",
                boxShadow: o.highlight ? "0 0 0 1px #dafc69, 0 8px 32px -8px rgba(255,222,33,0.25)" : undefined,
              }}
            >
              {o.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-[#dafc69] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
                  Recomendado
                </span>
              )}

              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: o.highlight ? "#dafc69" : "var(--muted)" }}
                >
                  <Icon className="h-4.5 w-4.5" style={{ color: o.highlight ? "#000" : "var(--muted-foreground)" }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">{o.badge}</span>
              </div>

              <h2 className="text-lg font-bold text-foreground leading-tight">{o.title}</h2>
              <p className="text-[13px] text-foreground/55 mt-1.5 leading-relaxed">{o.tagline}</p>

              {/* Precio */}
              <div className="mt-4 mb-4 border-y border-foreground/[0.06] py-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-foreground">{o.priceTotal}</span>
                  <span className="text-[11px] font-medium text-foreground/45">pago único</span>
                </div>
                {o.priceMonthly && (
                  <p className="text-[12.5px] text-foreground/60 mt-1">
                    o <span className="font-semibold text-foreground">{o.priceMonthly}</span>/mes
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2.5 flex-1">
                {o.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground/80 leading-snug">
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: o.highlight ? "color-mix(in srgb, #dafc69 25%, transparent)" : "var(--muted)" }}
                    >
                      <Check className="h-2.5 w-2.5" style={{ color: o.highlight ? "#9a7d00" : "var(--foreground)" }} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {o.footnote && (
                <p className="mt-4 pt-4 border-t border-foreground/[0.06] text-[11.5px] italic text-foreground/40">
                  {o.footnote}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Nota al pie */}
      <p className="mt-8 text-center text-[13px] text-foreground/45">
        ¿Querés sumarte a alguno de estos planes? Hablalo directamente con Ann y lo coordinamos. 🚀
      </p>
    </div>
  )
}
