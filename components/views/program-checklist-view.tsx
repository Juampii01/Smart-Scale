"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ExternalLink, ChevronDown, Loader2, Eye } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useActiveClient, useActiveClientName, useOwnClient } from "@/components/layout/dashboard-layout"
import { programData } from "@/lib/program-checklist-data"

// ─── Color maps ───────────────────────────────────────────────────────────────

const levelColors: Record<string, string> = {
  "Start Here":                              "bg-blue-500/15 text-blue-500 border-blue-500/40",
  "Nivel 0 — Onboarding":                    "bg-red-500/15 text-red-500 border-red-500/40", // 🔴
  "Nivel 1 — Mente & Visión":                "bg-orange-500/15 text-orange-500 border-orange-500/40", // 🟠
  "Nivel 2 — Tu Modelo":                     "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/40", // 🟡
  "Nivel 3 — Transformación & Fundamentos":  "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40", // 🟢
  "Nivel 4 — Comunidad Email":               "bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-600/40", // 🔵
  "Nivel 5 — Conexión & Fascinación":        "bg-violet-500/15 text-violet-500 border-violet-500/40", // 🟤
  "Nivel 6 — Invitación & Conversión":       "bg-purple-500/15 text-purple-500 border-purple-500/40", // 🟣
  "Nivel 7 — Educando":                      "bg-foreground/[0.06] text-text-2 border-foreground/20", // ⚫
  "Nivel 8 — IA & Sistemas":                 "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/40", // 🤖
}

// Pills compatibles con light + dark mode. En light: fondo emerald-100 + texto emerald-800.
// En dark: fondo emerald-900/40 + texto emerald-300 (look original).
const OUTCOME_PILL = "bg-emerald-100 dark:bg-emerald-900/40"
const OUTCOME_TEXT = "text-emerald-800 dark:text-emerald-300"
const OUTCOME_BORDER = "border-emerald-400/50 dark:border-emerald-600/30"

