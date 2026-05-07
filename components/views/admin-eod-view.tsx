"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Loader2, Save, Check, AlertCircle, Trophy, Calendar,
  AlertTriangle, User, Trash2, Smile, ListChecks,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { isAdmin } from "@/lib/auth/permissions"

type EodLog = {
  id: string
  user_id: string
  date: string
  wins: string | null
  plans_tomorrow: string | null
  blockers: string | null
  mood: number | null
  created_at: string
  updated_at: string
  author_name?: string | null
  author_role?: string | null
}

const MOOD_OPTIONS = [
  { value: 1, emoji: "😣", label: "Muy mal" },
  { value: 2, emoji: "😕", label: "Mal" },
  { value: 3, emoji: "😐", label: "Normal" },
  { value: 4, emoji: "🙂", label: "Bien" },
  { value: 5, emoji: "🔥", label: "Brutal" },
]

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
}

function fmtRelative(iso: string): string {
  const today = todayISO()
  if (iso === today) return "Hoy"
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,"0")}-${String(yesterday.getDate()).padStart(2,"0")}`
  if (iso === yISO) return "Ayer"
  return fmtDate(iso)
}

export function AdminEodView() {
  const [date, setDate]             = useState(todayISO())
  const [wins, setWins]             = useState("")
  const [plans, setPlans]           = useState("")
  const [blockers, setBlockers]     = useState("")
  const [mood, setMood]             = useState<number | null>(null)
  const [saving, setSaving]         = useState(false)
  const [savedAt, setSavedAt]       = useState<number | null>(null)
  const [error, setError]           = useState<string | null>(null)

  const [logs, setLogs]             = useState<EodLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [userRole, setUserRole]     = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Cargar role + user actual
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return
      setCurrentUserId(data.user.id)
      supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
        .then(({ data: prof }) => setUserRole((prof as any)?.role ?? null))
    })
  }, [])

  // Cargar logs
  async function loadLogs() {
    setLoadingLogs(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoadingLogs(false); return }

      const res = await fetch("/api/admin/eod/log", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (res.ok) setLogs(json.logs ?? [])
    } finally {
      setLoadingLogs(false)
    }
  }
  useEffect(() => { loadLogs() }, [])

  // Si cambia la fecha, precargar log existente del user actual de ese día
  useEffect(() => {
    if (!currentUserId) return
    const existing = logs.find(l => l.date === date && l.user_id === currentUserId)
    if (existing) {
      setWins(existing.wins ?? "")
      setPlans(existing.plans_tomorrow ?? "")
      setBlockers(existing.blockers ?? "")
      setMood(existing.mood ?? null)
    } else {
      setWins(""); setPlans(""); setBlockers(""); setMood(null)
    }
  }, [date, logs, currentUserId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSaving(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("No hay sesión activa"); setSaving(false); return }

      const res = await fetch("/api/admin/eod/log", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          date, wins: wins || null, plans_tomorrow: plans || null,
          blockers: blockers || null, mood,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? "Error al guardar"); setSaving(false); return }
      setSavedAt(Date.now())
      await loadLogs()
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Borrar este EOD?")) return
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch("/api/admin/eod/log", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    })
    await loadLogs()
  }

  const myLogs = useMemo(() =>
    currentUserId ? logs.filter(l => l.user_id === currentUserId) : [],
    [logs, currentUserId]
  )

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">End of Day</h1>
        </div>
        <p className="text-xs text-foreground/40 ml-[18px]">
          Cierre del día: wins, agenda de mañana y blockers.
        </p>
      </div>

      {/* Form de carga */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-card p-5 space-y-5"
      >
        {/* Fecha + Mood */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-[#ffde21]" />
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={e => setDate(e.target.value)}
              className="h-9 rounded-lg border border-border bg-foreground/[0.03] px-3 text-sm font-semibold text-foreground outline-none focus:border-[#ffde21]/50"
            />
            <span className="text-xs text-foreground/45">{fmtDate(date)}</span>
            {currentUserId && logs.find(l => l.date === date && l.user_id === currentUserId) && (
              <span className="text-[11px] text-foreground/55">· editando</span>
            )}
          </div>

          {savedAt && (Date.now() - savedAt) < 3000 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500">
              <Check className="h-3.5 w-3.5" /> Guardado
            </span>
          )}
        </div>

        {/* Wins */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-foreground/55">
            <Trophy className="h-3.5 w-3.5 text-[#ffde21]" />
            Wins de hoy
          </label>
          <textarea
            value={wins}
            onChange={e => setWins(e.target.value)}
            rows={3}
            placeholder="Cerrá ventas, calls importantes, tareas completadas, aprendizajes…"
            className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-[#ffde21]/50 resize-none"
          />
        </div>

        {/* Plans tomorrow */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-foreground/55">
            <ListChecks className="h-3.5 w-3.5 text-[#ffde21]" />
            Para mañana
          </label>
          <textarea
            value={plans}
            onChange={e => setPlans(e.target.value)}
            rows={3}
            placeholder="Lo que tenés pensado hacer mañana, prioridades, pendientes…"
            className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-[#ffde21]/50 resize-none"
          />
        </div>

        {/* Blockers */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-foreground/55">
            <AlertTriangle className="h-3.5 w-3.5 text-[#ffde21]" />
            Blockers / Pedidos
          </label>
          <textarea
            value={blockers}
            onChange={e => setBlockers(e.target.value)}
            rows={2}
            placeholder="Algo que te traba, acceso que necesitás, decisión pendiente del equipo…"
            className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-[#ffde21]/50 resize-none"
          />
        </div>

        {/* Mood */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-foreground/55">
            <Smile className="h-3.5 w-3.5 text-[#ffde21]" />
            ¿Cómo estuvo el día? <span className="text-foreground/30 normal-case">(opcional)</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {MOOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMood(mood === opt.value ? null : opt.value)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-colors ${
                  mood === opt.value
                    ? "border-[#ffde21] bg-[#ffde21]/[0.10] text-foreground font-semibold"
                    : "border-border bg-foreground/[0.02] text-foreground/65 hover:border-foreground/20 hover:text-foreground"
                }`}
                title={opt.label}
              >
                <span className="text-base">{opt.emoji}</span>
                <span className="text-[11px] uppercase tracking-wider">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-2.5 text-xs text-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || (!wins && !plans && !blockers && mood == null)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#ffe84d] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Guardando…" : "Guardar EOD"}
          </button>
        </div>
      </form>

      {/* Feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground/55">
            {isAdmin(userRole) ? "Feed del equipo" : "Mis EODs"}
          </h2>
          <span className="text-[10px] text-foreground/40">
            {(isAdmin(userRole) ? logs : myLogs).length} entradas
          </span>
        </div>

        {loadingLogs ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-12 flex items-center justify-center text-sm text-foreground/40">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
          </div>
        ) : (isAdmin(userRole) ? logs : myLogs).length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-foreground/40">
            Aún no hay EODs. Empezá completando el form de arriba.
          </div>
        ) : (
          <div className="space-y-2.5">
            {(isAdmin(userRole) ? logs : myLogs).map(log => {
              const isOwn = log.user_id === currentUserId
              const moodOpt = log.mood ? MOOD_OPTIONS.find(m => m.value === log.mood) : null
              return (
                <article
                  key={log.id}
                  className="rounded-2xl border border-border bg-card p-5 hover:border-foreground/20 transition-colors"
                >
                  {/* Card header */}
                  <header className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ffde21]/40 bg-[#ffde21]/10">
                        <User className="h-4 w-4 text-[#ffde21]" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-foreground">
                            {log.author_name ?? (isOwn ? "Vos" : "Usuario")}
                          </p>
                          {log.author_role && (
                            <span className="rounded-full border border-foreground/15 bg-foreground/[0.04] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-foreground/55">
                              {log.author_role}
                            </span>
                          )}
                          {moodOpt && (
                            <span className="text-base" title={moodOpt.label}>{moodOpt.emoji}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-foreground/40 mt-0.5">{fmtRelative(log.date)} · {log.date}</p>
                      </div>
                    </div>

                    {(isOwn || isAdmin(userRole)) && (
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="text-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg p-1.5 transition-colors"
                        title="Borrar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </header>

                  {/* Sections */}
                  <div className="space-y-3 ml-12">
                    {log.wins && (
                      <Section icon={Trophy} label="Wins" text={log.wins} />
                    )}
                    {log.plans_tomorrow && (
                      <Section icon={ListChecks} label="Para mañana" text={log.plans_tomorrow} />
                    )}
                    {log.blockers && (
                      <Section icon={AlertTriangle} label="Blockers" text={log.blockers} variant="warn" />
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ icon: Icon, label, text, variant }: {
  icon: any
  label: string
  text: string
  variant?: "warn"
}) {
  const isWarn = variant === "warn"
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 ${isWarn ? "text-amber-500" : "text-[#ffde21]"}`} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isWarn ? "text-amber-500" : "text-foreground/55"}`}>
          {label}
        </span>
      </div>
      <p className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  )
}
