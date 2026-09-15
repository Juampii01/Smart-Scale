"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { useOwnClient, useActiveClient, useActiveClientName, useSelectedMonth, useUserRole } from "@/components/layout/dashboard-layout"
import { isDeveloper } from "@/lib/auth/permissions"
import { fakeMonthlyReport } from "@/lib/dev-test-data"
import { STEPS, type ReportFieldDef } from "@/lib/monthly-report-fields"
import {
  CheckCircle, AlertCircle, Loader2, AlertTriangle, History, FileText, Eye,
  FlaskConical, Sparkles, ChevronDown, ChevronLeft, ChevronRight, Pencil,
} from "lucide-react"
import { ReportHistoryView } from "@/components/views/report-history-view"

type FormValues = Record<string, string>
type ManualOverrides = Record<string, boolean>
type PrefillField = { value: number; source: string } | { value: null; reason: string }
type PrefillResponse = {
  cash_collected: PrefillField
  mrr: PrefillField
  new_clients: PrefillField
  active_clients: PrefillField
}

const AUTO_DB_KEYS = ["cash_collected", "mrr", "new_clients", "active_clients"] as const
const AUTO_DELTA_KEYS = ["yt_new_subscribers", "email_new_subscribers"] as const
const DELTA_TOTAL_OF: Record<string, string> = {
  yt_new_subscribers: "yt_subscribers",
  email_new_subscribers: "email_subscribers",
}

function draftKey(clientId: string, month: string) {
  return `monthly-report-draft:${clientId}:${month}`
}

