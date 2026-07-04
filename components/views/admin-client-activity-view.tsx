"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Activity, Loader2, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientActivity {
  clientId:               string
  userId:                  string
  name:                    string
  email:                   string | null
  lastSignInAt:            string | null
  daysSinceLogin:          number | null
  mondayWinSubmitted:      boolean
  monthlyReportSubmitted:  boolean
  lastInactivityEmailSentAt: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

function loginBadgeCls(days: number | null) {
  if (days == null) return "text-foreground/50 bg-foreground/[0.06] border-foreground/[0.1]"
  if (days <= 2)  return "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
  if (days <= 6)  return "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
  return "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
}

// ─── Vistas rápidas ───────────────────────────────────────────────────────────

type ViewId = "todos" | "inactivos" | "sin-win" | "sin-reporte"
const VIEWS: { id: ViewId; label: string }[] = [
  { id: "todos",       label: "Todos" },
  { id: "inactivos",   label: "Inactivos +7 días" },
  { id: "sin-win",     label: "Sin Monday Win" },
  { id: "sin-reporte", label: "Sin reporte mensual" },
]

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "warn" }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{label}</p>
      <p className={cn(
        "mt-1 text-2xl font-bold tabular-nums",
        tone === "warn" && value > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground"
      )}>
        {value}
      </p>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AdminClientActivityView() {
  const supabase = createClient()

  const [activity, setActivity] = useState<ClientActivity[]>([])
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState<ViewId>("todos")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch("/api/admin/client-activity", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (res.ok) setActivity(json.activity ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const activos       = activity.filter(c => c.daysSinceLogin != null && c.daysSinceLogin <= 6).length
  const inactivos     = activity.filter(c => c.daysSinceLogin == null || c.daysSinceLogin >= 7).length
  const sinWin        = activity.filter(c => !c.mondayWinSubmitted).length
  const sinReporte    = activity.filter(c => !c.monthlyReportSubmitted).length

  const filtered = activity.filter(c => {
    if (view === "inactivos")   return c.daysSinceLogin == null || c.daysSinceLogin >= 7
    if (view === "sin-win")     return !c.mondayWinSubmitted
    if (view === "sin-reporte") return !c.monthlyReportSubmitted
    return true
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-1 pb-12 page-enter">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffde21]/10 border border-[#ffde21]/20">
            <Activity className="h-4 w-4 text-[#ffde21]" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Actividad de clientes</h1>
            <p className="mt-0.5 text-[13px] text-foreground/45">
              {activity.length} cliente{activity.length !== 1 ? "s" : ""} con cuenta
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
          title="Recargar"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Activos (≤6 días)" value={activos}    tone="neutral" />
        <StatCard label="Inactivos +7 días" value={inactivos}  tone="warn" />
        <StatCard label="Sin Monday Win"    value={sinWin}     tone="warn" />
        <StatCard label="Sin reporte mensual" value={sinReporte} tone="warn" />
      </div>

      {/* Vistas rápidas */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-foreground/[0.06] pb-3">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 rounded-lg px-3 text-[12.5px] font-semibold transition-all",
              view === v.id
                ? "bg-foreground text-background"
                : "text-foreground/45 hover:text-foreground hover:bg-foreground/[0.05]"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-foreground/30" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-foreground/[0.08] py-16 text-center">
          <Activity className="mb-3 h-8 w-8 text-foreground/20" />
          <p className="font-semibold text-foreground/50">Nada en esta vista</p>
          <p className="mt-1 text-[12px] text-foreground/30">Probá con otro filtro.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-foreground/[0.07] bg-card">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[minmax(180px,1fr)_150px_140px_140px] border-b border-foreground/[0.06] bg-foreground/[0.01] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/25">
                <div>Cliente</div>
                <div>Último login</div>
                <div>Monday Win</div>
                <div>Reporte mensual</div>
              </div>

              {filtered.map(c => (
                <div
                  key={c.clientId}
                  className="grid grid-cols-[minmax(180px,1fr)_150px_140px_140px] items-center border-b border-foreground/[0.05] px-6 py-4 hover:bg-foreground/[0.02] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[14px] text-foreground">{c.name}</p>
                    <p className="truncate text-[11px] text-foreground/45">{c.email ?? "—"}</p>
                  </div>
                  <div>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", loginBadgeCls(c.daysSinceLogin))}>
                      <Clock className="h-3 w-3" />
                      {c.lastSignInAt
                        ? `${fmtDate(c.lastSignInAt)} · ${c.daysSinceLogin}d`
                        : "Nunca"}
                    </span>
                  </div>
                  <div>
                    {c.mondayWinSubmitted
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      : <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                  </div>
                  <div>
                    {c.monthlyReportSubmitted
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      : <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
