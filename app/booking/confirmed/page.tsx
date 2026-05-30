"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { CheckCircle2, Shield } from "lucide-react"

// ─── Page shown after successful Stripe payment ───────────────────────────────
// Stripe Payment Link's after_completion.redirect.url should point here:
//   https://smartscale.space/booking/confirmed?calendly=ENCODED_URL
//
// The ?calendly param is the full Calendly URL (URL-encoded).
// Falls back to NEXT_PUBLIC_BOOKING_CALENDLY_URL env var.

function ConfirmedContent() {
  const params = useSearchParams()
  const [visible, setVisible] = useState(false)

  const rawCalendly = params.get("calendly")
    || process.env.NEXT_PUBLIC_BOOKING_CALENDLY_URL
    || "https://calendly.com/strategystudio-mkt/ann-s-privat-link"
  const calendlyUrl = rawCalendly.startsWith("https://") ? rawCalendly : ""

  useEffect(() => {
    // Small delay so the animation is visible
    const t = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Nav */}
      <nav className="border-b border-foreground/[0.06] bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-[17px] font-bold tracking-tight">Smart</span>
            <span className="rounded-md bg-foreground px-2 py-0.5 text-[14px] font-bold tracking-tight text-background shadow-sm">
              Scale
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400 font-semibold">Pago confirmado</span>
          </div>
        </div>
      </nav>

      <main className="flex-1 mx-auto w-full max-w-3xl px-5 pt-12 pb-20 space-y-10">

        {/* Confirmation header */}
        <div
          className={`text-center space-y-4 transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-500/[0.08] mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-[28px] sm:text-[36px] font-black text-foreground tracking-tight">
              ¡Pago confirmado!
            </h1>
            <p className="text-[15px] text-foreground/45 mt-2 max-w-md mx-auto leading-relaxed">
              Tu sesión está reservada. Elegí el día y horario que más te convenga.
            </p>
          </div>
        </div>

        {/* Calendly embed */}
        <div
          className={`transition-all duration-700 delay-300 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {calendlyUrl ? (
            <div className="overflow-hidden rounded-3xl border border-foreground/[0.08] bg-card shadow-xl shadow-black/10">
              <div className="h-[3px] w-full bg-gradient-to-r from-[#ffde21]/80 via-[#ffde21] to-[#ffde21]/80" />
              <div className="p-4 sm:p-6 border-b border-foreground/[0.06]">
                <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30">
                  Agendá tu llamada
                </p>
              </div>
              <iframe
                src={`${calendlyUrl}?hide_gdpr_banner=1&hide_event_type_details=0&background_color=0a0a0a&text_color=ffffff&primary_color=ffde21`}
                width="100%"
                height="700"
                frameBorder="0"
                title="Agendar sesión"
                className="block"
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-foreground/[0.08] bg-card p-10 text-center space-y-3">
              <p className="text-[15px] text-foreground/50">
                En breve vas a recibir un email con el link para agendar tu sesión.
              </p>
              <p className="text-[13px] text-foreground/30">
                Si no lo recibís en los próximos minutos, revisá tu carpeta de spam.
              </p>
            </div>
          )}
        </div>

        {/* Footer note */}
        <div
          className={`text-center transition-all duration-700 delay-500 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="inline-flex items-center gap-2 text-[11px] text-foreground/25">
            <Shield className="h-3 w-3" />
            Pago procesado de forma segura por Stripe
          </div>
        </div>

      </main>
    </div>
  )
}

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-[#ffde21]/40 border-t-[#ffde21] animate-spin" />
      </div>
    }>
      <ConfirmedContent />
    </Suspense>
  )
}