function prevMonthOf(month: string): string {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabelOf(month: string): string {
  try {
    return new Date(`${month}-01`).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
  } catch {
    return month
  }
}

/** Vacío nunca frena — solo lo inválido: negativo, o fuera de min/max (ej. porcentaje). */
function fieldError(field: ReportFieldDef, raw: string | undefined): string | null {
  if (field.type !== "number") return null
  if (raw === undefined || raw === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return "Tiene que ser un número."
  if (n < 0) return "No puede ser negativo."
  if (field.min !== undefined && n < field.min) return `Mínimo ${field.min}.`
  if (field.max !== undefined && n > field.max) return `Máximo ${field.max}.`
  return null
}

function allFieldsOfStep(step: (typeof STEPS)[number]): ReportFieldDef[] {
  return [
    ...(step.trackedFields ?? []),
    ...step.manualFields,
    ...(step.foldedBlock?.fields ?? []),
    ...(step.additionalFields ?? []),
  ]
}

function stepHasErrors(step: (typeof STEPS)[number], values: FormValues): boolean {
  return allFieldsOfStep(step).some((f) => fieldError(f, values[f.key]) !== null)
}

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

  const monthLabel = monthLabelOf(month.length === 7 ? month : month.slice(0, 7))
  const firstName = name?.split(" ")[0] ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-sm overflow-hidden rounded-[14px] border border-border bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative space-y-6 px-8 py-10 text-center">
          <div className="relative mx-auto w-fit">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft ring-4 ring-accent/20">
              <CheckCircle className="h-10 w-10 text-accent-ink" style={{ animation: "bounce 1.5s infinite" }} />
            </div>
            <Sparkles className="absolute -right-1 -top-1 h-5 w-5 animate-pulse text-accent-ink/70" />
            <Sparkles className="absolute -bottom-1 -left-1 h-4 w-4 animate-pulse text-accent-ink/40" style={{ animationDelay: "0.6s" }} />
          </div>

          <div className="space-y-2">
            <h2 className="text-[24px] font-extrabold tracking-tight text-foreground">
              {firstName ? `¡Felicitaciones, ${firstName}!` : "¡Reporte completado!"}
            </h2>
            <p className="text-[13px] leading-relaxed text-text-2">
              Tu reporte de{" "}
              <span className="font-semibold capitalize text-foreground">{monthLabel}</span>{" "}
              está guardado.
            </p>
            <p className="text-[13px] text-text-3">
              Seguís construyendo tu Ecosistema Circular. 🔥
            </p>
          </div>

          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl btn-accent px-7 py-2.5 text-[13px] font-bold transition active:scale-95"
          >
            Continuar
            <span className="text-[13px] font-normal text-black/40">({secs}s)</span>
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
              <p className="text-[11px] font-semibold uppercase tracking-widest text-text-3 mb-1">Reporte existente</p>
              <h3 className="text-[15px] font-semibold text-foreground">¿Reemplazar los datos?</h3>
              <p className="mt-1.5 text-[13px] text-text-2">
                Ya existe un reporte para <span className="font-semibold text-foreground">{month}</span>. Los datos actuales serán reemplazados por los que estás por guardar.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-border bg-secondary px-5 py-2 text-[13px] font-medium text-foreground transition hover:bg-secondary hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-xl bg-amber-500 px-5 py-2 text-[13px] font-bold text-black transition hover:bg-amber-400"
            >
              Sí, reemplazar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Slider 0–10 (o 1–10) — input[type=range] real, siempre con perilla ──────

const SLIDER_DEFAULT = 7

function SliderField({
  field,
  value,
  onChange,
  color,
}: {
  field: ReportFieldDef
  value: string | undefined
  onChange: (v: string) => void
  color: string
}) {
  const min = field.slider!.min
  const max = field.slider!.max
  const hasValue = value !== undefined && value !== ""
  const n = hasValue ? Number(value) : SLIDER_DEFAULT
  const pct = ((n - min) / (max - min)) * 100

  return (
    <div className="sm:col-span-2 lg:col-span-3 flex flex-col gap-2">
      <label className="text-[12.5px] font-semibold uppercase tracking-wide text-white/60">
        {field.label} <span className="normal-case font-normal text-white/35">— del {min} al {max}</span>
      </label>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={n}
          onChange={(e) => onChange(e.target.value)}
          className="report-slider flex-1"
          style={{ ["--hue" as any]: color, ["--p" as any]: `${pct}%` }}
        />
        <span className={`w-10 text-right text-[26px] font-extrabold tabular-nums ${hasValue ? "text-white" : "text-white/35"}`}>
          {n}
        </span>
      </div>
      <div className="flex justify-between text-[11px] font-semibold uppercase tracking-widest text-white/30">
        <span>Baja</span>
        <span>Alta</span>
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
  const [manualOverrides, setManualOverrides] = useState<ManualOverrides>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState<string>("")
  const [existingData, setExistingData] = useState<Record<string, any> | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [prefill, setPrefill] = useState<PrefillResponse | null>(null)
  const [prevMonthValues, setPrevMonthValues] = useState<{ yt_subscribers: number | null; email_subscribers: number | null } | null>(null)
  const [openAdditional, setOpenAdditional] = useState<Record<string, boolean>>({})
  const [foldedOpen, setFoldedOpen] = useState<Record<string, boolean>>({})

  const restoredFromDraftRef = useRef(false)

  const setValue = (key: string, val: string) => setValues((prev) => ({ ...prev, [key]: val }))
  const editAuto = (key: string) => setManualOverrides((prev) => ({ ...prev, [key]: true }))

  // ── Restaurar borrador (localStorage) — antes de que llegue el reporte
  // guardado, para que un F5 en medio de la carga no pierda nada (client_id + month).
  useEffect(() => {
    restoredFromDraftRef.current = false
    if (!ownClientId || !month || typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(draftKey(ownClientId, month))
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft && typeof draft === "object") {
          setValues(draft.values ?? {})
          setManualOverrides(draft.manualOverrides ?? {})
          setStepIndex(typeof draft.stepIndex === "number" ? draft.stepIndex : 0)
          restoredFromDraftRef.current = true
        }
      }
    } catch {
      // localStorage puede fallar (modo privado, cuota) — no rompe el form.
    }
  }, [ownClientId, month])

  // ── Cargar reporte existente para cliente+mes ───────────────────────────
  useEffect(() => {
    if (!ownClientId || !month) return
    setLoadingExisting(true)
    setExistingData(null)
    if (!restoredFromDraftRef.current) setValues({})

    const monthValue = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month
    const supabase = createClient()

    ;(async () => {
      try {
        const { data } = await supabase
          .from("monthly_reports")
          .select("*")
          .eq("client_id", ownClientId)
          .eq("month", monthValue)
          .maybeSingle()

        setExistingData(data ?? null)
        if (data && !restoredFromDraftRef.current) {
          const prefilled: FormValues = {}
          for (const step of STEPS) {
            for (const field of allFieldsOfStep(step)) {
              const v = data[field.key]
              if (v !== null && v !== undefined) prefilled[field.key] = String(v)
            }
          }
          setValues(prefilled)
          // Un campo guardado como "manual" (pisado a mano) se respeta y no
          // se vuelve a auto-completar al reabrir el reporte.
          const sources = data.field_sources
          if (sources && typeof sources === "object") {
            const overrides: ManualOverrides = {}
            for (const [key, src] of Object.entries(sources)) {
              if (src === "manual") overrides[key] = true
            }
            setManualOverrides(overrides)
          }
        }
      } catch {
        // ignorar — el reporte queda en blanco si la carga falla
      } finally {
        setLoadingExisting(false)
      }
    })()
  }, [ownClientId, month])

  // ── Mes anterior (para yt_new_subscribers / email_new_subscribers) ─────
  useEffect(() => {
    if (!ownClientId || !month) { setPrevMonthValues(null); return }
    const supabase = createClient()
    const prevMonthValue = `${prevMonthOf(month)}-01`

    ;(async () => {
      try {
        const { data } = await supabase
          .from("monthly_reports")
          .select("yt_subscribers, email_subscribers")
          .eq("client_id", ownClientId)
          .eq("month", prevMonthValue)
          .maybeSingle()
        setPrevMonthValues(data ? { yt_subscribers: data.yt_subscribers, email_subscribers: data.email_subscribers } : { yt_subscribers: null, email_subscribers: null })
      } catch {
        setPrevMonthValues(null)
      }
    })()
  }, [ownClientId, month])

  // ── Prefill de cash_collected / mrr / new_clients / active_clients ─────
  // Solo interno (admin/team/setter) — resolveInternalScope del lado del
  // server. Para un cliente normal esto va a devolver 403 y el catch lo
  // deja en null: los campos quedan manuales, sin mostrar ningún error.
  useEffect(() => {
    if (!ownClientId || !month) { setPrefill(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) { if (!cancelled) setPrefill(null); return }
        const res = await fetch(`/api/monthly-reports/prefill?month=${month}&client_id=${ownClientId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) { if (!cancelled) setPrefill(null); return }
        const json = await res.json()
        if (!cancelled) setPrefill(json)
      } catch {
        if (!cancelled) setPrefill(null)
      }
    })()
    return () => { cancelled = true }
  }, [ownClientId, month])

  // Aplica el prefill como valor por defecto — solo si el campo está vacío
  // y no fue pisado a mano.
  useEffect(() => {
    if (!prefill) return
    setValues((prev) => {
      const next = { ...prev }
      for (const key of AUTO_DB_KEYS) {
        if (manualOverrides[key]) continue
        if (next[key] !== undefined && next[key] !== "") continue
        const field = prefill[key]
        if (field && field.value !== null) next[key] = String(field.value)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, manualOverrides])

  // Recalcula en vivo yt_new_subscribers / email_new_subscribers contra el
  // mes anterior mientras la persona escribe el total del mes. Nunca
  // muestra un 0 calculado como si fuera un dato: si falta el mes anterior
  // o el total de este mes, queda en blanco y editable.
  useEffect(() => {
    if (!prevMonthValues) return
    setValues((prev) => {
      const next = { ...prev }
      for (const deltaKey of AUTO_DELTA_KEYS) {
        if (manualOverrides[deltaKey]) continue
        const totalKey = DELTA_TOTAL_OF[deltaKey]
        const prevTotal = prevMonthValues[totalKey as keyof typeof prevMonthValues]
        const currentRaw = prev[totalKey]
        if (currentRaw === undefined || currentRaw === "" || prevTotal === null || prevTotal === undefined) {
          if (next[deltaKey] !== undefined) delete next[deltaKey]
          continue
        }
        const currentTotal = Number(currentRaw)
        if (!Number.isFinite(currentTotal)) continue
        next[deltaKey] = String(currentTotal - prevTotal)
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.yt_subscribers, values.email_subscribers, prevMonthValues, manualOverrides])

  // ── Borrador automático (localStorage) ──────────────────────────────────
  useEffect(() => {
    if (!ownClientId || !month || typeof window === "undefined") return
    try {
      window.localStorage.setItem(
        draftKey(ownClientId, month),
        JSON.stringify({ values, manualOverrides, stepIndex, savedAt: Date.now() })
      )
    } catch {
      // ignorar — el borrador es una conveniencia, no algo crítico.
    }
  }, [ownClientId, month, values, manualOverrides, stepIndex])

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

      const effectiveValues = valuesOverride ?? values
      const body: Record<string, unknown> = { client_id: ownClientId, month }
      for (const [key, raw] of Object.entries(effectiveValues)) {
        if (raw !== "" && raw !== null && raw !== undefined) body[key] = raw
      }

      // Registro de qué campos automáticos quedaron auto vs. pisados a mano
      // — sin esto no se puede saber después por qué un número no coincide.
      const fieldSources: Record<string, "auto" | "manual"> = {}
      for (const key of [...AUTO_DB_KEYS, ...AUTO_DELTA_KEYS]) {
        const raw = effectiveValues[key]
        if (raw === undefined || raw === "") continue
        fieldSources[key] = manualOverrides[key] ? "manual" : "auto"
      }
      if (Object.keys(fieldSources).length > 0) body.field_sources = fieldSources

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
      if (ownClientId && typeof window !== "undefined") {
        try { window.localStorage.removeItem(draftKey(ownClientId, month)) } catch { /* ignore */ }
      }
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
  const currentStep = STEPS[stepIndex]
  const isLastStep = stepIndex === STEPS.length - 1
  const canGoNext = !stepHasErrors(currentStep, values)
  const monthLabel = monthLabelOf(month)

  const goNext = () => { if (!canGoNext) return; setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)) }
  const goPrev = () => setStepIndex((i) => Math.max(i - 1, 0))

  // ── Render de un campo (número / texto / auto) ──────────────────────────
  const renderField = (field: ReportFieldDef, color: string) => {
    if (field.slider) {
      return (
        <SliderField
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(v) => setValue(field.key, v)}
          color={color}
        />
      )
    }

    const isAutoDb = field.auto === "db"
    const isAutoDelta = field.auto === "delta"
    const isManual = !!manualOverrides[field.key]
    const dbPrefillField = isAutoDb ? prefill?.[field.key as (typeof AUTO_DB_KEYS)[number]] : undefined
    // Sin fuente (cliente normal sin acceso al prefill, o el prefill no
    // encontró datos para este tenant): se muestra como campo manual común.
    const dbUnavailable = isAutoDb && (!prefill || dbPrefillField?.value === null || dbPrefillField === undefined)
    const showAutoUi = (isAutoDb || isAutoDelta) && !isManual && !dbUnavailable && values[field.key] !== undefined && values[field.key] !== ""
    const err = fieldError(field, values[field.key])

    return (
      <div key={field.key} className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-semibold uppercase tracking-wide text-white/60">
          {field.label}
          {field.hint && <span className="ml-1 normal-case tracking-normal font-normal text-white/35">({field.hint})</span>}
        </label>

        {field.type === "text" ? (
          <textarea
            value={values[field.key] ?? ""}
            onChange={(e) => setValue(field.key, e.target.value)}
            rows={2}
            placeholder="—"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[16px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1"
            style={{ ["--tw-ring-color" as any]: color }}
          />
        ) : showAutoUi ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <span className="text-[16px] font-bold text-white tabular-nums">
              {Number(values[field.key]).toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => editAuto(field.key)}
              className="flex items-center gap-1 text-[12.5px] font-medium text-white/60 transition-colors hover:text-white"
            >
              <Pencil className="h-3 w-3" /> editar
            </button>
          </div>
        ) : (
          <input
            type="number"
            value={values[field.key] ?? ""}
            onChange={(e) => setValue(field.key, e.target.value)}
            placeholder="0"
            step="any"
            className="w-full rounded-xl border bg-white/5 px-3 py-2 text-[16px] font-semibold text-white placeholder:text-white/30 focus:outline-none focus:ring-1"
            style={{ borderColor: err ? "#f87171" : "rgba(255,255,255,0.12)", ["--tw-ring-color" as any]: color }}
          />
        )}

        {err && <span className="text-[12.5px] text-red-400">{err}</span>}

        {showAutoUi && isAutoDb && dbPrefillField?.value !== null && (
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">AUTO</span>
            <span className="text-[12.5px] text-white/45">{(dbPrefillField as { source: string }).source}</span>
          </div>
        )}
        {showAutoUi && isAutoDelta && (
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">AUTO</span>
            <span className="text-[12.5px] text-white/45">Calculado: este mes − mes anterior</span>
          </div>
        )}
        {isAutoDb && !showAutoUi && !isManual && prefill && dbPrefillField && dbPrefillField.value === null && (
          <span className="text-[12.5px] text-white/35">{dbPrefillField.reason}</span>
        )}
      </div>
    )
  }

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
      <div className="flex gap-1 mb-8 rounded-xl border border-border bg-card p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("form")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
            tab === "form"
              ? "bg-secondary text-foreground"
              : "text-text-2 hover:text-foreground"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Cargar Reporte
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
            tab === "history"
              ? "bg-secondary text-foreground"
              : "text-text-2 hover:text-foreground"
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="h-4 w-[3px] rounded-full bg-accent" />
            <h1 className="text-[13px] font-semibold uppercase tracking-widest text-foreground">
              Cargar Reporte Mensual
            </h1>
          </div>
          <p className="text-[13px] text-text-3 ml-[18px]">
            {isUpdate ? "Actualizando reporte existente" : "Nuevo reporte"} · Supabase → Slack
          </p>
        </div>

        {/* Aviso si admin está viendo otro cliente */}
        {isViewingOther && (
          <div className="flex items-start gap-3 rounded-[14px] border border-accent/20 bg-accent-soft px-4 py-3">
            <Eye className="h-4 w-4 text-accent-ink flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-ink/80">Aviso · este reporte es tuyo</p>
              <p className="text-[13px] text-foreground mt-0.5">
                Estás navegando como <span className="font-semibold text-foreground">{activeName ?? "otro cliente"}</span>, pero este formulario siempre carga y guarda en tu propia cuenta. Si querés que sea para otro perfil, primero pedile que lo cargue desde su cuenta.
              </p>
            </div>
          </div>
        )}

        {/* Fondo negro — pedido textual de Ann: "que quede bien negro el fondo",
            letra más grande, un color por etapa. Envuelve desde el selector de
            mes hasta la navegación de pasos; el resto de la pantalla (tabs,
            header, banners) sigue el theme normal del sitio. */}
        <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[#0a0a0c] p-5 sm:p-7 space-y-6">
          {/* Mes + estado */}
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">Mes del reporte</p>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-[14px] font-semibold text-white focus:outline-none focus:ring-1 focus:ring-white/30 [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {loadingExisting && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] text-white/60">
                  <Loader2 className="h-3 w-3 animate-spin" />Cargando…
                </span>
              )}
              {!loadingExisting && isUpdate && (
                <span className="rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-400 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
                  Reporte existente — se sobreescribirá
                </span>
              )}
              {!loadingExisting && !isUpdate && ownClientId && (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-400 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
                  Nuevo reporte
                </span>
              )}
              {!ownClientId && (
                <span className="rounded-full border border-red-400/30 bg-red-500/10 text-red-400 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
                  Sin cliente seleccionado
                </span>
              )}
            </div>
          </div>

          {/* Barra de pasos */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const state = i < stepIndex ? "done" : i === stepIndex ? "current" : "pending"
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStepIndex(i)}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
                  style={
                    state === "current"
                      ? { backgroundColor: s.color, color: "#000" }
                      : state === "done"
                      ? { backgroundColor: `${s.color}26`, color: s.color }
                      : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }
                  }
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                    style={state === "current" ? { backgroundColor: "rgba(0,0,0,0.2)" } : { backgroundColor: "rgba(255,255,255,0.1)" }}
                  >
                    {state === "done" ? "✓" : s.number}
                  </span>
                  {s.name}
                </button>
              )
            })}
          </div>

          {/* Contenido del paso */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold"
                  style={{ backgroundColor: currentStep.color, color: "#000" }}
                >
                  {currentStep.number}
                </span>
                <h2 className="text-[26px] sm:text-[30px] font-extrabold leading-tight text-white">
                  {currentStep.name}
                  {currentStep.subtitle && <span className="ml-2 text-[15px] font-medium text-white/40">· {currentStep.subtitle}</span>}
                </h2>
              </div>
              <p className="text-[15px] text-white/55 sm:ml-[52px]">{currentStep.description}</p>
            </div>

            {currentStep.trackedFields && currentStep.trackedFields.length > 0 && (
              <div className="rounded-2xl border p-5" style={{ borderColor: `${currentStep.color}40` }}>
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentStep.color }} />
                  <span className="text-[13px] font-semibold uppercase tracking-widest text-white/70">{currentStep.trackedTitle}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {currentStep.trackedFields.map((f) => renderField(f, currentStep.color))}
                </div>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {currentStep.manualFields.map((f) => renderField(f, currentStep.color))}
            </div>

            {currentStep.foldedBlock && (
              <div className="rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setFoldedOpen((p) => ({ ...p, [currentStep.key]: !p[currentStep.key] }))}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left"
                >
                  <span className="text-[14px] font-semibold text-white/80">{currentStep.foldedBlock.title}</span>
                  <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${foldedOpen[currentStep.key] ? "rotate-180" : ""}`} />
                </button>
                {foldedOpen[currentStep.key] && (
                  <div className="grid gap-4 border-t border-white/10 p-5 sm:grid-cols-2">
                    {currentStep.foldedBlock.fields.map((f) => renderField(f, currentStep.color))}
                  </div>
                )}
              </div>
            )}

            {currentStep.additionalFields && currentStep.additionalFields.length > 0 && (
              <div className="rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setOpenAdditional((p) => ({ ...p, [currentStep.key]: !p[currentStep.key] }))}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left"
                >
                  <span className="text-[14px] font-semibold text-white/80">Campos adicionales</span>
                  <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${openAdditional[currentStep.key] ? "rotate-180" : ""}`} />
                </button>
                {openAdditional[currentStep.key] && (
                  <div className="grid gap-4 border-t border-white/10 p-5 sm:grid-cols-2">
                    {currentStep.additionalFields.map((f) => renderField(f, currentStep.color))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navegación */}
          <div className="flex items-center justify-between border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={goPrev}
              disabled={stepIndex === 0}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-semibold text-white/70 transition disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> Atrás
            </button>
            <span className="text-[12.5px] text-white/40">Paso {stepIndex + 1} de {STEPS.length}</span>
            {isLastStep ? (
              <button
                type="submit"
                disabled={status === "loading" || !ownClientId || !canGoNext}
                className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-bold transition disabled:opacity-50"
                style={{ backgroundColor: currentStep.color, color: "#000" }}
              >
                {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                {status === "loading" ? "Guardando…" : `Enviar reporte de ${monthLabel}`}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext}
                className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-bold transition disabled:opacity-40"
                style={{ backgroundColor: currentStep.color, color: "#000" }}
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Status banner */}
        {status !== "idle" && status !== "loading" && (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] ${
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

        {canTest && (
          <div className="flex items-center gap-3 pb-6">
            <button
              type="button"
              onClick={handleTest}
              disabled={status === "loading" || !ownClientId}
              title="Solo developer: guarda un reporte con datos ficticios"
              className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-5 py-2.5 text-[13px] font-bold text-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FlaskConical className="h-4 w-4" />
              Testear
            </button>
            <p className="text-[13px] text-text-3">
              Los datos se guardan primero en Supabase. Las notificaciones van en segundo plano.
            </p>
          </div>
        )}
      </form>
      </>}
    </>
  )
}
