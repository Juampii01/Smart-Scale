"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useOwnClient, useActiveClient, useActiveClientName, useSelectedMonth, useUserRole } from "@/components/layout/dashboard-layout"
import { isDeveloper } from "@/lib/auth/permissions"
import { fakeMonthlyReport } from "@/lib/dev-test-data"
import { CheckCircle, AlertCircle, Loader2, AlertTriangle, History, FileText, Eye, FlaskConical, Sparkles } from "lucide-react"
import { ReportHistoryView } from "@/components/views/report-history-view"

// ─── Field definitions ────────────────────────────────────────────────────────

const FIELD_GROUPS = [
  {
    key: "business",
    label: "Business",
    color: "bg-emerald-500",
    fields: [
      { key: "total_revenue",   label: "Revenue total",       type: "number", hint: "USD" },
      { key: "cash_collected",  label: "Cash Collected",      type: "number", hint: "USD" },
      { key: "mrr",             label: "MRR",                 type: "number", hint: "USD" },
      { key: "ad_spend",        label: "Inversión en Ads",    type: "number", hint: "USD" },
      { key: "software_costs",  label: "Costos de Software",  type: "number", hint: "USD" },
      { key: "variable_costs",  label: "Costos Variables",    type: "number", hint: "USD" },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    color: "bg-[#ffde21]",
    fields: [
      { key: "scheduled_calls",      label: "Llamadas Agendadas",     type: "number" },
      { key: "attended_calls",       label: "Llamadas Atendidas",     type: "number" },
      { key: "qualified_calls",      label: "Llamadas Calificadas",   type: "number" },
      { key: "aplications",          label: "Aplicaciones",           type: "number" },
      { key: "inbound_messages",     label: "Mensajes Entrantes",     type: "number" },
      { key: "offer_docs_sent",      label: "OfferDocs Enviados",     type: "number" },
      { key: "offer_docs_responded", label: "OfferDocs Respondidos",  type: "number" },
      { key: "cierres_por_offerdoc", label: "Cierres por OfferDoc",   type: "number" },
      { key: "new_clients",          label: "Nuevos Clientes",        type: "number", highlight: true },
      { key: "active_clients",       label: "Clientes Activos",       type: "number" },
      { key: "case_studies",         label: "Casos de Éxito",         type: "number", hint: "total acumulado" },
    ],
  },
  {
    key: "shortform",
    label: "Formato Corto",
    color: "bg-pink-500",
    fields: [
      { key: "short_followers", label: "Seguidores",         type: "number" },
      { key: "short_reach",     label: "Alcance",            type: "number" },
      { key: "short_posts",     label: "Posts Publicados",   type: "number" },
    ],
  },
  {
    key: "youtube",
    label: "YouTube",
    color: "bg-red-500",
    fields: [
      { key: "yt_subscribers",     label: "Suscriptores",              type: "number" },
      { key: "yt_new_subscribers", label: "Nuevos Suscriptores",       type: "number" },
      { key: "yt_monthly_audience",label: "Audiencia Mensual",         type: "number" },
      { key: "yt_views",           label: "Vistas",                    type: "number" },
      { key: "yt_watch_time",      label: "Tiempo de Reproducción (hs)",type: "number" },
      { key: "yt_videos",          label: "Videos Publicados",         type: "number" },
    ],
  },
  {
    key: "email",
    label: "Email",
    color: "bg-blue-500",
    fields: [
      { key: "email_subscribers",     label: "Total Subscribers",    type: "number" },
      { key: "email_new_subscribers", label: "Nuevos Suscriptores",  type: "number" },
      { key: "email_sent",            label: "Emails Sent",          type: "number" },
      { key: "email_open_rate",       label: "Open Rate (%)",        type: "number" },
    ],
  },
  {
    key: "reflection",
    label: "Reflection",
    color: "bg-foreground/30",
    fields: [
      { key: "biggest_win",    label: "Mayor Logro del Mes",                                    type: "text" },
      { key: "next_focus",     label: "Próximo Enfoque",                                        type: "text" },
      { key: "support_needed", label: "Soporte Necesario",                                      type: "text" },
      { key: "improvements",   label: "Mejoras",                                                type: "text" },
      { key: "nps_score",      label: "¿Cuánto recomendarías Smart Scale?",  type: "number", hint: "del 1 al 10", min: 1, max: 10 },
    ],
  },
] as const

type FormValues = Record<string, string>

// ─── Celebration overlay ──────────────────────────────────────────────────────

function CelebrationOverlay({
  name,
  month,
  onClose,
}: {
  name: string | null
  month: string
  onClose: () => void
}) {
  const [secs, setSecs] = useState(5)

  useEffect(() => {
    const t = setInterval(() => {
      setSecs(s => {
        if (s <= 1) { clearInterval(t); onClose(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [onClose])

  const monthLabel = (() => {
    try {
      return new Date(month.length === 7 ? `${month}-01` : month)
        .toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    } catch { return month }
  })()

  const firstName = name?.split(" ")[0] ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-sm overflow-hidden rounded-[14px] border border-foreground/[0.10] bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >

        <div className="relative space-y-6 px-8 py-10 text-center">
          {/* Animated icon */}
          <div className="relative mx-auto w-fit">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#ffde21]/10 ring-4 ring-[#ffde21]/20">
              <CheckCircle className="h-10 w-10 text-[#ffde21]" style={{ animation: "bounce 1.5s infinite" }} />
            </div>
            <Sparkles className="absolute -right-1 -top-1 h-5 w-5 animate-pulse text-[#ffde21]/70" />
            <Sparkles className="absolute -bottom-1 -left-1 h-4 w-4 animate-pulse text-[#ffde21]/40" style={{ animationDelay: "0.6s" }} />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              {firstName ? `¡Felicitaciones, ${firstName}!` : "¡Reporte completado!"}
            </h2>
            <p className="text-sm leading-relaxed text-foreground/60">
              Tu reporte de{" "}
              <span className="font-semibold capitalize text-foreground">{monthLabel}</span>{" "}
              está guardado.
            </p>
            <p className="text-xs text-foreground/35">
              Seguís construyendo tu Ecosistema Circular. 🔥
            </p>
          </div>

          {/* CTA with countdown */}
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-7 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe46b] active:scale-95"
          >
            Continuar
            <span className="text-xs font-normal text-black/40">({secs}s)</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm overwrite dialog ─────────────────────────────────────────────────

function ConfirmOverwriteDialog({
  month,
  onConfirm,
  onCancel,
}: {
  month: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative overflow-hidden rounded-[14px] border border-amber-200 dark:border-amber-400/20 bg-card shadow-2xl w-full max-w-md mx-4">
        <div className="relative p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 ring-1 ring-amber-400 dark:bg-amber-500/10 dark:ring-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/35 mb-1">Reporte existente</p>
              <h3 className="text-base font-semibold text-foreground">¿Reemplazar los datos?</h3>
              <p className="mt-1.5 text-sm text-foreground/50">
                Ya existe un reporte para <span className="font-semibold text-foreground/80">{month}</span>. Los datos actuales serán reemplazados por los que estás por guardar.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-5 py-2 text-sm font-medium text-foreground/70 transition hover:bg-foreground/[0.08] hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-black transition hover:bg-amber-400"
            >
              Sí, reemplazar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReportInputView() {
  // Reporte Mensual SIEMPRE se guarda en la cuenta del usuario logueado.
  // El read/write usa ownClientId; activeClientId solo se usa para mostrar
  // el aviso cuando admin está navegando como otro cliente.
  const ownClientId    = useOwnClient()
  const activeClientId = useActiveClient()
  const activeName     = useActiveClientName()
  const userRole       = useUserRole()
  const canTest        = isDeveloper(userRole)
  const isViewingOther = !!ownClientId && !!activeClientId && ownClientId !== activeClientId
  const ctxMonth = useSelectedMonth()
  const [tab, setTab] = useState<"form" | "history">("form")

  const [month, setMonth] = useState<string>(() => {
    const m = ctxMonth ?? new Date().toISOString().slice(0, 7)
    return /^\d{4}-\d{2}$/.test(m) ? m : m.slice(0, 7)
  })
  const [values, setValues] = useState<FormValues>({})
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState<string>("")
  const [existingData, setExistingData] = useState<Record<string, any> | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)

  // Load existing report for selected client+month
  useEffect(() => {
    if (!ownClientId || !month) return
    setLoadingExisting(true)
    setExistingData(null)
    setValues({})

    const monthValue = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month
    const supabase = createClient()

    supabase
      .from("monthly_reports")
      .select("*")
      .eq("client_id", ownClientId)
      .eq("month", monthValue)
      .maybeSingle()
      .then(({ data }) => {
        setExistingData(data ?? null)
        if (data) {
          const prefilled: FormValues = {}
          for (const group of FIELD_GROUPS) {
            for (const field of group.fields) {
              const v = data[field.key]
              if (v !== null && v !== undefined) prefilled[field.key] = String(v)
            }
          }
          setValues(prefilled)
        }
        setLoadingExisting(false)
      })
      .catch(() => setLoadingExisting(false))
  }, [ownClientId, month])

  const setValue = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }))
  }

  // Called after confirmation (or directly if no existing data).
  // Acepta un set de valores explícito (usado por el botón "Testear").
  const doSave = async (valuesOverride?: FormValues) => {
    setShowConfirm(false)
    setStatus("loading")
    setMessage("")

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setStatus("error")
        setMessage("Sesión expirada. Volvé a iniciar sesión.")
        return
      }

      const body: Record<string, unknown> = { client_id: ownClientId, month }
      for (const [key, raw] of Object.entries(valuesOverride ?? values)) {
        if (raw !== "" && raw !== null && raw !== undefined) body[key] = raw
      }

      const res = await fetch("/api/monthly-reports/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setMessage(data?.error ?? "Error al guardar el reporte.")
        return
      }

      setStatus("success")
      setExistingData(data.report)
      setShowCelebration(true)
      const eventsMsg = data.events_enqueued > 0
        ? ` ${data.events_enqueued} notificación(es) enviadas.`
        : ""
      setMessage(`Reporte guardado exitosamente.${eventsMsg}`)
      setTimeout(() => setStatus("idle"), 5000)
    } catch (err: any) {
      setStatus("error")
      setMessage(err?.message ?? "Error inesperado.")
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownClientId) {
      setStatus("error")
      setMessage("No hay cliente seleccionado. Elegí un cliente en la barra superior.")
      return
    }
    if (!month) {
      setStatus("error")
      setMessage("Seleccioná un mes antes de guardar.")
      return
    }
    // If data already exists, ask for confirmation first
    if (existingData) {
      setShowConfirm(true)
      return
    }
    doSave()
  }

  // Solo developer: llena el form con datos ficticios y guarda directo
  // (sin pasar por el diálogo de confirmación de sobreescritura).
  const handleTest = async () => {
    if (!ownClientId || !month || status === "loading") return
    const fake = fakeMonthlyReport()
    setValues(fake)
    await doSave(fake)
  }

  const isUpdate = Boolean(existingData)

  return (
    <>
      {showCelebration && (
        <CelebrationOverlay
          name={activeName}
          month={month}
          onClose={() => setShowCelebration(false)}
        />
      )}
      {/* Tab switcher */}
      <div className="flex gap-1 mb-8 rounded-xl border border-foreground/[0.06] bg-card p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("form")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "form"
              ? "bg-[#ffde21] text-black"
              : "text-foreground/40 hover:text-foreground/70"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Cargar Reporte
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "history"
              ? "bg-[#ffde21] text-black"
              : "text-foreground/40 hover:text-foreground/70"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          Historial
        </button>
      </div>

      {tab === "history" && <ReportHistoryView />}

      {tab === "form" && <>
      {showConfirm && (
        <ConfirmOverwriteDialog
          month={month}
          onConfirm={() => doSave()}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">
              Cargar Reporte Mensual
            </h1>
          </div>
          <p className="text-xs text-foreground/30 ml-[18px]">
            {isUpdate ? "Actualizando reporte existente" : "Nuevo reporte"} · Supabase → Slack
          </p>
        </div>

        {/* Aviso si admin está viendo otro cliente */}
        {isViewingOther && (
          <div className="flex items-start gap-3 rounded-[14px] border border-[#ffde21]/25 bg-[#ffde21]/[0.05] px-4 py-3">
            <Eye className="h-4 w-4 text-[#ffde21] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffde21]/80">Aviso · este reporte es tuyo</p>
              <p className="text-[13px] text-foreground/75 mt-0.5">
                Estás navegando como <span className="font-semibold text-foreground">{activeName ?? "otro cliente"}</span>, pero este formulario siempre carga y guarda en tu propia cuenta. Si querés que sea para otro perfil, primero pedile que lo cargue desde su cuenta.
              </p>
            </div>
          </div>
        )}

        {/* Month + client selector */}
        <div className="relative overflow-hidden rounded-[14px] border border-foreground/[0.07] bg-card p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.04),transparent_55%)]" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/35 mb-1.5">Mes del reporte</p>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-2 text-sm font-semibold text-foreground focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20 [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {loadingExisting && (
                <span className="flex items-center gap-1.5 rounded-full border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-1 text-[10px] text-foreground/40">
                  <Loader2 className="h-3 w-3 animate-spin" />Cargando…
                </span>
              )}
              {!loadingExisting && isUpdate && (
                <span className="rounded-full border border-amber-400 bg-amber-100 text-amber-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-400">
                  Reporte existente — se sobreescribirá
                </span>
              )}
              {!loadingExisting && !isUpdate && ownClientId && (
                <span className="rounded-full border border-emerald-400 bg-emerald-100 text-emerald-800 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                  Nuevo reporte
                </span>
              )}
              {!ownClientId && (
                <span className="rounded-full border border-red-400 bg-red-100 text-red-800 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-400">
                  Sin cliente seleccionado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Field groups */}
        {FIELD_GROUPS.map((group) => (
          <div key={group.key} className="relative overflow-hidden rounded-[14px] border border-foreground/[0.07] bg-card">
            <div className="flex items-center justify-between border-b border-foreground/[0.05] px-5 py-3">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-[2px] rounded-full ${group.color}`} />
                <span className="text-sm font-semibold uppercase tracking-widest text-foreground/75">{group.label}</span>
              </div>
              <span className="text-[10px] text-foreground/25">{group.fields.length} campos</span>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.fields.map((field) => {
                const isHighlight = "highlight" in field && field.highlight
                const isNps = field.key === "nps_score"

                if (isNps) {
                  return (
                    <div key={field.key} className="sm:col-span-2 lg:col-span-3 flex flex-col gap-2 rounded-[14px] border border-[#ffde21]/15 bg-[#ffde21]/[0.03] p-5">
                      <label className="text-xs font-semibold uppercase tracking-widest text-foreground/65">
                        {field.label}
                        <span className="ml-1.5 text-foreground/35 normal-case tracking-normal font-normal">— del 1 al 10</span>
                      </label>
                      <div className="flex items-center gap-3 flex-wrap">
                        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setValue(field.key, String(n))}
                            className={`h-10 w-10 rounded-xl text-sm font-bold transition-all ${
                              values[field.key] === String(n)
                                ? "bg-[#ffde21] text-black"
                                : "border border-foreground/[0.08] bg-foreground/[0.03] text-foreground/50 hover:border-[#ffde21]/30 hover:text-foreground"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                        {values[field.key] && (
                          <button
                            type="button"
                            onClick={() => setValue(field.key, "")}
                            className="ml-2 text-xs text-foreground/25 hover:text-foreground/50 transition-colors"
                          >
                            limpiar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-foreground/65">
                      {field.label}
                      {"hint" in field && field.hint && (
                        <span className="ml-1 text-foreground/40 normal-case tracking-normal font-normal text-xs">({field.hint})</span>
                      )}
                    </label>
                    {field.type === "text" ? (
                      <textarea
                        value={values[field.key] ?? ""}
                        onChange={(e) => setValue(field.key, e.target.value)}
                        rows={2}
                        placeholder="—"
                        className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2 text-base text-foreground placeholder:text-foreground/20 focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20"
                      />
                    ) : (
                      <input
                        type="number"
                        value={values[field.key] ?? ""}
                        onChange={(e) => setValue(field.key, e.target.value)}
                        placeholder="0"
                        min={"min" in field ? field.min : 0}
                        step="any"
                        className={`w-full rounded-xl border px-3 py-2 text-base font-semibold text-foreground placeholder:text-foreground/20 focus:outline-none focus:ring-1 ${
                          isHighlight
                            ? "border-[#ffde21]/20 bg-[#ffde21]/[0.04] focus:border-[#ffde21]/40 focus:ring-[#ffde21]/20"
                            : "border-foreground/[0.08] bg-foreground/[0.04] focus:border-[#ffde21]/40 focus:ring-[#ffde21]/20"
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Status banner */}
        {status !== "idle" && status !== "loading" && (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            status === "success"
              ? "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-red-400 bg-red-100 text-red-900 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"
          }`}>
            {status === "success"
              ? <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            }
            <span>{message}</span>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3 pb-6">
          <button
            type="submit"
            disabled={status === "loading" || !ownClientId}
            className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe46b] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === "loading" ? "Guardando…" : isUpdate ? "Actualizar reporte" : "Guardar reporte"}
          </button>
          {canTest && (
            <button
              type="button"
              onClick={handleTest}
              disabled={status === "loading" || !ownClientId}
              title="Solo developer: guarda un reporte con datos ficticios"
              className="flex items-center gap-2 rounded-xl border border-foreground/15 bg-foreground/[0.04] px-5 py-2.5 text-sm font-bold text-foreground/70 transition hover:bg-foreground/[0.08] hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FlaskConical className="h-4 w-4" />
              Testear
            </button>
          )}
          <p className="text-xs text-foreground/25">
            Los datos se guardan primero en Supabase. Las notificaciones van en segundo plano.
          </p>
        </div>
      </form>
      </>}
    </>
  )
}
