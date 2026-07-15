"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import {
  Terminal, Trash2, RefreshCw, Circle, Filter, X,
  AlertCircle, AlertTriangle, Info, Bug,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
type Level = "error" | "warn" | "info" | "debug"
interface LogEntry {
  id:         number
  level:      Level
  route:      string | null
  message:    string
  context:    Record<string, any> | null
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────
const LEVEL_CONFIG: Record<Level, { label: string; icon: React.ElementType; badge: string; row: string; dot: string }> = {
  error: { label: "Error", icon: AlertCircle,   badge: "bg-red-500/15 text-red-400 ring-red-500/20",    row: "hover:bg-red-500/[0.04]",    dot: "bg-red-500" },
  warn:  { label: "Warn",  icon: AlertTriangle,  badge: "bg-amber-500/15 text-amber-400 ring-amber-500/20", row: "hover:bg-amber-500/[0.04]", dot: "bg-amber-400" },
  info:  { label: "Info",  icon: Info,           badge: "bg-blue-500/15 text-blue-400 ring-blue-500/20",  row: "hover:bg-blue-500/[0.04]",   dot: "bg-blue-400" },
  debug: { label: "Debug", icon: Bug,            badge: "bg-foreground/10 text-foreground/40 ring-foreground/10", row: "hover:bg-foreground/[0.03]", dot: "bg-foreground/30" },
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
}

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? null
}
async function authFetch(path: string, opts: RequestInit = {}) {
  const token = await getToken()
  return fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}`, ...(opts.headers ?? {}) },
  })
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DevLogsPage() {
  const [logs,        setLogs]        = useState<LogEntry[]>([])
  const [loading,     setLoading]     = useState(true)
  const [live,        setLive]        = useState(true)
  const [filterLevel, setFilterLevel] = useState<Level | "all">("all")
  const [search,      setSearch]      = useState("")
  const [expanded,    setExpanded]    = useState<number | null>(null)
  const [clearing,    setClearing]    = useState(false)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const supabase     = createClient()

  // ── Cargar logs históricos ────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "200" })
      if (filterLevel !== "all") params.set("level", filterLevel)
      const res  = await authFetch(`/api/admin/dev-logs?${params}`)
      const data = await res.json()
      if (res.ok) setLogs(data.logs ?? [])
    } finally {
      setLoading(false)
    }
  }, [filterLevel])

  useEffect(() => { loadLogs() }, [loadLogs])

  // ── Supabase Realtime — nuevos logs en vivo ───────────────────────────────
  useEffect(() => {
    if (!live) return

    const channel = supabase
      .channel("app_logs_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "app_logs" },
        (payload) => {
          const entry = payload.new as LogEntry
          if (filterLevel !== "all" && entry.level !== filterLevel) return
          setLogs(prev => [...prev.slice(-499), entry]) // máx 500 en memoria
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [live, filterLevel, supabase])

  // ── Auto-scroll al final cuando llegan logs nuevos ────────────────────────
  useEffect(() => {
    if (live) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs, live])

  // ── Limpiar todos los logs ────────────────────────────────────────────────
  const clearAll = async () => {
    if (!confirm("¿Borrar todos los logs?")) return
    setClearing(true)
    try {
      await authFetch("/api/admin/dev-logs", { method: "DELETE", body: JSON.stringify({ all: true }) })
      setLogs([])
    } finally { setClearing(false) }
  }

  // ── Filtrado local por búsqueda ───────────────────────────────────────────
  const visible = logs.filter(l => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      l.message.toLowerCase().includes(q) ||
      (l.route ?? "").toLowerCase().includes(q) ||
      JSON.stringify(l.context ?? {}).toLowerCase().includes(q)
    )
  })

  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.level] = (acc[l.level] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0b] text-[13px] font-mono">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-white/[0.07] bg-[#0f0f11] px-5 py-3">
        <Terminal className="h-4 w-4 text-[#dafc69] shrink-0" />
        <span className="font-bold text-white tracking-tight">Dev Logs</span>

        {/* Live indicator */}
        <button
          onClick={() => setLive(v => !v)}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
            live ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.05] text-white/30"
          }`}
        >
          <Circle className={`h-1.5 w-1.5 fill-current ${live ? "animate-pulse" : ""}`} />
          {live ? "Live" : "Pausado"}
        </button>

        {/* Level filters */}
        <div className="flex items-center gap-1 ml-2">
          {(["all", "error", "warn", "info", "debug"] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                filterLevel === lvl
                  ? lvl === "all"
                    ? "bg-white/10 text-white"
                    : `${LEVEL_CONFIG[lvl as Level].badge} ring-1 ring-inset`
                  : "text-white/25 hover:text-white/50"
              }`}
            >
              {lvl === "all" ? `All (${logs.length})` : `${lvl} (${counts[lvl] ?? 0})`}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-48 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={loadLogs}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] text-white/40 hover:bg-white/[0.05] hover:text-white/70 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Reload
        </button>
        <button
          onClick={clearAll}
          disabled={clearing || logs.length === 0}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] text-red-500/50 hover:bg-red-500/[0.08] hover:text-red-400 transition-all disabled:opacity-30"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Limpiar
        </button>
      </div>

      {/* ── Log list ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-white/20">
            Cargando logs…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-white/20">
            <Terminal className="h-8 w-8" />
            <p>{search ? "Sin resultados para esa búsqueda" : "No hay logs todavía"}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {visible.map(l => {
              const cfg = LEVEL_CONFIG[l.level]
              const Icon = cfg.icon
              const isExp = expanded === l.id

              return (
                <div
                  key={l.id}
                  className={`cursor-pointer transition-colors ${cfg.row} ${isExp ? "bg-white/[0.03]" : ""}`}
                  onClick={() => setExpanded(isExp ? null : l.id)}
                >
                  {/* Main row */}
                  <div className="flex items-start gap-3 px-5 py-2">
                    {/* Timestamp */}
                    <span className="shrink-0 text-white/20 tabular-nums text-[11px] pt-0.5">
                      {fmtDate(l.created_at)} {fmtTime(l.created_at)}
                    </span>

                    {/* Level badge */}
                    <span className={`shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${cfg.badge}`}>
                      <Icon className="h-2.5 w-2.5" />
                      {l.level}
                    </span>

                    {/* Route */}
                    {l.route && (
                      <span className="shrink-0 text-[#dafc69]/50 text-[11px]">
                        [{l.route}]
                      </span>
                    )}

                    {/* Message */}
                    <span className={`flex-1 min-w-0 ${isExp ? "text-white" : "text-white/70 truncate"}`}>
                      {l.message}
                    </span>

                    {/* Context indicator */}
                    {l.context && Object.keys(l.context).length > 0 && (
                      <span className="shrink-0 text-white/20 text-[10px]">
                        {isExp ? "▲" : "▼"} ctx
                      </span>
                    )}
                  </div>

                  {/* Expanded context */}
                  {isExp && l.context && Object.keys(l.context).length > 0 && (
                    <div className="px-5 pb-3">
                      <pre className="rounded-lg bg-white/[0.04] px-4 py-3 text-[11px] text-white/50 overflow-x-auto border border-white/[0.06]">
                        {JSON.stringify(l.context, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Footer stats ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-t border-white/[0.07] bg-[#0f0f11] px-5 py-2 text-[11px] text-white/25">
        <span>{visible.length} entradas</span>
        {Object.entries(counts).map(([lvl, n]) => (
          <span key={lvl} className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${LEVEL_CONFIG[lvl as Level]?.dot ?? "bg-white/20"}`} />
            {lvl}: {n}
          </span>
        ))}
        <div className="flex-1" />
        <span className={`flex items-center gap-1.5 ${live ? "text-emerald-500/60" : "text-white/20"}`}>
          <Circle className={`h-1.5 w-1.5 fill-current ${live ? "animate-pulse" : ""}`} />
          {live ? "Recibiendo en tiempo real" : "Tiempo real pausado"}
        </span>
      </div>
    </div>
  )
}
