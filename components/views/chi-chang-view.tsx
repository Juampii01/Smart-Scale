"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { CheckCircle, AlertCircle, Loader2, Trophy } from "lucide-react"

const NIVEL_OPTIONS = [
  "Seleccioná un nivel",
  "🔴 $5K",
  "🔵 $10K",
  "🟣 $20K",
  "🟡 $50K",
  "🟢 $100K",
];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
        {label}
        {required && <span className="ml-1 text-[#ffde21]">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white placeholder:text-white/20 focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20 transition-all"

export function ChiChangView() {
  const activeClientId = useActiveClient()

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [valorTrato, setValorTrato] = useState("")
  const [cashCollected, setCashCollected] = useState("")
  const [proximoNivel, setProximoNivel] = useState("")

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeClientId) {
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
          client_id:      activeClientId,
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
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] px-6 py-5">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#ffde21]/60 via-[#ffde21]/30 to-transparent" />
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ffde21]/10 ring-1 ring-[#ffde21]/20">
            <Trophy className="h-5 w-5 text-[#ffde21]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/70 mb-0.5">Cierre</p>
            <h2 className="text-lg font-bold text-white">Cha-Ching 💰</h2>
            <p className="text-xs text-white/30 mt-0.5">¡Felicitaciones por cerrar el trato! Cargá los detalles.</p>
          </div>
        </div>
      </div>

      {/* Form fields */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
        <div className="flex items-center gap-2 border-b border-white/[0.05] px-5 py-3">
          <span className="h-3 w-[2px] rounded-full bg-[#ffde21]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Detalles del Trato</span>
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
            <Field label="Valor total del trato ($)" required>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="0"
                value={valorTrato}
                onChange={(e) => setValorTrato(e.target.value)}
                required
                className={inputCls}
              />
            </Field>

            <Field label="Total Cash Collected ($)" required>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="0"
                value={cashCollected}
                onChange={(e) => setCashCollected(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="¿Cuál es el próximo nivel que vas a conquistar?">
            <select
              value={proximoNivel}
              onChange={(e) => setProximoNivel(e.target.value)}
              className={inputCls + " [color-scheme:dark]"}
            >
              {NIVEL_OPTIONS.map((opt) => (
                <option key={opt} value={opt === "Seleccioná un nivel" ? "" : opt}>
                  {opt}
                </option>
              ))}
            </select>
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
          disabled={status === "loading" || !activeClientId}
          className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe46b] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "loading" ? "Registrando…" : "Registrar venta"}
        </button>
        {!activeClientId && (
          <p className="text-xs text-red-400/70">Seleccioná un cliente primero.</p>
        )}
      </div>
    </form>
  )
}
