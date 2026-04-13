"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient, useSelectedMonth } from "@/components/layout/dashboard-layout"
import { CheckCircle, AlertCircle, Loader2, AlertTriangle, History, FileText } from "lucide-react"
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
      { key: "email_subscribers",     label: "Suscriptores",         type: "number" },
      { key: "email_new_subscribers", label: "Nuevos Suscriptores",  type: "number" },
    ],
  },
  {
    key: "reflection",
    label: "Reflection",
    color: "bg-white/30",
    fields: [
      { key: "biggest_win",    label: "Mayor Logro del Mes",                                    type: "text" },
      { key: "next_focus",     label: "Próximo Enfoque",                                        type: "text" },
      { key: "support_needed", label: "Soporte Necesario",                                      type: "text" },
      { key: "improvements",   label: "Mejoras",                                                type: "text" },
      { key: "nps_score",      label: "¿Del 1 al 10, cuánto recomendarías Smart Scale?",        type: "number", hint: "1 a 10", min: 1 },
    ],
  },
] as const

type FormValues = Record<string, string>

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
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-[#111113] shadow-2xl w-full max-w-md mx-4">
        <div className="h-[2px] w-full bg-gradient-to-r from-amber-500/20 via-amber-500/60 to-amber-500/20" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.04),transparent_55%)]" />
        <div className="relative p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1">Reporte existente</p>
              <h3 className="text-base font-semibold text-white">¿Reemplazar los datos?</h3>
              <p className="mt-1.5 text-sm text-white/50">
                Ya existe un reporte para <span className="font-semibold text-white/80">{month}</span>. Los datos actuales serán reemplazados por los que estás por guardar.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
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
  const activeClientId = useActiveClient()
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

  // Load existing report for selected client+month
  useEffect(() => {
    if (!activeClientId || !month) return
    setLoadingExisting(true)
    setExistingData(null)
    setValues({})

    const monthValue = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month
    const supabase = createClient()

    supabase
      .from("monthly_reports")
      .select("*")
      .eq("client_id", activeClientId)
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
  }, [activeClientId, month])

  const setValue = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }))
  }

  // Called after confirmation (or directly if no existing data)
  const doSave = async () => {
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

      const body: Record<string, unknown> = { client_id: activeClientId, month }
      for (const [key, raw] of Object.entries(values)) {
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
    if (!activeClientId) {
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

  const isUpdate = Boolean(existingData)

  return (
    <>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-8 rounded-xl border border-white/[0.06] bg-[#111113] p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("form")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "form"
              ? "bg-[#ffde21] text-black"
              : "text-white/40 hover:text-white/70"
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
              : "text-white/40 hover:text-white/70"
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
          onConfirm={doSave}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <h1 className="text-sm font-semibold uppercase tracking-widest text-white/70">
              Cargar Reporte Mensual
            </h1>
          </div>
          <p className="text-xs text-white/30 ml-[18px]">
            {isUpdate ? "Actualizando reporte existente" : "Nuevo reporte"} · Supabase → Slack → Airtable
          </p>
        </div>

        {/* Month + client selector */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.04),transparent_55%)]" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1.5">Mes del reporte</p>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20 [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {loadingExisting && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] text-white/40">
                  <Loader2 className="h-3 w-3 animate-spin" />Cargando…
                </span>
              )}
              {!loadingExisting && isUpdate && (
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                  Reporte existente — se sobreescribirá
                </span>
              )}
              {!loadingExisting && !isUpdate && activeClientId && (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                  Nuevo reporte
                </span>
              )}
              {!activeClientId && (
                <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-red-400">
                  Sin cliente seleccionado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Field groups */}
        {FIELD_GROUPS.map((group) => (
          <div key={group.key} className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
            <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-[2px] rounded-full ${group.color}`} />
                <span className="text-sm font-semibold uppercase tracking-widest text-white/75">{group.label}</span>
              </div>
              <span className="text-[10px] text-white/25">{group.fields.length} campos</span>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.fields.map((field) => {
                const isHighlight = "highlight" in field && field.highlight
                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-white/65">
                      {field.label}
                      {"hint" in field && field.hint && (
                        <span className="ml-1 text-white/40 normal-case tracking-normal font-normal text-xs">({field.hint})</span>
                      )}
                    </label>
                    {field.type === "text" ? (
                      <textarea
                        value={values[field.key] ?? ""}
                        onChange={(e) => setValue(field.key, e.target.value)}
                        rows={2}
                        placeholder="—"
                        className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-base text-white placeholder:text-white/20 focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20"
                      />
                    ) : (
                      <input
                        type="number"
                        value={values[field.key] ?? ""}
                        onChange={(e) => setValue(field.key, e.target.value)}
                        placeholder="0"
                        min={"min" in field ? field.min : 0}
                        step="any"
                        className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold text-white placeholder:text-white/20 focus:outline-none focus:ring-1 ${
                          isHighlight
                            ? "border-[#ffde21]/20 bg-[#ffde21]/[0.04] focus:border-[#ffde21]/40 focus:ring-[#ffde21]/20 text-base"
                            : "border-white/[0.08] bg-white/[0.04] focus:border-[#ffde21]/40 focus:ring-[#ffde21]/20 text-base"
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
              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/20 bg-red-500/10 text-red-200"
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
            disabled={status === "loading" || !activeClientId}
            className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe46b] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === "loading" ? "Guardando…" : isUpdate ? "Actualizar reporte" : "Guardar reporte"}
          </button>
          <p className="text-xs text-white/25">
            Los datos se guardan primero en Supabase. Las notificaciones van en segundo plano.
          </p>
        </div>
      </form>
      </>}
    </>
  )
}
