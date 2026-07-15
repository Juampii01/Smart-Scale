"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { CheckCircle2, CalendarDays, Clock } from "lucide-react"

function ConfirmedContent() {
  const params = useSearchParams()
  const [visible, setVisible] = useState(false)

  const rawCalendly = params.get("calendly")
    || process.env.NEXT_PUBLIC_BOOKING_CALENDLY_URL
    || "https://calendly.com/strategystudio-mkt/ann-s-privat-link"
  const calendlyUrl = rawCalendly.startsWith("https://") ? rawCalendly : ""

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-background">

      {/* Nav */}
      <nav className="border-b border-foreground/[0.06] bg-background/90 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-[17px] font-bold tracking-tight">Smart</span>
            <span className="rounded-md bg-foreground px-2 py-0.5 text-[14px] font-bold tracking-tight text-background">
              Scale
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-foreground/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-medium">Pago confirmado</span>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">

        {/* Hero banner — amarillo, ancho completo */}
        <div
          className={`relative overflow-hidden rounded-3xl transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
          style={{ background: "linear-gradient(135deg, #1a1600 0%, #2a2000 40%, #1a1600 100%)" }}
        >
          {/* Glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,222,33,0.18),transparent_65%)]" />
          <div className="h-[3px] w-full bg-gradient-to-r from-[#dafc69]/40 via-[#dafc69] to-[#dafc69]/40" />

          <div className="relative px-8 py-7 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Check icon */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#dafc69]/15 border border-[#dafc69]/30">
              <CheckCircle2 className="h-7 w-7 text-[#dafc69]" />
            </div>

            {/* Text */}
            <div className="text-center sm:text-left">
              <h1 className="text-[24px] sm:text-[30px] font-black text-foreground tracking-tight leading-tight">
                ¡Tu pago fue confirmado!
              </h1>
              <p className="mt-1.5 text-[14px] text-foreground/50 max-w-xl">
                Ya podés elegir el día y horario para tu sesión con Ann.
                Seleccioná una fecha en el calendario de abajo.
              </p>
            </div>

            {/* Stats pills */}
            <div className="sm:ml-auto flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 rounded-xl border border-[#dafc69]/20 bg-[#dafc69]/[0.07] px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-[#dafc69]/60" />
                <span className="text-[12px] font-semibold text-[#dafc69]/80">45 min</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-xl border border-[#dafc69]/20 bg-[#dafc69]/[0.07] px-3 py-2">
                <CalendarDays className="h-3.5 w-3.5 text-[#dafc69]/60" />
                <span className="text-[12px] font-semibold text-[#dafc69]/80">1:1 con Ann</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calendly embed — ancho completo */}
        <div
          className={`transition-all duration-700 delay-200 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {calendlyUrl ? (
            <div className="overflow-hidden rounded-3xl border border-foreground/[0.08] shadow-2xl shadow-black/20">
              <div className="h-[3px] w-full bg-gradient-to-r from-[#dafc69]/40 via-[#dafc69] to-[#dafc69]/40" />
              <iframe
                src={`${calendlyUrl}?hide_gdpr_banner=1&background_color=111111&text_color=ffffff&primary_color=dafc69`}
                width="100%"
                height="680"
                frameBorder="0"
                title="Agendar sesión con Ann"
                className="block"
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-foreground/[0.08] bg-card p-12 text-center space-y-3">
              <p className="text-[15px] text-foreground/50">
                En breve vas a recibir un email con el link para agendar tu sesión.
              </p>
              <p className="text-[13px] text-foreground/30">
                Si no lo recibís en los próximos minutos, revisá tu carpeta de spam.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-[#dafc69]/40 border-t-[#dafc69] animate-spin" />
      </div>
    }>
      <ConfirmedContent />
    </Suspense>
  )
}
