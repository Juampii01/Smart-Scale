"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Calendar, Clock, ExternalLink, Loader2, RefreshCw, Video, Search, Play, FileText } from "lucide-react"
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
  next_date:   string | null
  sort_order:  number
}

interface Occurrence {
  ev:   CalendarEvent
  date: Date
}

interface Recording {
  id:            string
  title:         string
  recorded_at:   string
  recording_url: string
  passcode:      string | null
  duration:      string | null
  playbook_url:  string | null
  thumbnail:     string | null
  notes:         string | null
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

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
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hour12: true }).format(realUTC)
}

function recurrenceLabel(r: CalendarEvent["recurrence"]): string {
  if (r === "biweekly")     return "Cada 2 semanas"
  if (r === "monthly")      return "Mensual"
  if (r === "monthly_last") return "Último viernes del mes"
  if (r === "once")         return "Evento único"
  return "Semanal"
}

// ─── Occurrence computation ───────────────────────────────────────────────────

const DOW: Record<string, number> = {
  Domingo: 0, Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6,
}

function nextWeekday(from: Date, dow: number): Date {
  const d = new Date(from); d.setHours(12, 0, 0, 0)
  const diff = (dow - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return d
}

function lastFridayOfMonth(year: number, month: number): Date {
  const d = new Date(year, month + 1, 0, 12, 0, 0, 0)
  while (d.getDay() !== 5) d.setDate(d.getDate() - 1)
  return d
}

function occurrencesFor(ev: CalendarEvent, start: Date, end: Date): Date[] {
  if (ev.status === "cancelled") return []
  const res: Date[] = []
  const dow = ev.day_of_week ? DOW[ev.day_of_week] : null

  if (ev.recurrence === "once") {
    if (ev.next_date) {
      const d = new Date(ev.next_date + "T12:00:00")
      if (d >= start && d <= end) res.push(d)
    }
    return res
  }

  if (ev.recurrence === "monthly_last") {
    let y = start.getFullYear(), m = start.getMonth()
    for (let i = 0; i < 4; i++) {
      const d = lastFridayOfMonth(y, m)
      if (d >= start && d <= end) res.push(d)
      m++; if (m > 11) { m = 0; y++ }
    }
    return res
  }

  if (ev.recurrence === "monthly") {
    let d = ev.next_date ? new Date(ev.next_date + "T12:00:00") : (dow != null ? nextWeekday(start, dow) : null)
    if (!d) return res
    for (let i = 0; i < 3; i++) {
      if (d >= start && d <= end) res.push(new Date(d))
      d = new Date(d); d.setMonth(d.getMonth() + 1)
    }
    return res
  }

  // weekly / biweekly
  const step = ev.recurrence === "biweekly" ? 14 : 7
  let d = ev.next_date ? new Date(ev.next_date + "T12:00:00") : (dow != null ? nextWeekday(start, dow) : null)
  if (!d) return res
  while (d < start) { d = new Date(d); d.setDate(d.getDate() + step) }
  let guard = 0
  while (d <= end && guard < 30) {
    res.push(new Date(d))
    d = new Date(d); d.setDate(d.getDate() + step)
    guard++
  }
  return res
}

// ─── Date format helpers ──────────────────────────────────────────────────────

function monthKey(d: Date)    { return `${d.getFullYear()}-${d.getMonth()}` }
function monthLabel(d: Date)   { return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" }).toUpperCase() }
function weekdayAbbr(d: Date)  { return d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "").toUpperCase() }
function fullDate(d: Date)     { return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).replace(/^\w/, c => c.toUpperCase()) }

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: CalendarEvent["status"] }) {
  if (status === "tbd") return (
    <span className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">Próximamente</span>
  )
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Masterclass</span>
  )
}

// ─── Session row (Scale20 style) ──────────────────────────────────────────────

