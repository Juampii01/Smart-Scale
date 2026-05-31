"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { CheckCircle2 } from "lucide-react"

function ConfirmedContent() {
  const params = useSearchParams()

  const rawCalendly = params.get("calendly")
    || process.env.NEXT_PUBLIC_BOOKING_CALENDLY_URL
    || "https://calendly.com/strategystudio-mkt/ann-s-privat-link"
  const calendlyUrl = rawCalendly.startsWith("https://") ? rawCalendly : ""

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Nav compacta con confirmación inline */}
      <nav className="border-b border-foreground/[0.06] bg-background/90 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-[16px] font-bold tracking-tight">Smart</span>
            <span className="rounded-md bg-foreground px-2 py-0.5 text-[13px] font-bold tracking-tight text-background shadow-sm">
              Scale
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/[0.07] px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] text-emerald-400 font-semibold">¡Pago confirmado! Ahora agendá tu llamada.</span>
          </div>
        </div>
      </nav>

      {/* Calendly a full height — sin padding innecesario */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 pt-4 pb-6">
        {calendlyUrl ? (
          <div className="overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card shadow-xl shadow-black/10">
            <div className="h-[3px] w-full bg-gradient-to-r from-[#ffde21]/60 via-[#ffde21] to-[#ffde21]/60" />
            <iframe
              src={`${calendlyUrl}?hide_gdpr_banner=1&background_color=111111&text_color=ffffff&primary_color=ffde21`}
              width="100%"
              height="720"
              frameBorder="0"
              title="Agendar sesión"
              className="block"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-foreground/[0.08] bg-card p-10 text-center space-y-3 mt-8">
            <p className="text-[15px] text-foreground/50">
              En breve vas a recibir un email con el link para agendar tu sesión.
            </p>
            <p className="text-[13px] text-foreground/30">
              Si no lo recibís en los próximos minutos, revisá tu carpeta de spam.
            </p>
          </div>
        )}
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
