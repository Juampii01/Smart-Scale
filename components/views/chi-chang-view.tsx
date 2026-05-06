"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useOwnClient, useActiveClient, useActiveClientName } from "@/components/layout/dashboard-layout"
import { CheckCircle, AlertCircle, Loader2, Trophy, Eye } from "lucide-react"

const NIVEL_OPTIONS = [
  { value: "$5K", label: "$5K", color: "#ef4444", dot: "bg-red-500" },
  { value: "$10K", label: "$10K", color: "#3b82f6", dot: "bg-blue-500" },
  { value: "$20K", label: "$20K", color: "#8b5cf6", dot: "bg-violet-500" },
  { value: "$50K", label: "$50K", color: "#ffde21", dot: "bg-yellow-400" },
  { value: "$100K", label: "$100K", color: "#22c55e", dot: "bg-green-500" },
]

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">
        {label}
        {required && <span className="ml-1 text-[#ffde21]">*</span>}
      </label>
      {hint && <p className="text-[11px] text-foreground/30 -mt-1 leading-snug">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = "w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-2.5 text-sm font-medium text-foreground placeholder:text-foreground/20 focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20 transition-all"

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

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

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
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error al enviar.")

      // Reset form
      setValorTrato("")
      setCashCollected("")
      setProximoNivel("")
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
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header card */}
      <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.06] bg-card px-6 py-5">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#ffde21]/60 via-[#ffde21]/30 to-transparent" />
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ffde21]/10 ring-1 ring-[#ffde21]/20">
            <Trophy className="h-5 w-5 text-[#ffde21]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/70 mb-0.5">Cierre</p>
            <h2 className="text-lg font-bold text-foreground">Cha-Ching 💰</h2>
            <p className="text-xs text-foreground/30 mt-0.5">¡Felicitaciones por cerrar el trato! Cargá los detalles.</p>
          </div>
        </div>
      </div>

      {/* Aviso si admin está viendo otro cliente */}
      {isViewingOther && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#ffde21]/25 bg-[#ffde21]/[0.05] px-4 py-3">
          <Eye className="h-4 w-4 text-[#ffde21] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffde21]/80">Aviso · este Cha-Ching es tuyo</p>
            <p className="text-[13px] text-foreground/75 mt-0.5">
              Estás navegando como <span className="font-semibold text-foreground">{activeName ?? "otro cliente"}</span>, pero este formulario siempre se guarda en tu propia cuenta. Si querés que sea para otro perfil, primero pedile que lo cargue desde su cuenta.
            </p>
          </div>
        </div>
      )}

      {/* Form fields */}
      <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.06] bg-card">
        <div className="flex items-center gap-2 border-b border-foreground/[0.05] px-5 py-3">
          <span className="h-3 w-[2px] rounded-full bg-[#ffde21]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground/40">Detalles del Trato</span>
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
                        ? "border-foreground/20 bg-foreground/[0.08]"
                        : "border-foreground/[0.07] bg-foreground/[0.03] hover:bg-foreground/[0.06] hover:border-foreground/[0.12]"
                    }`}
                    style={isActive ? { boxShadow: `0 0 0 1px ${opt.color}40, 0 0 12px ${opt.color}18` } : {}}
                  >
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: opt.color, boxShadow: `0 0 6px ${opt.color}80` }}
                    />
                    <span className={`text-xs font-bold tabular-nums ${isActive ? "text-foreground" : "text-foreground/55"}`}>
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </Field>

        </div>
      </div>

      {/* Status */}
      {status !== "idle" && status !== "loading" && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
          status === "success"
            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
            : "border-red-400/20 bg-red-500/10 text-red-200"
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
          disabled={status === "loading" || !ownClientId}
          className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe46b] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "loading" ? "Registrando…" : "Registrar venta"}
        </button>
        {!ownClientId && (
          <p className="text-xs text-red-400/70">Seleccioná un cliente primero.</p>
        )}
      </div>
    </form>
  )
}
