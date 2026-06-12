"use client"

import { Check, Sparkles, Repeat, Crown } from "lucide-react"

// ─── Ofertas ──────────────────────────────────────────────────────────────────
// price: null → muestra "Consultá el valor con Ann". Cuando tengas los precios,
// reemplazá null por el texto (ej: "USD 500/mes").
interface Offer {
  id: string
  badge: string
  icon: React.ElementType
  title: string
  tagline: string
  price: string | null
  highlight: boolean
  features: string[]
  footnote?: string
}

const OFFERS: Offer[] = [
  {
    id: "scaleup",
    badge: "Upsell · 1:1",
    icon: Crown,
    title: "ScaleUp",
    tagline: "Acompañamiento mucho más directo y estratégico.",
    price: null,
    highlight: true,
    features: [
      "Soporte 1:1 con Ann vía WhatsApp y llamadas",
      "Seguimiento constante de números y trackers semanales",
      "Trabajo profundo sobre el backend del negocio: procesos, delivery, clientes y escalado con ads",
      "Llamada 1-1 mensual con Ann",
      "Llamada semanal de Lab / Workshop",
      "Llamada quincenal de Automatizaciones y Sistemas",
      "Llamada mensual de Mentalidad",
      "Acceso completo a la comunidad y recursos",
    ],
    footnote: "El nivel más alto de acompañamiento del programa.",
  },
  {
    id: "renovacion-1a1",
    badge: "Renovación",
    icon: Repeat,
    title: "Renovación con 1-1 mensual",
    tagline: "Seguí con todo el ecosistema + tu llamada privada mensual.",
    price: null,
    highlight: false,
    features: [
      "Llamada 1-1 mensual con Ann",
      "Llamada semanal de Lab / Workshop",
      "Llamada quincenal de Automatizaciones y Sistemas",
      "Llamada mensual de Mentalidad",
      "Acceso completo a la comunidad y recursos",
    ],
  },
  {
    id: "renovacion-grupal",
    badge: "Renovación",
    icon: Repeat,
    title: "Renovación sin 1-1 mensual",
    tagline: "Todo el ecosistema grupal, sin la llamada privada.",
    price: null,
    highlight: false,
    features: [
      "Llamada semanal de Lab / Workshop",
      "Llamada quincenal de Automatizaciones y Sistemas",
      "Llamada mensual de Mentalidad",
      "Acceso completo a la comunidad y recursos",
    ],
    footnote: "Misma estructura que la renovación con 1-1, sin la llamada privada mensual.",
  },
]

export function RenovacionView() {
  return (
    <div className="mx-auto max-w-5xl pb-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[#ffde21]" />
          Próximo nivel
        </h1>
        <p className="text-sm text-foreground/50 mt-1.5 max-w-2xl">
          Tu programa puede seguir creciendo. Estas son las formas de continuar el acompañamiento
          y llevar tu negocio al siguiente nivel.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-5 lg:grid-cols-3">
        {OFFERS.map((o) => {
          const Icon = o.icon
          return (
            <div
              key={o.id}
              className="relative flex flex-col rounded-2xl border bg-card p-6 transition-all"
              style={{
                borderColor: o.highlight ? "#ffde21" : "var(--border)",
                boxShadow: o.highlight ? "0 0 0 1px #ffde21, 0 8px 32px -8px rgba(255,222,33,0.25)" : undefined,
              }}
            >
              {o.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-[#ffde21] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
                  Recomendado
                </span>
              )}

              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: o.highlight ? "#ffde21" : "var(--muted)" }}
                >
                  <Icon className="h-4.5 w-4.5" style={{ color: o.highlight ? "#000" : "var(--muted-foreground)" }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">{o.badge}</span>
              </div>

              <h2 className="text-lg font-bold text-foreground leading-tight">{o.title}</h2>
              <p className="text-[13px] text-foreground/55 mt-1.5 leading-relaxed">{o.tagline}</p>

              {/* Precio */}
              <div className="mt-4 mb-4">
                {o.price
                  ? <span className="text-2xl font-extrabold text-foreground">{o.price}</span>
                  : <span className="text-sm font-semibold text-[#ffde21]">Consultá el valor con Ann</span>}
              </div>

              {/* Features */}
              <ul className="space-y-2.5 flex-1">
                {o.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground/80 leading-snug">
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: o.highlight ? "color-mix(in srgb, #ffde21 25%, transparent)" : "var(--muted)" }}
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
