"use client"

import { useState } from "react"
import { Check, AlertCircle, Loader2, Instagram, ShieldCheck } from "lucide-react"

const inputCls =
  "w-full rounded-xl border border-foreground/[0.10] bg-foreground/[0.03] px-4 py-3 text-[15px] text-foreground placeholder:text-text-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-all"

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[13px] font-semibold text-text-2 mb-2 tracking-wide">
      {children}
      {required && <span className="ml-1 text-accent-ink">*</span>}
    </label>
  )
}

export default function ConectarInstagramPage() {
  const [name,      setName]      = useState("")
  const [instagram, setInstagram] = useState("")

  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim())      { setError("Por favor escribí tu nombre."); return }
    if (!instagram.trim()) { setError("Por favor escribí tu usuario de Instagram."); return }

    setLoading(true)
    try {
      const res = await fetch("/api/instagram-access", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim(), instagram: instagram.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Ocurrió un error. Intentá de nuevo."); return }
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      setError("Error de conexión. Verificá tu internet e intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-20" style={{ backgroundColor: "var(--background)" }}>
        <div className="max-w-md w-full text-center space-y-7 px-2">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent">
            <Check className="h-10 w-10 text-black" strokeWidth={3} />
          </div>
          <div className="space-y-3">
            <h1 className="text-[32px] font-black text-foreground">¡Listo, lo recibimos!</h1>
            <p className="text-text-2 text-[15px] leading-relaxed">
              Vamos a configurar el acceso a las métricas de tu Instagram. En breve te va a llegar una invitación de Meta para aceptar.
            </p>
          </div>
          <div className="rounded-2xl border border-border p-6 text-left space-y-3" style={{ backgroundColor: "var(--card)" }}>
            <p className="text-[11px] font-black text-accent-ink/60 uppercase tracking-[0.2em]">Próximos pasos</p>
            <ul className="space-y-2.5 text-[13px] text-text-2">
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                Te agregamos como tester en nuestra herramienta de Meta
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                Recibís una invitación en Instagram / Meta — aceptala
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                Tus métricas empiezan a verse en el portal de Smart Scale
              </li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 border-b border-foreground/[0.07] backdrop-blur-md"
        style={{ backgroundColor: "color-mix(in srgb, var(--background) 96%, transparent)" }}
      >
        <div className="mx-auto max-w-xl px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-foreground text-[18px] font-bold tracking-tight">Smart</span>
            <span className="rounded-md bg-foreground px-2 py-0.5 text-[15px] font-bold tracking-tight text-background shadow-sm">Scale</span>
          </div>
          <span className="text-[11px] font-bold text-text-3 uppercase tracking-[0.18em]">Métricas</span>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 sm:px-5 pb-20 pt-8 sm:pt-12 space-y-6">
        {/* Hero */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 px-4 py-1.5" style={{ backgroundColor: "rgba(255,222,33,0.06)" }}>
            <Instagram className="h-3.5 w-3.5 text-accent-ink" />
            <span className="text-[11px] font-bold text-accent-ink uppercase tracking-[0.18em]">Conectá tu Instagram</span>
          </div>
          <h1 className="text-[24px] sm:text-[32px] font-black text-foreground leading-[1.1] tracking-tight">
            Dejanos traer las métricas de tu Instagram
          </h1>
          <p className="text-[15px] text-text-2 leading-relaxed">
            Cargá tu usuario y te damos acceso a la herramienta de Meta que conecta las métricas de tu cuenta
            directo a tu portal — sin que tengas que hacer nada técnico.
          </p>
        </div>

        {/* Requisito: cuenta profesional */}
        <div className="flex items-start gap-3 rounded-xl border border-foreground/[0.08] px-4 py-3.5" style={{ backgroundColor: "var(--card)" }}>
          <ShieldCheck className="h-4 w-4 text-accent-ink shrink-0 mt-0.5" />
          <p className="text-[13px] text-text-2 leading-relaxed">
            <span className="font-semibold text-foreground">Tu cuenta tiene que ser Profesional</span> (Business o Creator).
            Si todavía no lo es, cambiala desde Instagram → Configuración → Tipo de cuenta y herramientas → Cambiar a cuenta profesional.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-foreground/[0.07] p-5 sm:p-7 space-y-5" style={{ backgroundColor: "var(--card)" }}>
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-400 bg-red-100 px-4 py-3 text-[13px] text-red-900 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <Label required>Nombre y apellido</Label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre y apellido" className={inputCls} autoFocus />
          </div>

          <div>
            <Label required>Usuario de Instagram</Label>
            <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@tucuenta (o el link de tu perfil)" className={inputCls} />
            <p className="text-[13px] text-text-3 mt-1.5">Podés poner tu @usuario o pegar el link de tu perfil — las dos formas valen.</p>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim() || !instagram.trim()}
            className="w-full h-12 rounded-xl btn-accent text-[15px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Enviando…" : "Conectar mi Instagram"}
          </button>

          <p className="text-[13px] text-text-3 text-center leading-relaxed">
            Usamos tu usuario únicamente para conectar las métricas de tu cuenta a tu portal. No publicamos ni accedemos a tus mensajes.
          </p>
        </form>
      </div>
    </div>
  )
}
