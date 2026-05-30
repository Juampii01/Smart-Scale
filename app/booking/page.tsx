"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { ArrowRight, Check, Shield, Clock, Star, Zap } from "lucide-react"

// ─── Reading config from query params + env vars ──────────────────────────────
// Admin generates a link from /admin/payments → "Link de pago"
// The Stripe link's after_completion points to /booking/confirmed?calendly=...
//
// This page can be configured via URL params:
//   ?title=...    override hero title
//   ?subtitle=... override subtitle
//   ?price=400    display price
//   ?cta=...      override CTA label
//   ?stripe=...   override Stripe payment link URL
//   ?features=... comma-separated feature list

const DEFAULT_CONFIG = {
  title:    "Auditoría de Ecosistema Circular",
  subtitle: "Una llamada de 45 minutos con Ann para revisar juntos dónde ajustar tu ecosistema y qué inputs trabajar en la próxima etapa.",
  price:    "400",
  currency: "USD",
  cta:      "Reservar llamada",
  features: [
    "45 minutos 1:1 con Ann Sahakyan",
    "Revisión personalizada de tu Ecosistema Circular",
    "Identificación de los ajustes clave para tu próxima etapa",
    "Grabación de la sesión incluida",
  ],
  note:     "Una vez que completás el pago, elegís el día y horario que más te convenga.",
}

function BookingContent() {
  const params  = useSearchParams()

  const title    = params.get("title")    || DEFAULT_CONFIG.title
  const subtitle = params.get("subtitle") || DEFAULT_CONFIG.subtitle
  const price    = params.get("price")    || DEFAULT_CONFIG.price
  const cta      = params.get("cta")      || DEFAULT_CONFIG.cta
  const stripeUrl = params.get("stripe")
    || process.env.NEXT_PUBLIC_BOOKING_STRIPE_URL
    || "https://os.strategycoach.us/payment-link/6a1b666303b17c94f5713bbd"
  const rawFeatures = params.get("features")
  const features = rawFeatures
    ? rawFeatures.split(",").map(f => f.trim()).filter(Boolean)
    : DEFAULT_CONFIG.features

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-foreground/[0.06] bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-[17px] font-bold tracking-tight">Smart</span>
            <span className="rounded-md bg-foreground px-2 py-0.5 text-[14px] font-bold tracking-tight text-background shadow-sm">
              Scale
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-foreground/30" />
            <span className="text-[11px] text-foreground/30 font-medium">Pago seguro con Stripe</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-5 pt-28 pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* Left: copy */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ffde21]/25 bg-[#ffde21]/[0.07] px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ffde21]/70 shrink-0" />
              <span className="text-[11px] font-bold text-[#ffde21] uppercase tracking-[0.18em]">
                Smart Scale · Opción Sync
              </span>
            </div>

            {/* Title */}
            <div className="space-y-4">
              <h1 className="text-[36px] sm:text-[48px] font-black text-foreground leading-[1.05] tracking-tight">
                {title}
              </h1>
              <p className="text-[16px] text-foreground/50 leading-relaxed">
                {subtitle}
              </p>
            </div>

            {/* Features */}
            <ul className="space-y-3">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#ffde21]/15 shrink-0">
                    <Check className="h-3 w-3 text-[#ffde21]" />
                  </span>
                  <span className="text-[14px] text-foreground/70">{f}</span>
                </li>
              ))}
            </ul>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-4 pt-2">
              {[
                { icon: Shield, text: "Pago 100% seguro" },
                { icon: Clock,  text: "Confirmación inmediata" },
                { icon: Star,   text: "Smart Scale™" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5 text-[12px] text-foreground/35">
                  <Icon className="h-3.5 w-3.5" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Right: payment card */}
          <div className="lg:sticky lg:top-24">
            <div className="relative overflow-hidden rounded-3xl border border-foreground/[0.08] bg-card shadow-2xl shadow-black/20">
              {/* Gradient top */}
              <div className="h-[3px] w-full bg-gradient-to-r from-[#ffde21]/80 via-[#ffde21] to-[#ffde21]/80" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.06),transparent_60%)]" />

              <div className="relative p-8 space-y-7">
                {/* Price */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mb-2">
                    Inversión
                  </p>
                  <div className="flex items-end gap-2">
                    <span className="text-[52px] font-black text-foreground leading-none tabular-nums">
                      ${price}
                    </span>
                    <span className="text-[16px] text-foreground/40 font-semibold mb-1.5">USD</span>
                  </div>
                  <p className="text-[12px] text-foreground/30 mt-1">Sesión Sync · 45 minutos</p>
                </div>

                {/* What's included mini-list */}
                <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4 space-y-2.5">
                  {features.slice(0, 3).map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-[12px] text-foreground/55">
                      <Zap className="h-3 w-3 text-[#ffde21]/70 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {stripeUrl ? (
                  <a
                    href={stripeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#ffde21] py-4 text-[15px] font-black text-black hover:bg-[#ffe84d] transition-all duration-200 shadow-lg shadow-[#ffde21]/20 hover:shadow-[#ffde21]/30 hover:scale-[1.01]"
                  >
                    {cta}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] p-4 text-center">
                    <p className="text-[12px] text-amber-400/80">
                      Link de pago no configurado todavía.
                    </p>
                  </div>
                )}

                {/* Note */}
                <p className="text-center text-[11px] text-foreground/25 leading-relaxed px-2">
                  {DEFAULT_CONFIG.note}
                </p>

                {/* Stripe badge */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Shield className="h-3.5 w-3.5 text-foreground/20" />
                  <span className="text-[10px] text-foreground/20 font-medium tracking-wide">
                    Procesado de forma segura por Stripe
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-foreground/[0.06] py-6">
        <div className="mx-auto max-w-4xl px-5 flex items-center justify-between">
          <span className="text-[11px] text-foreground/25">© Smart Scale™</span>
          <span className="text-[11px] text-foreground/25">Todos los derechos reservados</span>
        </div>
      </footer>
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-[#ffde21]/40 border-t-[#ffde21] animate-spin" />
      </div>
    }>
      <BookingContent />
    </Suspense>
  )
}