const outcomeColors: Record<string, { bg: string; text: string; border: string; emoji: string }> = {
  "Orientación":   { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "✅" },
  "Visión Clara":  { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🎯" },
  "Hábito":        { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🔁" },
  "Mentalidad":    { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🧠" },
  "Oferta":        { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "💼" },
  "Estrategia":    { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "♟️" },
  "Ventas":        { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "💰" },
  "Contenido":     { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🎬" },
  "Email":         { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "📧" },
  "Marca":         { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "✨" },
  "Marketing":     { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "📈" },
  "Prueba Social": { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "⭐" },
  "Prospección":   { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🎯" },
  "YouTube":       { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "▶️" },
  "Auditoría":     { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🔍" },
  "Workshop":      { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🎤" },
  "Lanzamiento":   { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🚀" },
  "Sistemas":      { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "⚙️" },
  "AI":            { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🤖" },
  "Entrega":       { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "📦" },
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProgramChecklistView() {
  const activeClientId   = useActiveClient()
  const activeClientName = useActiveClientName()
  const ownClientId      = useOwnClient()

  const isViewingOther = !!activeClientId && !!ownClientId && activeClientId !== ownClientId

  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({})
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [loading, setLoading]     = useState(true)

  // UI prefs (open/closed) siguen en localStorage — no son data del cliente
  useEffect(() => {
    const savedOpenMonths = localStorage.getItem("program-checklist-openMonths")
    const savedOpenWeeks = localStorage.getItem("program-checklist-openWeeks")
    if (savedOpenMonths) {
      setOpenMonths(JSON.parse(savedOpenMonths))
    } else {
      setOpenMonths({ [programData[0].month]: true })
      setOpenWeeks({ [programData[0].month + programData[0].weeks[0].title]: true })
    }
    if (savedOpenWeeks) setOpenWeeks(JSON.parse(savedOpenWeeks))
  }, [])

  useEffect(() => { localStorage.setItem("program-checklist-openMonths", JSON.stringify(openMonths)) }, [openMonths])
  useEffect(() => { localStorage.setItem("program-checklist-openWeeks", JSON.stringify(openWeeks)) }, [openWeeks])

  // Carga el progreso del cliente activo desde Supabase
  const supabaseRef = useRef(createClient())
  const loadProgress = useCallback(async () => {
    if (!activeClientId) {
      setCompleted({})
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      if (!session) { setCompleted({}); return }
      const res = await fetch(`/api/checklist-progress?client_id=${encodeURIComponent(activeClientId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) { setCompleted({}); return }
      const json = await res.json()
      const map: Record<string, boolean> = {}
      for (const k of (json.tasks ?? []) as string[]) map[k] = true
      setCompleted(map)
    } catch {
      setCompleted({})
    } finally {
      setLoading(false)
    }
  }, [activeClientId])

  useEffect(() => { loadProgress() }, [loadProgress])

  const toggleMonth = (key: string) => setOpenMonths((p) => ({ ...p, [key]: !p[key] }))
  const toggleWeek  = (key: string) => setOpenWeeks((p) => ({ ...p, [key]: !p[key] }))

  const toggleTask = async (key: string) => {
    if (!activeClientId) return
    const next = !completed[key]
    // Optimista
    setCompleted((p) => ({ ...p, [key]: next }))
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      if (!session) return
      await fetch("/api/checklist-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ client_id: activeClientId, task_key: key, completed: next }),
      })
    } catch {
      // Rollback en error
      setCompleted((p) => ({ ...p, [key]: !next }))
    }
  }

  const totalTasks = programData.flatMap((m) => m.weeks.flatMap((w) => w.tasks)).length
  const completedCount = Object.values(completed).filter(Boolean).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#dafc69]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground">Program Journey Checklist</h1>
          {loading && <Loader2 className="h-3.5 w-3.5 text-text-2 animate-spin" />}
        </div>
        <p className="text-xs text-text-3 ml-[18px]">Ecosistema circular mínimo viable · {completedCount}/{totalTasks} tareas completadas</p>
      </div>

      {/* Banner de "viendo cliente" — solo cuando admin está viendo otro cliente */}
      {isViewingOther && (
        <div className="flex items-center gap-3 rounded-[14px] border border-accent/20 bg-accent-soft px-4 py-3">
          <Eye className="h-4 w-4 text-[#dafc69] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#dafc69]/80">Viendo otro cliente</p>
            <p className="text-[13px] text-foreground mt-0.5">
              Estás viendo el checklist de <span className="font-semibold text-foreground">{activeClientName ?? "(sin nombre)"}</span>. Los cambios que hagas se guardan en su cuenta.
            </p>
          </div>
        </div>
      )}

      {/* Estado vacío si no hay cliente activo */}
      {!activeClientId && !loading && (
        <div className="rounded-[14px] border border-dashed border-foreground/[0.08] bg-foreground/[0.02] px-5 py-10 text-center text-sm text-text-2">
          No hay un cliente activo seleccionado. Cambiá de perfil desde el menú superior para ver un checklist.
        </div>
      )}

      {/* Table */}
      <div className="rounded-[14px] border border-foreground/[0.08] bg-card overflow-hidden">

        {/* Column headers */}
        <div className="grid grid-cols-[130px_minmax(280px,1fr)_280px_180px_100px_180px] border-b border-foreground/[0.07] bg-foreground/[0.03]">
          {["STATUS","IMPLEMENTATION MILESTONE","LEVEL","OUTCOME","ROADMAP","URL"].map((col) => (
            <div key={col} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-text-2">
              {col}
            </div>
          ))}
        </div>

        {/* Months */}
        {programData.map((month) => {
          const monthTasks = month.weeks.flatMap((w) => w.tasks)
          const monthDone  = monthTasks.filter((t) => completed[month.month + t.label]).length
          const monthTotal = monthTasks.length
          const monthPct   = monthTotal ? Math.round((monthDone / monthTotal) * 100) : 0
          const isMonthOpen = openMonths[month.month]

          return (
            <div key={month.month} className="border-t border-foreground/[0.07] first:border-t-0">

              {/* Month row */}
              <div
                onClick={() => toggleMonth(month.month)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-foreground/[0.02] transition-colors select-none"
              >
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-text-2 transition-transform duration-200 ${isMonthOpen ? "rotate-0" : "-rotate-90"}`}
                />
                <span className="flex-1 text-[14px] font-bold text-foreground">{month.month}</span>
                {/* Progress right */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[12px] text-text-2 tabular-nums">{monthDone}/{monthTotal}</span>
                  <div className="w-32 h-1.5 bg-foreground/[0.08] rounded-full overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${monthPct}%`,
                        backgroundColor: monthPct === 100 ? "#34d399" : "var(--accent-ink)",
                      }}
                    />
                  </div>
                  <span className="text-[12px] text-text-2 tabular-nums w-8 text-right">{monthPct}%</span>
                </div>
              </div>

              {/* Weeks */}
              {isMonthOpen && month.weeks.map((week) => {
                const weekKey   = month.month + week.title
                const weekDone  = week.tasks.filter((t) => completed[month.month + t.label]).length
                const isWeekOpen = openWeeks[weekKey]

                return (
                  <div key={week.title} className="border-t border-foreground/[0.05]">

                    {/* Week row */}
                    <div
                      onClick={() => toggleWeek(weekKey)}
                      className="flex items-center gap-3 pl-10 pr-4 py-2.5 cursor-pointer hover:bg-foreground/[0.02] transition-colors select-none bg-foreground/[0.01]"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 flex-shrink-0 text-text-3 transition-transform duration-200 ${isWeekOpen ? "rotate-0" : "-rotate-90"}`}
                      />
                      <span className="h-4 w-[3px] rounded-full bg-accent flex-shrink-0" />
                      <span className="flex-1 text-[13px] font-semibold text-foreground">{week.title}</span>
                      <span className="text-[11px] text-text-3 tabular-nums flex-shrink-0">
                        {weekDone}/{week.tasks.length}
                      </span>
                    </div>

                    {/* Note banner */}
                    {isWeekOpen && week.note && (
                      <div className="mx-4 mt-2 mb-1 flex items-start gap-2.5 rounded-lg border border-amber-400 bg-amber-100 px-4 py-2.5 dark:border-amber-400/20 dark:bg-amber-500/[0.07]">
                        <span className="text-amber-700 text-[11px] flex-shrink-0 mt-0.5 dark:text-amber-400">⚡</span>
                        <p className="text-[11px] text-amber-900 leading-snug dark:text-amber-300/80">{week.note}</p>
                      </div>
                    )}

                    {/* Task rows */}
                    {isWeekOpen && week.tasks.map((task) => {
                      const taskKey = month.month + task.label
                      const isDone  = completed[taskKey]
                      const lc      = levelColors[task.level] ?? "bg-foreground/[0.04] text-text-2 border-foreground/10"
                      const oc      = outcomeColors[task.outcome]

                      return (
                        <div
                          key={task.label}
                          className={`grid grid-cols-[130px_minmax(280px,1fr)_280px_180px_100px_180px] border-t border-foreground/[0.04] transition-colors duration-150 ${
                            isDone ? "bg-secondary/40" : "hover:bg-foreground/[0.015]"
                          }`}
                        >
                          {/* STATUS */}
                          <div
                            className="flex items-center gap-2.5 px-4 py-3 cursor-pointer"
                            onClick={() => toggleTask(taskKey)}
                          >
                            <div
                              className={`h-5 w-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-all duration-200 ${
                                isDone
                                  ? "border-emerald-500 bg-emerald-500"
                                  : "border-foreground/20 bg-transparent"
                              }`}
                            >
                              {isDone && (
                                <svg className="h-2.5 w-2.5 text-foreground" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <span className={`text-[11px] ${isDone ? "text-emerald-700 dark:text-emerald-400" : "text-text-3"}`}>
                              {isDone ? "Completado" : "No iniciado"}
                            </span>
                          </div>

                          {/* MILESTONE */}
                          <div className="flex items-center px-4 py-3 min-w-0">
                            <span className={`text-[13px] leading-snug ${isDone ? "line-through text-text-3" : "text-foreground"}`}>
                              {task.label}
                            </span>
                          </div>

                          {/* LEVEL */}
                          <div className="flex items-center px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${lc}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />
                              {task.level}
                            </span>
                          </div>

                          {/* OUTCOME */}
                          <div className="flex items-center px-4 py-3">
                            {oc ? (
                              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${oc.bg} ${oc.text} ${oc.border}`}>
                                {task.outcome} {oc.emoji}
                              </span>
                            ) : (
                              <span className="text-[11px] text-text-3">—</span>
                            )}
                          </div>

                          {/* ROADMAP */}
                          <div className="flex items-center px-4 py-3">
                            <span className="text-[11px] text-text-3 truncate">{week.title.split(" - ")[0]}</span>
                          </div>

                          {/* URL */}
                          <div className="flex items-center px-4 py-3">
                            {task.link === "pending" ? (
                              <span className="inline-flex items-center rounded-md border border-amber-400 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[0.07] dark:text-amber-400/70">
                                Módulo en creación
                              </span>
                            ) : task.link ? (
                              <a
                                href={task.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] text-text-3 hover:text-[#dafc69] transition-colors truncate max-w-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">
                                  {task.link.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}
                                </span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-text-3">—</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
