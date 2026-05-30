"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, ExternalLink, MapPin, Copy, Check, Loader2, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id:          string
  title:       string
  description: string | null
  day_of_week: string | null
  time:        string | null
  tz_label:    string
  zoom_url:    string | null
  passcode:    string | null
  status:      "active" | "cancelled" | "tbd"
  recurrence:  "weekly" | "biweekly" | "monthly" | "monthly_last" | "once"
  next_date:   string | null   // ISO date YYYY-MM-DD — próxima ocurrencia específica
  sort_order:  number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_ORDER: Record<string, number> = {
  Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4,
  Viernes: 5, Sábado: 6, Domingo: 7,
}

function toUserLocalTime(timeStr: string): string | null {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) return null
  let hour = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (m[3].toUpperCase() === "PM" && hour !== 12) hour += 12
  if (m[3].toUpperCase() === "AM" && hour === 12) hour = 0
  const todayMiami = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
  const baseUTC = new Date(`${todayMiami}T00:00:00Z`)
  baseUTC.setUTCHours(hour, min)
  const miamiHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(baseUTC).find(p => p.type === "hour")?.value ?? "0"
  const miamiHour = parseInt(miamiHourStr, 10)
  let diff = hour - miamiHour
  if (diff < -12) diff += 24
  if (diff > 12) diff -= 24
  const realUTC = new Date(baseUTC.getTime() + diff * 3600 * 1000)
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(realUTC)
}

function recurrenceLabel(r: CalendarEvent["recurrence"]): string {
  if (r === "biweekly")     return "Cada 2 semanas"
  if (r === "monthly")      return "Mensual"
  if (r === "monthly_last") return "Último viernes del mes"
  if (r === "once")         return "Evento único"
  return "Semanal"
}

function fmtNextDate(iso: string): string {
  const d = new Date(iso + "T12:00:00")
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, c => c.toUpperCase())
}

function CopyPasscodeButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-1 rounded-md border border-foreground/[0.08] bg-foreground/[0.03] px-2 py-1 text-[10px] font-semibold text-foreground/55 hover:text-[#ffde21] hover:border-[#ffde21]/30 transition-all"
      title={copied ? "Copiado" : "Copiar código"}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  )
}