function SessionRow({ occ }: { occ: Occurrence }) {
  const { ev, date } = occ
  const localTime = ev.time ? toUserLocalTime(ev.time) : null
  return (
    <div className="flex items-start gap-4 rounded-[14px] border border-foreground/[0.07] bg-card p-4 hover:border-foreground/[0.12] transition-colors">
      {/* Day block */}
      <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-[10px] bg-foreground/[0.04] py-1.5">
        <span className="text-[20px] font-bold leading-none text-foreground tabular-nums">{date.getDate()}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-foreground/40 mt-0.5">{weekdayAbbr(date)}</span>
      </div>

      {/* Middle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <StatusPill status={ev.status} />
          <span className="text-[11px] text-foreground/35">{recurrenceLabel(ev.recurrence)}</span>
        </div>
        <p className="text-[14px] font-semibold text-foreground leading-snug">{ev.title}</p>
        {ev.description && <p className="text-[12px] text-foreground/40 mt-0.5">{ev.description}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[12px] text-foreground/45">
          <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fullDate(date)}</span>
          {ev.time && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{ev.time} · {ev.tz_label}</span>}
          {localTime && <span className="text-[#ffde21]/80 font-semibold">Tu hora: {localTime}</span>}
          {ev.passcode && <span className="text-foreground/35">Código <span className="font-mono text-foreground/60">{ev.passcode}</span></span>}
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 self-center">
        {ev.zoom_url ? (
          <a href={ev.zoom_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#ffde21] px-3.5 py-2 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-colors whitespace-nowrap">
            Unirse <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="inline-flex items-center rounded-[8px] bg-foreground/[0.05] px-3.5 py-2 text-[12px] font-semibold text-foreground/30 whitespace-nowrap">Link pronto</span>
        )}
      </div>
    </div>
  )
}

// ─── Recording row (Scale20 style) ───────────────────────────────────────────

function RecordingRow({ rec }: { rec: Recording }) {
  const date = new Date(rec.recorded_at + "T12:00:00")
  return (
    <div className="flex items-start gap-4 rounded-[14px] border border-foreground/[0.07] bg-card p-4 hover:border-foreground/[0.12] transition-colors">
      {/* Day block */}
      <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-[10px] bg-foreground/[0.04] py-1.5">
        <span className="text-[20px] font-bold leading-none text-foreground tabular-nums">{date.getDate()}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-foreground/40 mt-0.5">{weekdayAbbr(date)}</span>
      </div>

      {/* Middle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
            <Video className="h-2.5 w-2.5" /> Grabación
          </span>
        </div>
        <p className="text-[14px] font-semibold text-foreground leading-snug">{rec.title}</p>
        {rec.notes && <p className="text-[12px] text-foreground/40 mt-0.5 line-clamp-1">{rec.notes}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[12px] text-foreground/45">
          <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fullDate(date)}</span>
          {rec.duration && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{rec.duration}</span>}
          {rec.passcode && <span className="text-foreground/35">Código <span className="font-mono text-foreground/60">{rec.passcode}</span></span>}
        </div>
      </div>

      {/* CTAs */}
      <div className="shrink-0 self-center flex items-center gap-2">
        {rec.playbook_url && (
          <a href={rec.playbook_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-foreground/[0.10] px-3 py-2 text-[12px] font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/[0.20] transition-colors whitespace-nowrap">
            <FileText className="h-3.5 w-3.5" /> Playbook
          </a>
        )}
        <a href={rec.recording_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#ffde21] px-3.5 py-2 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-colors whitespace-nowrap">
          <Play className="h-3.5 w-3.5" /> Ver
        </a>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CalendarView() {
  const [events,  setEvents]  = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [tab,     setTab]     = useState<"upcoming" | "recordings">("upcoming")
  const [query,   setQuery]   = useState("")
  const [recordings, setRecordings] = useState<Recording[]>([])

  const fetchEvents = async () => {
    setLoading(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sin sesión"); return }
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [evRes, recRes] = await Promise.all([
        fetch("/api/admin/calendar-events", { headers }),
        fetch("/api/calendar-recordings", { headers }),
      ])
      const evJson = await evRes.json()
      if (!evRes.ok) { setError(evJson.error ?? "Error cargando agenda"); return }
      setEvents(evJson.events ?? [])
      if (recRes.ok) {
        const recJson = await recRes.json().catch(() => ({}))
        setRecordings(recJson.recordings ?? [])
      }
    } catch (err: any) {
      setError(err?.message ?? "Error de red")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEvents() }, [])

  // Próximas 8 semanas de ocurrencias, ordenadas
  const occurrences = useMemo<Occurrence[]>(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(end.getDate() + 56)
    const all: Occurrence[] = []
    for (const ev of events) {
      for (const date of occurrencesFor(ev, start, end)) all.push({ ev, date })
    }
    all.sort((a, b) => a.date.getTime() - b.date.getTime())
    const q = query.trim().toLowerCase()
    return q ? all.filter(o => o.ev.title.toLowerCase().includes(q)) : all
  }, [events, query])

  // Destacadas = las 2 más próximas (solo si no estás buscando)
  const searching = query.trim().length > 0
  const featured = searching ? [] : occurrences.slice(0, 2)
  const listOccs = searching ? occurrences : occurrences.slice(2)

  // Agrupar el resto por mes
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: Occurrence[] }>()
    for (const o of listOccs) {
      const k = monthKey(o.date)
      if (!map.has(k)) map.set(k, { label: monthLabel(o.date), items: [] })
      map.get(k)!.items.push(o)
    }
    return Array.from(map.values())
  }, [listOccs])

  // Grabaciones (filtradas por búsqueda) agrupadas por mes
  const recordingGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? recordings.filter(r => r.title.toLowerCase().includes(q)) : recordings
    const map = new Map<string, { label: string; items: Recording[] }>()
    for (const r of filtered) {
      const d = new Date(r.recorded_at + "T12:00:00")
      const k = monthKey(d)
      if (!map.has(k)) map.set(k, { label: monthLabel(d), items: [] })
      map.get(k)!.items.push(r)
    }
    return Array.from(map.values())
  }, [recordings, query])

  return (
    <section className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-foreground leading-tight">Agenda</h1>
          <p className="text-[13px] text-foreground/50 mt-0.5">Llamadas semanales · horario Miami · todas quedan grabadas</p>
        </div>
        <button onClick={fetchEvents} disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/[0.08] text-foreground/30 hover:text-foreground transition-colors disabled:opacity-40">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-foreground/[0.07]">
        <div className="flex gap-0">
          {([["upcoming", "Próximas", occurrences.length], ["recordings", "Grabaciones", recordings.length]] as const).map(([id, label, count]) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn(
                "relative flex items-center gap-2 pb-3 px-4 text-[14px] font-semibold transition-colors",
                tab === id
                  ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#ffde21] after:rounded-full"
                  : "text-foreground/40 hover:text-foreground/70"
              )}>
              {label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums", tab === id ? "bg-[#ffde21] text-black" : "bg-foreground/[0.06] text-foreground/40")}>{count}</span>
            </button>
          ))}
        </div>
        <div className="relative pb-2 sm:pb-0 sm:mb-1.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/30" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder={tab === "recordings" ? "Buscar grabación…" : "Buscar sesión…"}
            className="w-full sm:w-56 rounded-[8px] border border-foreground/[0.08] bg-foreground/[0.03] pl-9 pr-3 py-1.5 text-[13px] text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/[0.22] transition-colors" />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-[#ffde21]/40" /></div>
      ) : error ? (
        <div className="rounded-[14px] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
      ) : tab === "recordings" ? (
        recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-foreground/[0.04] border border-foreground/[0.07]">
              <Video className="h-6 w-6 text-foreground/30" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-foreground/70">Todavía no hay grabaciones</p>
              <p className="text-[13px] text-foreground/40 mt-1 max-w-sm">Cada sesión queda grabada. Las grabaciones se publican acá automáticamente después de cada llamada.</p>
            </div>
          </div>
        ) : recordingGroups.length === 0 ? (
          <div className="rounded-[14px] border border-foreground/[0.07] py-16 text-center text-sm text-foreground/30">
            No hay grabaciones para esa búsqueda.
          </div>
        ) : (
          <div className="space-y-6">
            {recordingGroups.map(g => (
              <div key={g.label} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/40">{g.label}</p>
                  <span className="text-[11px] text-foreground/30">{g.items.length} {g.items.length === 1 ? "grabación" : "grabaciones"}</span>
                </div>
                <div className="space-y-2.5">
                  {g.items.map(r => <RecordingRow key={r.id} rec={r} />)}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-6">
          {/* Destacadas — las 2 más próximas */}
          {featured.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-2">
              {featured.map((o, i) => {
                const localTime = o.ev.time ? toUserLocalTime(o.ev.time) : null
                return (
                  <div key={`${o.ev.id}-${i}`} className="rounded-[14px] border border-[#ffde21]/20 bg-[#ffde21]/[0.04] p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusPill status={o.ev.status} />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#ffde21]/80">Próxima</span>
                    </div>
                    <p className="text-[16px] font-bold text-foreground leading-tight">{o.ev.title}</p>
                    <p className="text-[12px] text-foreground/45 mt-1">
                      {fullDate(o.date)}{o.ev.time ? ` · ${o.ev.time} ${o.ev.tz_label}` : ""}
                      {localTime ? ` · tu hora ${localTime}` : ""}
                    </p>
                    {o.ev.zoom_url && (
                      <a href={o.ev.zoom_url} target="_blank" rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] bg-[#ffde21] px-4 py-2 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-colors">
                        Unirse a la sesión <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Lista agrupada por mes */}
          {occurrences.length === 0 ? (
            <div className="rounded-[14px] border border-foreground/[0.07] py-16 text-center text-sm text-foreground/30">
              No hay sesiones próximas{query ? " para esa búsqueda" : ""}.
            </div>
          ) : (
            groups.map(g => (
              <div key={g.label} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/40">{g.label}</p>
                  <span className="text-[11px] text-foreground/30">{g.items.length} {g.items.length === 1 ? "sesión" : "sesiones"}</span>
                </div>
                <div className="space-y-2.5">
                  {g.items.map((o, i) => <SessionRow key={`${o.ev.id}-${o.date.toISOString()}-${i}`} occ={o} />)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Llamada mensual con Ann */}
      <div className="rounded-[14px] border border-foreground/[0.07] bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full border border-[#ffde21]/25 bg-[#ffde21]/[0.08] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#ffde21] mb-1">Mensual · 1:1</span>
            <h3 className="text-[15px] font-bold text-foreground leading-tight">Llamada con Ann</h3>
            <p className="text-[12px] text-foreground/40 mt-0.5">Sesión privada mensual · 1 llamada por mes</p>
          </div>
          <a href="https://calendly.com/strategystudio-mkt/ann-s-privat-link" target="_blank" rel="noreferrer"
            className="shrink-0 flex items-center gap-1.5 rounded-[8px] bg-[#ffde21] px-4 py-2 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-colors">
            <Calendar className="h-3.5 w-3.5" />
            Agendar llamada
          </a>
        </div>
        <div className="rounded-[10px] border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3 space-y-2">
          {[
            "Las llamadas son mensuales y no acumulables.",
            "Cada mes tenés disponible una (1) llamada.",
            "La llamada debe realizarse dentro del mes correspondiente.",
            "Si no se agenda en ese período, no se traslada al mes siguiente.",
          ].map(t => (
            <li key={t} className="flex items-start gap-2 list-none text-[11px] text-foreground/35">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-[#ffde21]/40 shrink-0" />
              {t}
            </li>
          ))}
        </div>
      </div>
    </section>
  )
}
