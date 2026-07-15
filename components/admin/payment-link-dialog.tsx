"use client"

import { useState } from "react"
import { X, Link2, Loader2, Copy, Check, ExternalLink, CalendarDays } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface PaymentLinkDialogProps {
  open:    boolean
  onClose: () => void
}

export function PaymentLinkDialog({ open, onClose }: PaymentLinkDialogProps) {
  const [type,        setType]        = useState<"once" | "recurring">("once")
  const [amount,      setAmount]      = useState("")
  const [installments,setInstallments]= useState("6")
  const [description, setDescription] = useState("")
  const [calendlyUrl, setCalendlyUrl] = useState("")

  // When a Calendly URL is entered, the after_completion redirect becomes
  // /booking/confirmed?calendly=ENCODED_URL so the confirmation page embeds it.
  const confirmedRedirectUrl = calendlyUrl.trim()
    ? `${typeof window !== "undefined" ? window.location.origin : "https://smartscale.space"}/booking/confirmed?calendly=${encodeURIComponent(calendlyUrl.trim())}`
    : calendlyUrl.trim()
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState<{ paymentUrl: string; calendly_url: string | null; raw_calendly: string | null } | null>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [copied,      setCopied]      = useState(false)

  const reset = () => {
    setType("once"); setAmount(""); setInstallments("6"); setDescription("")
    setCalendlyUrl(""); setLoading(false); setResult(null); setError(null); setCopied(false)
  }

  const handleClose = () => { reset(); onClose() }

  const handleCreate = async () => {
    setError(null)
    const amt = Number(amount)
    if (!amt || amt <= 0) { setError("Ingresá un monto válido"); return }
    if (calendlyUrl && !calendlyUrl.startsWith("https://")) {
      setError("El link de Calendly debe empezar con https://"); return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sin sesión"); return }

      const body: Record<string, any> = {
        type,
        description: description.trim() || "Smart Scale",
        // Use the /booking/confirmed redirect so Calendly appears embedded after payment
        calendly_url: confirmedRedirectUrl || null,
      }
      if (type === "once") {
        body.amount = amt
      } else {
        body.amount_per_installment = amt
        body.installments           = Number(installments)
      }

      const res  = await fetch("/api/admin/payment-link", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Error al crear link"); return }
      setResult({
        paymentUrl:   json.paymentUrl,
        calendly_url: json.calendly_url ?? null,
        raw_calendly: calendlyUrl.trim() || null,
      })
    } catch (err: any) {
      setError(err?.message ?? "Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    if (!result?.paymentUrl) return
    await navigator.clipboard.writeText(result.paymentUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!open) return null

  const inputCls = "w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/30 focus:border-[#dafc69]/40 focus:outline-none transition-all"
  const labelCls = "text-[10px] font-bold uppercase tracking-widest text-foreground/30 mb-1.5 block"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-foreground/[0.08] bg-card shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-foreground/[0.06] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-[3px] rounded-full bg-[#dafc69]" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">
              Crear link de pago
            </h2>
          </div>
          <button onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:bg-foreground/[0.06] hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Result state */}
          {result ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400/80">
                  Link creado ✓
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-foreground/[0.05] px-3 py-2 text-[12px] font-mono text-[#dafc69]/80">
                    {result.paymentUrl}
                  </code>
                  <button onClick={copyLink}
                    className="shrink-0 flex items-center gap-1.5 h-8 rounded-lg bg-[#dafc69] px-3 text-[12px] font-bold text-black hover:bg-[#f2ffc0] transition-all">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <a href={result.paymentUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12px] text-foreground/40 hover:text-foreground transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir en Stripe
                </a>
              </div>

              {result.raw_calendly && (
                <div className="rounded-xl border border-blue-400/20 bg-blue-500/[0.05] p-3 flex items-start gap-2.5">
                  <CalendarDays className="h-4 w-4 text-blue-400/70 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-blue-400/80">
                      Después del pago → Calendly embebido
                    </p>
                    <p className="text-[11px] text-foreground/35 break-all">{result.raw_calendly}</p>
                    <p className="text-[10px] text-foreground/20">
                      El cliente es redirigido a <code className="text-foreground/35">/booking/confirmed</code> donde ve el calendario inline
                    </p>
                  </div>
                </div>
              )}

              <button onClick={reset}
                className="w-full h-9 rounded-xl border border-foreground/[0.08] text-[13px] text-foreground/50 hover:text-foreground hover:border-foreground/20 transition-all">
                Crear otro link
              </button>
            </div>
          ) : (
            <>
              {/* Type toggle */}
              <div className="flex rounded-xl border border-foreground/[0.08] overflow-hidden">
                {(["once", "recurring"] as const).map(t => (
                  <button key={t} onClick={() => setType(t)}
                    className={`flex-1 py-2 text-[12px] font-semibold transition-all ${
                      type === t
                        ? "bg-[#dafc69]/10 text-[#dafc69]"
                        : "text-foreground/40 hover:text-foreground"
                    }`}>
                    {t === "once" ? "Pago único" : "Cuotas mensuales"}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div>
                <label className={labelCls}>
                  {type === "once" ? "Monto *" : "Monto por cuota *"}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-foreground/40">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="400"
                    className={`${inputCls} pl-7`}
                  />
                </div>
              </div>

              {/* Installments (recurring only) */}
              {type === "recurring" && (
                <div>
                  <label className={labelCls}>Cantidad de cuotas *</label>
                  <select value={installments} onChange={e => setInstallments(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground focus:border-[#dafc69]/40 focus:outline-none">
                    {[1,2,3,4,5,6,8,10,12].map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? "cuota" : "cuotas"}{amount ? ` — Total $${Number(amount) * n}` : ""}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className={labelCls}>Descripción (aparece en Stripe)</label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Smart Scale — Consultoría"
                  className={inputCls}
                />
              </div>

              {/* Calendly URL */}
              <div>
                <label className={labelCls}>
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3" />
                    Link de Calendly (opcional — redirige después del pago)
                  </span>
                </label>
                <input
                  value={calendlyUrl}
                  onChange={e => setCalendlyUrl(e.target.value)}
                  placeholder="https://calendly.com/..."
                  className={inputCls}
                />
                {calendlyUrl && (
                  <p className="mt-1.5 text-[11px] text-foreground/30">
                    ✓ Al pagar, el cliente es redirigido automáticamente a agendar su llamada
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="rounded-xl border border-red-400/25 bg-red-500/[0.07] px-3 py-2.5 text-[12px] text-red-400">
                  {error}
                </p>
              )}

              {/* CTA */}
              <button onClick={handleCreate} disabled={loading || !amount}
                className="w-full h-10 rounded-xl bg-[#dafc69] text-[13px] font-bold text-black hover:bg-[#f2ffc0] disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
                  : <><Link2 className="h-4 w-4" /> Crear link de Stripe</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