function StatusPill({ status }: { status: CalendarEvent["status"] }) {
  if (status === "cancelled") return (
    <span className="inline-flex items-center rounded-full border border-red-400 bg-red-100 text-red-900 px-2 py-0.5 text-[11px] font-medium dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
      Cancelado
    </span>
  )
  if (status === "tbd") return (
    <span className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-foreground/70">
      Próximamente
    </span>
  )
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-400 bg-emerald-100 text-emerald-900 px-2 py-0.5 text-[11px] font-medium dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200">
      Activo
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CalendarView() {
  const [events,  setEvents]  = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetchEvents = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sin sesión"); return }

      const res = await fetch("/api/admin/calendar-events", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Error cargando agenda"); return }
      setEvents(json.events ?? [])
    } catch (err: any) {
      setError(err?.message ?? "Error de red")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEvents() }, [])

  const sorted = [...events].sort((a, b) => {
    const oa = DAY_ORDER[a.day_of_week ?? ""] ?? 99
    const ob = DAY_ORDER[b.day_of_week ?? ""] ?? 99
    return oa !== ob ? oa - ob : a.sort_order - b.sort_order
  })

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">Agenda Semanal</h1>
          </div>
          <p className="text-xs text-foreground/30 ml-[18px]">
            Llamadas semanales · horario Miami · todas quedan grabadas
          </p>
        </div>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/[0.08] text-foreground/30 hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[#ffde21]/40" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-foreground/[0.07] py-16 text-center text-sm text-foreground/30">
          No hay llamadas programadas esta semana.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((item) => {
            const cancelled = item.status === "cancelled"
            return (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card transition-all duration-200 hover:border-[#ffde21]/25 hover:shadow-[0_0_30px_rgba(255,222,33,0.06)]"
              >
                <div className={`h-[2px] w-full ${cancelled ? "bg-red-500/50" : "bg-gradient-to-r from-[#ffde21]/20 via-[#ffde21]/40 to-[#ffde21]/20"}`} />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.04),transparent_55%)]" />

                <div className="relative p-5 space-y-4">
                  {/* Title + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold leading-tight ${cancelled ? "line-through text-foreground/40" : "text-foreground"}`}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-foreground/35">{item.description}</p>
                      )}
                    </div>
                    <StatusPill status={item.status} />
                  </div>

                  {/* Time info */}
                  <div className="space-y-1.5">
                    {/* Próxima fecha específica (biweekly / monthly) */}
                    {!cancelled && item.next_date && (
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#ffde21]/60" />
                        <span className="text-[#ffde21]/80 font-semibold">
                          Próxima: {fmtNextDate(item.next_date)}
                        </span>
                      </div>
                    )}
                    {/* Día de la semana (cuando no hay next_date, o como referencia) */}
                    {item.day_of_week && !item.next_date && (
                      <div className="flex items-center gap-2 text-xs text-foreground/40">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span className={cancelled ? "line-through" : ""}>
                          {item.day_of_week}
                          {item.recurrence === "monthly_last" && (
                            <span className="ml-1.5 text-foreground/25">· último del mes</span>
                          )}
                        </span>
                      </div>
                    )}
                    {/* Frecuencia (biweekly / monthly muestra el tipo) */}
                    {!cancelled && (item.recurrence === "biweekly" || item.recurrence === "monthly") && (
                      <div className="flex items-center gap-2 text-xs text-foreground/35">
                        <span className="h-3.5 w-3.5 shrink-0" />
                        <span>{recurrenceLabel(item.recurrence)}</span>
                      </div>
                    )}
                    {item.time && (
                      <div className="flex items-center gap-2 text-xs text-foreground/40">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className={cancelled ? "line-through" : ""}>{item.time}</span>
                        <span className="text-foreground/20">·</span>
                        <span>{item.tz_label}</span>
                      </div>
                    )}
                    {!cancelled && item.time && toUserLocalTime(item.time) && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-[#ffde21]/70 font-semibold">
                          Tu hora local: {toUserLocalTime(item.time)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-foreground/40">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span>Zoom</span>
                    </div>
                  </div>

                  {/* Passcode */}
                  {item.passcode && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-foreground/[0.06] bg-foreground/[0.03] px-3 py-2">
                      <div>
                        <p className="text-[10px] text-foreground/30 uppercase tracking-wider">Código</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-foreground/80">{item.passcode}</p>
                      </div>
                      <CopyPasscodeButton value={item.passcode} />
                    </div>
                  )}

                  {/* CTA */}
                  <Button
                    asChild
                    size="sm"
                    className={`w-full h-8 rounded-xl text-xs font-bold ${
                      cancelled || !item.zoom_url
                        ? "bg-foreground/5 text-foreground/30 pointer-events-none"
                        : "bg-[#ffde21] text-black hover:bg-[#ffe46b]"
                    }`}
                    disabled={!item.zoom_url || cancelled}
                  >
                    <Link href={item.zoom_url ?? "#"} target="_blank" rel="noreferrer">
                      <span className="inline-flex items-center gap-1.5">
                        {item.zoom_url ? "Unirse a la sesión" : "Link próximamente"}
                        {item.zoom_url && <ExternalLink className="h-3.5 w-3.5" />}
                      </span>
                    </Link>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Monthly call note */}
      <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,222,33,0.03),transparent_60%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground/35 mb-3">Llamada mensual con Ann</p>
          <p className="text-sm text-foreground/55 mb-3">
            Agendá tu llamada:{" "}
            <a
              href="https://calendly.com/strategystudio-mkt/ann-s-privat-link"
              target="_blank"
              rel="noreferrer"
              className="text-[#ffde21]/70 hover:text-[#ffde21] underline underline-offset-2 transition-colors"
            >
              calendly.com/strategystudio-mkt
            </a>
          </p>
          <ul className="space-y-1 text-xs text-foreground/35 list-none">
            {[
              "Las llamadas son mensuales y no acumulables.",
              "Cada mes tenés disponible una (1) llamada.",
              "La llamada debe realizarse dentro del mes correspondiente.",
              "Si no se agenda en ese período, no se traslada al mes siguiente.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-1 rounded-full bg-[#ffde21]/40 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
