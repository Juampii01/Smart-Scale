"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, ExternalLink, MapPin } from "lucide-react"

type CalendarItem = {
  day:
    | "Lunes"
    | "Martes"
    | "Miércoles"
    | "Jueves"
    | "Viernes"
    | "Sábado"
    | "Domingo"
  time: string // e.g. "2:00 PM"
  tzLabel?: string // e.g. "Miami"
  title: string
  description?: string
  zoomUrl?: string
  passcode?: string
  status?: "active" | "cancelled" | "tbd"
}

const ITEMS: CalendarItem[] = [
  {
    day: "Lunes",
    time: "2:00 PM",
    tzLabel: "Miami",
    title: "Q&A: Ads · Content · Mindset",
    description: "Con Ann Sahakyan",
    zoomUrl:
      "https://us06web.zoom.us/j/88326569602?pwd=En8DhWa6QIeAO4gFSPLSJHsRNHobjX.1",
    passcode: "009382",
    status: "active",
  },
  {
    day: "Martes",
    time: "1:00 PM",
    tzLabel: "Miami",
    title: "Contenido Orgánico & Marca Personal",
    description: "con Juampi Acosta",
    zoomUrl:
      "https://us06web.zoom.us/j/82480101425?pwd=j6lHTzGjCw1WyL1I24gVX1u6goHmnB.1",
    passcode: "109565",
    status: "active",
  },
  {
    day: "Miércoles",
    time: "2:00 PM",
    tzLabel: "Miami",
    title: "Appointment Setting: Prospección y agendas",
    description: "Con Ann Sahakyan",
    zoomUrl:
      "https://us06web.zoom.us/j/84528843654?pwd=knND3qWgX5OxRRffoHiZSmnaPuPaza.1",
    passcode: "585449",
    status: "active",
  },
  {
    day: "Jueves",
    time: "1:00 PM",
    tzLabel: "Miami",
    title: "Cierre de Venta",
    description: "Con Dani",
    zoomUrl:
      "https://us06web.zoom.us/j/82230842614?pwd=AMtguLNezLsFZ7bJbaZ06nrJxX08ZR.1",
    passcode: "865483",
    status: "active",
  },
  {
    day: "Viernes",
    time: "1:00 PM",
    tzLabel: "Miami",
    title: "Neurociencia y Mentalidad",
    description: "con Santiago Sáez",
    zoomUrl:
      "https://us06web.zoom.us/j/89666744189?pwd=2GAzmVs8kIUvaXqyHAdoG5K85MmRvl.1",
    passcode: "894865",
    status: "active",
  },
]

const DAY_ORDER: Record<CalendarItem["day"], number> = {
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
  Domingo: 7,
}

function statusPill(status: CalendarItem["status"] | undefined) {
  const s = status ?? "active"
  if (s === "cancelled") {
    return (
      <span className="inline-flex items-center rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-200">
        Cancelado
      </span>
    )
  }
  if (s === "tbd") {
    return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/70">
        Próximamente
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
      Activo
    </span>
  )
}

export function CalendarView() {
  const sorted = [...ITEMS].sort(
    (a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day]
  )

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Agenda — Enero</h1>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/70">
            Llamadas semanales
          </span>
        </div>

        <p className="text-sm text-muted-foreground max-w-2xl">
          Estas son las <span className="text-white/90 font-medium">llamadas activas de este mes</span>. 
          Espacios de trabajo diseñados para resolver bloqueos reales en adquisición, contenido, ventas y mentalidad.
        </p>

        <p className="text-xs text-white/50">
          Todas las sesiones se realizan en horario Miami y quedan grabadas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((item) => {
          const cancelled = item.status === "cancelled"
          return (
            <Card
              key={`${item.day}-${item.time}-${item.title}`}
              className={
                "relative overflow-hidden border-border bg-card transition-all duration-200 hover:border-muted-foreground/50 hover:shadow-lg hover:shadow-primary/5"
              }
            >
              {/* subtle top accent */}
              <div
                className={
                  cancelled
                    ? "absolute inset-x-0 top-0 h-1 bg-red-500/70"
                    : "absolute inset-x-0 top-0 h-1 bg-white/10"
                }
              />

              <CardHeader className="pb-3">
                <CardTitle className="flex items-start justify-between gap-3 text-base font-medium">
                  <div className={cancelled ? "line-through text-white/60" : "text-foreground"}>
                    {item.title}
                    {item.description ? (
                      <div className={cancelled ? "mt-1 text-xs text-white/40" : "mt-1 text-xs text-white/50"}>
                        {item.description}
                      </div>
                    ) : null}
                  </div>

                  {statusPill(item.status)}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-white/70">
                    <Calendar className="h-4 w-4 text-white/40" />
                    <span className={cancelled ? "line-through" : ""}>{item.day}</span>
                  </div>

                  <div className="flex items-center gap-2 text-white/70">
                    <Clock className="h-4 w-4 text-white/40" />
                    <span className={cancelled ? "line-through" : ""}>
                      {item.time}
                    </span>
                    <span className="text-white/40">•</span>
                    <span className="text-white/50">{item.tzLabel ?? "Miami"}</span>
                  </div>

                  <div className="flex items-center gap-2 text-white/70">
                    <MapPin className="h-4 w-4 text-white/40" />
                    <span className="text-white/50">Zoom</span>
                  </div>

                  {item.passcode ? (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-xs text-white/50">Código de inicio</div>
                      <div className="mt-0.5 font-mono text-sm text-white/90">
                        {item.passcode}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-xs text-white/40">
                    {item.zoomUrl ?? ""}
                  </div>

                  <Button
                    asChild
                    size="sm"
                    className={
                      cancelled
                        ? "bg-white/10 text-white/60 hover:bg-white/15"
                        : "bg-white text-black hover:bg-white/90"
                    }
                    disabled={!item.zoomUrl}
                  >
                    <Link href={item.zoomUrl ?? "#"} target="_blank" rel="noreferrer">
                      <span className="inline-flex items-center gap-2">
                        Abrir
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </Link>
                  </Button>
                </div>

                {cancelled ? (
                  <p className="text-xs text-red-300/80">
                    Esta sesión figura como cancelada.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-white/80">Agenda tu llamada mensual con Ann</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-white/70 space-y-3">
          <p>
            Agendá tu llamada desde este link:
            <a
              href="https://calendly.com/strategystudio-mkt/onboarding-call"
              target="_blank"
              rel="noreferrer"
              className="ml-1 underline text-white"
            >
              https://calendly.com/strategystudio-mkt/onboarding-call
            </a>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Las llamadas son mensuales y no acumulables.</li>
            <li>Cada mes tenés disponible una (1) llamada.</li>
            <li>La llamada debe realizarse dentro del mes correspondiente.</li>
            <li>Si no se agenda en ese período, no se traslada al mes siguiente.</li>
          </ul>
          <p className="text-xs text-white/50">
            Recomendamos agendar con anticipación para asegurar disponibilidad.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-gradient-to-br from-card via-card/60 to-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-white/80">
            Próximamente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/60 max-w-xl">
            La agenda de febrero todavía no está publicada. 
            Definimos nuevas sesiones estratégicas según las necesidades del grupo y el momento del negocio.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}