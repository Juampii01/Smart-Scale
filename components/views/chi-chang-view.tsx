"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useOwnClient, useActiveClient, useActiveClientName } from "@/components/layout/dashboard-layout"
import { ChaChingHistoryView } from "@/components/views/cha-ching-history-view"
import { CheckCircle, AlertCircle, Loader2, Trophy, Eye, FileText, History, Sparkles, Quote } from "lucide-react"

const NIVEL_OPTIONS = [
  { value: "$5K", label: "$5K", color: "#ef4444", dot: "bg-red-500" },
  { value: "$10K", label: "$10K", color: "#3b82f6", dot: "bg-blue-500" },
  { value: "$20K", label: "$20K", color: "#8b5cf6", dot: "bg-violet-500" },
  { value: "$50K", label: "$50K", color: "var(--accent-ink)", dot: "bg-yellow-400" },
  { value: "$100K", label: "$100K", color: "#22c55e", dot: "bg-green-500" },
]

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-text-2">
        {label}
        {required && <span className="ml-1 text-accent-ink">*</span>}
      </label>
      {hint && <p className="text-[13px] text-text-3 -mt-1 leading-snug">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = "w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-[13px] font-medium text-foreground placeholder:text-text-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-all"

// Reflexión obligatoria detrás del cierre (gamificación). Sin al menos
// NOTAS_MIN caracteres el submit queda bloqueado.
const NOTAS_MIN = 15
const NOTAS_PROMPTS = [
  "Un comentario o historia personal detrás de esta venta",
  "Qué hizo que este cierre fuera distinto",
  "Una creencia que cambiaste gracias a este trato",
]

export function ChiChangView() {
  // Cha-Ching SIEMPRE se guarda en la cuenta del usuario logueado.
  const ownClientId    = useOwnClient()
  const activeClientId = useActiveClient()
  const activeName     = useActiveClientName()
  const isViewingOther = !!ownClientId && !!activeClientId && ownClientId !== activeClientId

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [valorTrato, setValorTrato] = useState("")
  const [cashCollected, setCashCollected] = useState("")
  const [proximoNivel, setProximoNivel] = useState("")
  const [notas, setNotas] = useState("")
  const notasOk = notas.trim().length >= NOTAS_MIN

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [tab, setTab] = useState<"form" | "history">("form")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownClientId) {
      setStatus("error")
      setMessage("No hay cliente seleccionado. Elegí un cliente en la barra superior.")
      return
    }
    if (!fecha || !valorTrato || !cashCollected) {
      setStatus("error")
      setMessage("Completá los campos obligatorios: fecha, valor del trato y cash collected.")
      return
    }
    if (notas.trim().length < NOTAS_MIN) {
      setStatus("error")
      setMessage("Contanos la historia detrás del cierre: es obligatorio (al menos unas palabras).")
      return
    }

    setStatus("loading")
    setMessage("")

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Sesión expirada.")

      const res = await fetch("/api/chi-chang", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          client_id:      ownClientId,
          fecha,
          valor_trato:    valorTrato,
          cash_collected: cashCollected,
          proximo_nivel:  proximoNivel || null,
          notas:          notas.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error al enviar.")

      // Reset form
      setValorTrato("")
      setCashCollected("")
      setProximoNivel("")
      setNotas("")
      setFecha(new Date().toISOString().slice(0, 10))

      setStatus("success")
      setMessage(`¡Cha-Ching! 💰 Nueva venta registrada${data.client_name ? ` para ${data.client_name}` : ""}.`)
      setTimeout(() => setStatus("idle"), 6000)
    } catch (err: any) {
      setStatus("error")
      setMessage(err?.message ?? "Error inesperado.")
    }
  }

  return (
    <>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 rounded-xl border border-border bg-card p-1 w-fit">
        <button type="button" onClick={() => setTab("form")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${tab === "form" ? "bg-secondary text-foreground" : "text-text-2 hover:text-foreground"}`}>
          <FileText className="h-3.5 w-3.5" /> Registrar
        </button>
        <button type="button" onClick={() => setTab("history")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${tab === "history" ? "bg-secondary text-foreground" : "text-text-2 hover:text-foreground"}`}>
          <History className="h-3.5 w-3.5" /> Historial
        </button>
      </div>

      {tab === "history" && <ChaChingHistoryView />}

      {tab === "form" && (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header card */}
      <div className="rounded-[14px] border border-border bg-card px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft ring-1 ring-accent/20">
            <Trophy className="h-5 w-5 text-accent-ink" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-ink/70 mb-0.5">Cierre</p>
            <h2 className="text-[18px] font-bold text-foreground">Cha-Ching 💰</h2>
            <p className="text-[13px] text-text-3 mt-0.5">¡Felicitaciones por cerrar el trato! Cargá los detalles.</p>
          </div>
        </div>
      </div>

      {/* Aviso si admin está viendo otro cliente */}
      {isViewingOther && (
        <div className="flex items-start gap-3 rounded-[14px] border border-accent/20 bg-accent-soft px-4 py-3">
          <Eye className="h-4 w-4 text-accent-ink flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-ink/80">Aviso · este Cha-Ching es tuyo</p>
            <p className="text-[13px] text-foreground mt-0.5">
              Estás navegando como <span className="font-semibold text-foreground">{activeName ?? "otro cliente"}</span>, pero este formulario siempre se guarda en tu propia cuenta. Si querés que sea para otro perfil, primero pedile que lo cargue desde su cuenta.
            </p>
          </div>
        </div>
      )}

      {/* Form fields */}
      <div className="relative overflow-hidden rounded-[14px] border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <span className="h-3 w-[2px] rounded-full bg-accent" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-text-2">Detalles del Trato</span>
        </div>
        <div className="p-5 space-y-5">

          <Field label="Fecha de hoy" required>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className={inputCls + " [color-scheme:dark]"}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Valor total del trato ($)" required hint="Lo que vale el contrato (ej: $5K si vendiste un programa de $5K aunque cobres en cuotas)">
              <input
                type="number"
                min={0}
                step="any"
                placeholder="5000"
                value={valorTrato}
                onChange={(e) => setValorTrato(e.target.value)}
                required
                className={inputCls}
              />
            </Field>

            <Field label="Total Cash Collected ($)" required hint="Lo que YA cobraste hoy (ej: $1.500 si fue solo el primer pago)">
              <input
                type="number"
                min={0}
                step="any"
                placeholder="1500"
                value={cashCollected}
                onChange={(e) => setCashCollected(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="¿Cuál es el próximo nivel que vas a conquistar? (opcional)">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {NIVEL_OPTIONS.map((opt) => {
                const isActive = proximoNivel === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProximoNivel(isActive ? "" : opt.value)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 transition-all duration-150 ${
                      isActive
                        ? "border-border-hover bg-secondary"
                        : "border-border bg-elevated hover:bg-secondary hover:border-border"
                    }`}
                    style={isActive ? { boxShadow: `0 0 0 1px color-mix(in srgb, ${opt.color} 25%, transparent), 0 0 12px color-mix(in srgb, ${opt.color} 10%, transparent)` } : {}}
                  >
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: opt.color, boxShadow: `0 0 6px color-mix(in srgb, ${opt.color} 50%, transparent)` }}
                    />
                    <span className={`text-[13px] font-bold tabular-nums ${isActive ? "text-foreground" : "text-text-2"}`}>
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </Field>

        </div>
      </div>

      {/* La historia detrás del cierre — reflexión obligatoria (gamificación) */}
      <div className={`relative overflow-hidden rounded-[14px] border bg-card transition-colors ${
        notasOk ? "border-accent" : "border-border"
      }`}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Quote className="h-3.5 w-3.5 text-accent-ink" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-text-2">
              La historia detrás del cierre <span className="text-accent-ink">*</span>
            </span>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
            notasOk
              ? "bg-secondary text-accent-ink"
              : "bg-elevated text-text-3"
          }`}>
            <Sparkles className="h-3 w-3" />
            {notasOk ? "Reflexión +1" : "Sumá tu reflexión"}
          </span>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-[13px] text-text-2 leading-relaxed">
            Compartí algo detrás de este cierre. Por ejemplo:
          </p>
          <ul className="space-y-1.5">
            {NOTAS_PROMPTS.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[13px] text-text-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {p}
              </li>
            ))}
          </ul>

          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            required
            rows={4}
            placeholder="Ej: Este cliente me dijo 3 veces que no… y entendí que el seguimiento gana más tratos que el pitch. Cambió mi forma de cerrar."
            className={inputCls + " resize-y leading-relaxed"}
          />

          <div className="flex items-center justify-between">
            <span className={`text-[13px] font-medium transition-colors ${
              notasOk ? "text-accent-ink" : "text-text-3"
            }`}>
              {notasOk
                ? "✨ Reflexión registrada"
                : `Escribí al menos ${Math.max(0, NOTAS_MIN - notas.trim().length)} caracteres más`}
            </span>
            <span className="text-[13px] tabular-nums text-text-3">{notas.trim().length}</span>
          </div>
        </div>
      </div>

      {/* Status */}
      {status !== "idle" && status !== "loading" && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] ${
          status === "success"
            ? "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200"
            : "border-red-400 bg-red-100 text-red-900 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"
        }`}>
          {status === "success"
            ? <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
          <span>{message}</span>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3 pb-6">
        <button
          type="submit"
          disabled={status === "loading" || !ownClientId || !notasOk}
          className="flex items-center gap-2 rounded-xl btn-accent px-6 py-2.5 text-[13px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "loading" ? "Registrando…" : "Registrar venta"}
        </button>
        {!ownClientId && (
          <p className="text-[13px] text-red-700 dark:text-red-400/70">Seleccioná un cliente primero.</p>
        )}
      </div>
    </form>
      )}
    </>
  )
}
