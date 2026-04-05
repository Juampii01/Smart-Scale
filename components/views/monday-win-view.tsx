"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { CheckCircle, AlertCircle, Loader2, Star } from "lucide-react"

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
        {label}
        {required && <span className="ml-1 text-[#ffde21]">*</span>}
      </label>
      {hint && <p className="text-[11px] text-white/25 -mt-1">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = "w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white placeholder:text-white/20 focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20 transition-all"
const textareaCls = inputCls + " resize-none"

export function MondayWinView() {
  const activeClientId = useActiveClient()

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [logro1, setLogro1] = useState("")
  const [logro2, setLogro2] = useState("")
  const [logro3, setLogro3] = useState("")
  const [unaSolaCosa, setUnaSolaCosa] = useState("")
  const [bloqueo, setBloqueo] = useState("")

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeClientId) {
      setStatus("error")
      setMessage("No hay cliente seleccionado. Elegí un cliente en la barra superior.")
      return
    }
    if (!fecha || !logro1 || !unaSolaCosa || !bloqueo) {
      setStatus("error")
      setMessage("Completá los campos obligatorios.")
      return
    }

    setStatus("loading")
    setMessage("")

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Sesión expirada.")

      const res = await fetch("/api/monday-win", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          client_id:    activeClientId,
          fecha,
          logro_1:      logro1,
          logro_2:      logro2 || null,
          logro_3:      logro3 || null,
          una_sola_cosa: unaSolaCosa,
          bloqueo,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error al enviar.")

      // Reset
      setLogro1(""); setLogro2(""); setLogro3("")
      setUnaSolaCosa(""); setBloqueo("")
      setFecha(new Date().toISOString().slice(0, 10))

      setStatus("success")
      setMessage(`¡Monday Win enviado correctamente${data.client_name ? ` para ${data.client_name}` : ""}!`)
      setTimeout(() => setStatus("idle"), 6000)
    } catch (err: any) {
      setStatus("error")
      setMessage(err?.message ?? "Error inesperado.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] px-6 py-5">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#ffde21]/60 via-[#ffde21]/30 to-transparent" />
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ffde21]/10 ring-1 ring-[#ffde21]/20">
            <Star className="h-5 w-5 text-[#ffde21]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/70 mb-0.5">Semanal</p>
            <h2 className="text-lg font-bold text-white">Monday Win</h2>
            <p className="text-xs text-white/30 mt-0.5">Compartí tus logros y enfoque de la semana.</p>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
        <div className="flex items-center gap-2 border-b border-white/[0.05] px-5 py-3">
          <span className="h-3 w-[2px] rounded-full bg-[#ffde21]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Semana en revisión</span>
        </div>
        <div className="p-5 space-y-5">

          <Field label="Fecha" required>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className={inputCls + " [color-scheme:dark]"}
            />
          </Field>

          <Field label="Principal logro de la semana pasada" hint="¿Cuál fue tu logro más importante?" required>
            <textarea
              rows={2}
              placeholder="—"
              value={logro1}
              onChange={(e) => setLogro1(e.target.value)}
              required
              className={textareaCls}
            />
          </Field>

          <Field label="Segundo logro más importante" hint="¿Cuál fue tu segundo logro?">
            <textarea
              rows={2}
              placeholder="—"
              value={logro2}
              onChange={(e) => setLogro2(e.target.value)}
              className={textareaCls}
            />
          </Field>

          <Field label="Tercer logro más importante" hint="¿Cuál fue tu tercer logro?">
            <textarea
              rows={2}
              placeholder="—"
              value={logro3}
              onChange={(e) => setLogro3(e.target.value)}
              className={textareaCls}
            />
          </Field>

        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113]">
        <div className="flex items-center gap-2 border-b border-white/[0.05] px-5 py-3">
          <span className="h-3 w-[2px] rounded-full bg-[#ffde21]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Esta semana</span>
        </div>
        <div className="p-5 space-y-5">

          <Field label='"Una sola cosa" para esta semana' hint="¿Cuál es la UNA cosa en la que te vas a enfocar para avanzar?" required>
            <textarea
              rows={2}
              placeholder="—"
              value={unaSolaCosa}
              onChange={(e) => setUnaSolaCosa(e.target.value)}
              required
              className={textareaCls}
            />
          </Field>

          <Field label="Bloqueo principal / Pregunta" hint="¿Qué pregunta podés hacernos para ayudarte a destrabarlo?" required>
            <textarea
              rows={2}
              placeholder="—"
              value={bloqueo}
              onChange={(e) => setBloqueo(e.target.value)}
              required
              className={textareaCls}
            />
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
          {status === "loading" ? "Enviando…" : "Enviar Monday Win"}
        </button>
        {!activeClientId && (
          <p className="text-xs text-red-400/70">Seleccioná un cliente primero.</p>
        )}
      </div>
    </form>
  )
}
