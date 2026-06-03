"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useOwnClient, useActiveClient, useActiveClientName, useUserRole } from "@/components/layout/dashboard-layout"
import { isDeveloper } from "@/lib/auth/permissions"
import { fakeMondayWin } from "@/lib/dev-test-data"
import { MondayWinsHistoryView } from "@/components/views/monday-wins-history-view"
import { CheckCircle, AlertCircle, Loader2, Star, Eye, FlaskConical, FileText, History } from "lucide-react"

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">
        {label}
        {required && <span className="ml-1 text-[#ffde21]">*</span>}
      </label>
      {hint && <p className="text-[11px] text-foreground/25 -mt-1">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = "w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-2.5 text-sm font-medium text-foreground placeholder:text-foreground/20 focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20 transition-all"
const textareaCls = inputCls + " resize-none"

export function MondayWinView() {
  // Monday Win SIEMPRE se guarda en la cuenta del usuario logueado.
  // Si admin está viendo otro cliente, mostramos un aviso pero el
  // form sigue grabando en su propia cuenta.
  const ownClientId    = useOwnClient()
  const activeClientId = useActiveClient()
  const activeName     = useActiveClientName()
  const userRole       = useUserRole()
  const canTest        = isDeveloper(userRole)
  const isViewingOther = !!ownClientId && !!activeClientId && ownClientId !== activeClientId

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [logro1, setLogro1] = useState("")
  const [logro2, setLogro2] = useState("")
  const [logro3, setLogro3] = useState("")
  const [unaSolaCosa, setUnaSolaCosa] = useState("")
  const [bloqueo, setBloqueo] = useState("")

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [tab, setTab] = useState<"form" | "history">("form")

  // Envío real. Acepta un payload explícito (usado por el botón "Testear")
  // o lee el estado del form cuando no se pasa nada.
  const sendWin = async (override?: {
    fecha: string; logro_1: string; logro_2: string | null
    logro_3: string | null; una_sola_cosa: string; bloqueo: string
  }) => {
    setStatus("loading")
    setMessage("")

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Sesión expirada.")

      const payload = override ?? {
        fecha,
        logro_1: logro1,
        logro_2: logro2 || null,
        logro_3: logro3 || null,
        una_sola_cosa: unaSolaCosa,
        bloqueo,
      }

      const res = await fetch("/api/monday-win", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ client_id: ownClientId, ...payload }),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownClientId) {
      setStatus("error")
      setMessage("No hay cliente seleccionado. Elegí un cliente en la barra superior.")
      return
    }
    if (!fecha || !logro1 || !unaSolaCosa || !bloqueo) {
      setStatus("error")
      setMessage("Completá los campos obligatorios.")
      return
    }
    await sendWin()
  }

  // Solo developer: llena los campos visibles con datos ficticios y envía.
  const handleTest = async () => {
    if (!ownClientId || status === "loading") return
    const fake = fakeMondayWin()
    const today = new Date().toISOString().slice(0, 10)
    setFecha(today)
    setLogro1(fake.logro_1); setLogro2(fake.logro_2); setLogro3(fake.logro_3)
    setUnaSolaCosa(fake.una_sola_cosa); setBloqueo(fake.bloqueo)
    await sendWin({ fecha: today, ...fake })
  }

  return (
    <>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 rounded-xl border border-foreground/[0.06] bg-card p-1 w-fit">
        <button type="button" onClick={() => setTab("form")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "form" ? "bg-[#ffde21] text-black" : "text-foreground/40 hover:text-foreground/70"}`}>
          <FileText className="h-3.5 w-3.5" /> Cargar
        </button>
        <button type="button" onClick={() => setTab("history")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "history" ? "bg-[#ffde21] text-black" : "text-foreground/40 hover:text-foreground/70"}`}>
          <History className="h-3.5 w-3.5" /> Historial
        </button>
      </div>

      {tab === "history" && <MondayWinsHistoryView />}

      {tab === "form" && (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.06] bg-card px-6 py-5">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#ffde21]/60 via-[#ffde21]/30 to-transparent" />
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ffde21]/10 ring-1 ring-[#ffde21]/20">
            <Star className="h-5 w-5 text-[#ffde21]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/70 mb-0.5">Semanal</p>
            <h2 className="text-lg font-bold text-foreground">Monday Win</h2>
            <p className="text-xs text-foreground/30 mt-0.5">Compartí tus logros y enfoque de la semana.</p>
          </div>
        </div>
      </div>

      {/* Aviso si admin está viendo otro cliente */}
      {isViewingOther && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#ffde21]/25 bg-[#ffde21]/[0.05] px-4 py-3">
          <Eye className="h-4 w-4 text-[#ffde21] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffde21]/80">Aviso · este Monday Win es tuyo</p>
            <p className="text-[13px] text-foreground/75 mt-0.5">
              Estás navegando como <span className="font-semibold text-foreground">{activeName ?? "otro cliente"}</span>, pero este formulario siempre se guarda en tu propia cuenta. Si querés que sea para otro perfil, primero pedile que lo cargue desde su cuenta.
            </p>
          </div>
        </div>
      )}

      {/* Fields */}
      <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.06] bg-card">
        <div className="flex items-center gap-2 border-b border-foreground/[0.05] px-5 py-3">
          <span className="h-3 w-[2px] rounded-full bg-[#ffde21]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground/40">Semana en revisión</span>
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
              placeholder="ej: Cerré 2 nuevos clientes a $3k cada uno desde DM"
              value={logro1}
              onChange={(e) => setLogro1(e.target.value)}
              required
              className={textareaCls}
            />
          </Field>

          <Field label="Segundo logro más importante" hint="¿Cuál fue tu segundo logro?">
            <textarea
              rows={2}
              placeholder="ej: Lancé mi primer video de YouTube con 200 views"
              value={logro2}
              onChange={(e) => setLogro2(e.target.value)}
              className={textareaCls}
            />
          </Field>

          <Field label="Tercer logro más importante" hint="¿Cuál fue tu tercer logro?">
            <textarea
              rows={2}
              placeholder="ej: Terminé el módulo de Ofertas y armé mi Offer Doc"
              value={logro3}
              onChange={(e) => setLogro3(e.target.value)}
              className={textareaCls}
            />
          </Field>

        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.06] bg-card">
        <div className="flex items-center gap-2 border-b border-foreground/[0.05] px-5 py-3">
          <span className="h-3 w-[2px] rounded-full bg-[#ffde21]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground/40">Esta semana</span>
        </div>
        <div className="p-5 space-y-5">

          <Field label='"Una sola cosa" para esta semana' hint="La ÚNICA cosa que si la hacés, todo lo demás se vuelve más fácil o irrelevante (de The ONE Thing, Gary Keller)." required>
            <textarea
              rows={2}
              placeholder="ej: Grabar y publicar 1 video largo en YouTube"
              value={unaSolaCosa}
              onChange={(e) => setUnaSolaCosa(e.target.value)}
              required
              className={textareaCls}
            />
          </Field>

          <Field label="Bloqueo principal / Pregunta" hint="¿Qué pregunta podés hacernos para ayudarte a destrabarlo?" required>
            <textarea
              rows={2}
              placeholder="ej: No sé cómo cerrar la objeción de precio. ¿Hay algún script?"
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
          disabled={status === "loading" || !ownClientId}
          className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-6 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe46b] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "loading" ? "Enviando…" : "Enviar Monday Win"}
        </button>
        {canTest && (
          <button
            type="button"
            onClick={handleTest}
            disabled={status === "loading" || !ownClientId}
            title="Solo developer: envía un Monday Win con datos ficticios"
            className="flex items-center gap-2 rounded-xl border border-foreground/15 bg-foreground/[0.04] px-5 py-2.5 text-sm font-bold text-foreground/70 transition hover:bg-foreground/[0.08] hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FlaskConical className="h-4 w-4" />
            Testear
          </button>
        )}
        {!ownClientId && (
          <p className="text-xs text-red-700 dark:text-red-400/70">Seleccioná un cliente primero.</p>
        )}
      </div>
    </form>
      )}
    </>
  )
}
