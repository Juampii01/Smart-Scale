"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import {
  UserPlus, Loader2, Check, Copy, X, ChevronRight,
  Phone, Calendar, DollarSign, User, Mail,
  RefreshCw, CheckCircle2, Clock, AlertCircle, Link2, CreditCard,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingClient {
  id:                 string
  name:               string
  email:              string | null
  instagram:          string | null
  phone:              string | null
  program_start:      string
  installment_amount: number
  num_installments:   number
  total_amount:       number | null
  programa:           string | null
  status:             string
  notes:              string | null
  created_at:         string
  setter_id:          string | null
}

interface SetterProfile {
  id:   string
  name: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: any; cls: string }> = {
    activo:     { label: "Activo",     icon: CheckCircle2,  cls: "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" },
    inactivo:   { label: "Inactivo",   icon: AlertCircle,   cls: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/10 border-red-200 dark:border-red-500/20" },
    completado: { label: "Completado", icon: CheckCircle2,  cls: "text-foreground/60 bg-foreground/[0.04] border-foreground/[0.08]" },
    pendiente:  { label: "Pendiente",  icon: Clock,         cls: "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20" },
  }
  const cfg = map[status] ?? map["pendiente"]
  const Icon = cfg.icon
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cfg.cls)}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  )
}

// ─── Success modal ────────────────────────────────────────────────────────────

function SuccessModal({
  name, email, tempPassword, magicLink, onClose,
}: {
  name: string; email: string; tempPassword: string | null; magicLink: string | null; onClose: () => void
}) {
  const [copied, setCopied] = useState<"password" | "magic" | null>(null)

  function copy(text: string, type: "password" | "magic") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop — no cierra al click */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-sm mx-4 flex flex-col items-center gap-6">

        {/* Ícono animado */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#ffde21]/40 bg-[#ffde21]/10 shadow-[0_0_40px_rgba(255,222,33,0.25)]">
          <Check className="h-9 w-9 text-[#ffde21]" strokeWidth={2.5} />
        </div>

        {/* Título */}
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#ffde21]/60 mb-1">Smart Scale</p>
          <h2 className="text-3xl font-black tracking-tight text-white">ONBOARDING</h2>
          <h2 className="text-3xl font-black tracking-tight text-[#ffde21]">REALIZADO</h2>
          <p className="mt-2 text-[13px] text-white/40">{name}</p>
        </div>

        {/* Credenciales */}
        <div className="w-full space-y-2">
          {/* Email */}
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
            <Mail className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <span className="flex-1 text-[13px] text-white/70 truncate">{email}</span>
          </div>

          {/* Magic link */}
          {magicLink && (
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-white/30" />
              <span className="flex-1 text-[12px] text-white/50 truncate">Magic link generado</span>
              <button
                onClick={() => copy(magicLink, "magic")}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/60 hover:bg-white/[0.1] hover:text-white transition-colors shrink-0"
              >
                {copied === "magic" ? <><Check className="h-3 w-3 text-[#ffde21]" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
              </button>
            </div>
          )}

          {/* Password */}
          {tempPassword && (
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
              <User className="h-3.5 w-3.5 shrink-0 text-white/30" />
              <code className="flex-1 font-mono text-[13px] text-white/80 tracking-wide">{tempPassword}</code>
              <button
                onClick={() => copy(tempPassword, "password")}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/60 hover:bg-white/[0.1] hover:text-white transition-colors shrink-0"
              >
                {copied === "password" ? <><Check className="h-3 w-3 text-[#ffde21]" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
              </button>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-[#ffde21] py-3.5 text-[15px] font-black text-black tracking-wide transition hover:bg-[#ffe84d] active:scale-[0.98]"
        >
          Listo
        </button>
      </div>
    </div>
  )
}

// ─── Onboarding Form ──────────────────────────────────────────────────────────

function OnboardingForm({
  setters, onSuccess, onCancel,
}: {
  setters:   SetterProfile[]
  onSuccess: (data: { name: string; email: string; tempPassword: string | null; magicLink: string | null }) => void
  onCancel:  () => void
}) {
  const supabase = createClient()

  const [fields, setFields] = useState({
    name:           "",
    email:          "",
    phone:          "",
    program:        "",
    total_amount:   "",
    cuota_1:        "",
    cuota_2:        "",
    cuota_3:        "",
    cuota_4:        "",
    cuota_5:        "",
    cuota_6:        "",
    program_start:  new Date().toISOString().slice(0, 10),
    setter_id:      "",
    forma_pago:     "",
  })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    // Load user's role to determine if setter_id should be auto-assigned
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            setUserRole((profile as any)?.role ?? null)
          })
      }
    })
  }, [])

  // Auto-seleccionar Fabri cuando carguen los setters
  useEffect(() => {
    if (setters.length === 0) return
    const fabri = setters.find(s => s.name?.toLowerCase().includes("fabri"))
    if (fabri) {
      setFields(prev => ({ ...prev, setter_id: prev.setter_id || fabri.id }))
    }
  }, [setters])

  function set(key: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("No hay sesión activa"); return }

      const res = await fetch("/api/admin/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          name:         fields.name.trim(),
          email:        fields.email.trim(),
          phone:        fields.phone.trim()     || null,
          program:      fields.program.trim()   || null,
          total_amount: fields.total_amount ? Number(fields.total_amount) : 0,
          cuotas: {
            cuota_1: fields.cuota_1 ? Number(fields.cuota_1) : null,
            cuota_2: fields.cuota_2 ? Number(fields.cuota_2) : null,
            cuota_3: fields.cuota_3 ? Number(fields.cuota_3) : null,
            cuota_4: fields.cuota_4 ? Number(fields.cuota_4) : null,
            cuota_5: fields.cuota_5 ? Number(fields.cuota_5) : null,
            cuota_6: fields.cuota_6 ? Number(fields.cuota_6) : null,
          },
          program_start: fields.program_start,
          setter_id:     fields.setter_id || null,
          forma_pago:    fields.forma_pago.trim() || null,
        }),
      })

      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? "Error al crear onboarding"); return }

      onSuccess({ name: json.client.name, email: json.user.email, tempPassword: json.tempPassword, magicLink: json.magicLink })
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado")
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "h-10 w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 text-[13px] text-foreground placeholder:text-foreground/25 outline-none transition-all focus:border-[#ffde21]/40 focus:bg-foreground/[0.05] focus:ring-2 focus:ring-[#ffde21]/10"
  const labelCls = "block text-[10px] font-semibold uppercase tracking-widest text-foreground/40 mb-1.5"

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffde21]/10 border border-[#ffde21]/20">
          <UserPlus className="h-4 w-4 text-[#ffde21]" />
        </span>
        <div>
          <h2 className="font-bold text-foreground">Nuevo onboarding</h2>
          <p className="text-[12px] text-foreground/45">Completá los datos del cliente para crear su cuenta.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Datos personales */}
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffde21]/60">Datos del cliente</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Nombre completo *</label>
              <input className={inputCls} placeholder="Juan García" value={fields.name} onChange={set("name")} required />
            </div>
            <div>
              <label className={labelCls}>Email (acceso dashboard) *</label>
              <input className={inputCls} type="email" placeholder="juan@email.com" value={fields.email} onChange={set("email")} required />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" />
                <input className={cn(inputCls, "pl-8")} placeholder="+54 11 1234-5678" value={fields.phone} onChange={set("phone")} />
              </div>
            </div>
          </div>
        </div>

        {/* Programa */}
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffde21]/60">Programa</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Programa *</label>
              <select className={cn(inputCls, "cursor-pointer")} value={fields.program} onChange={set("program")} required>
                <option value="">— Selecciona programa —</option>
                <option value="Smart Scale Grupal">Smart Scale Grupal</option>
                <option value="Smart Scale Híbrido">Smart Scale Híbrido</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Monto total (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" />
                <input className={cn(inputCls, "pl-8")} type="number" min="0" placeholder="9000" value={fields.total_amount} onChange={set("total_amount")} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Fecha de inicio</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" />
                <input className={cn(inputCls, "pl-8")} type="date" value={fields.program_start} onChange={set("program_start")} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Setter que cerró</label>
              {userRole === "setter" ? (
                <div className="h-10 flex items-center rounded-xl border border-border bg-foreground/[0.03] px-3.5 text-[13px] text-foreground/60">
                  Se asignará automáticamente a ti
                </div>
              ) : (
                <select className={cn(inputCls, "cursor-pointer")} value={fields.setter_id} onChange={set("setter_id")}>
                  <option value="">— Sin asignar —</option>
                  {setters.map(s => (
                    <option key={s.id} value={s.id}>{s.name ?? s.id}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Formato de pago</label>
              <input className={inputCls} placeholder="Ej: transferencia, tarjeta, efectivo, plan de pagos..." value={fields.forma_pago} onChange={set("forma_pago")} />
            </div>
          </div>
        </div>

        {/* Cuotas */}
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffde21]/60">Cuotas (llenar las que correspondan)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i}>
                <label className={labelCls}>Cuota {i}</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" />
                  <input
                    className={cn(inputCls, "pl-8")}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={(fields as any)[`cuota_${i}`]}
                    onChange={set(`cuota_${i}` as any)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-700 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-border px-4 py-2 text-[13px] font-medium text-foreground/70 hover:bg-foreground/[0.04] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-5 py-2 text-[13px] font-bold text-black transition hover:bg-[#ffe84d] disabled:opacity-50"
          >
            {saving
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creando…</>
              : <><UserPlus className="h-3.5 w-3.5" /> Crear onboarding</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Client card ──────────────────────────────────────────────────────────────

function ClientCard({ client }: { client: OnboardingClient }) {
  const total        = client.total_amount ?? client.installment_amount
  const cuotaAmount  = client.num_installments > 1
    ? total / client.num_installments
    : total

  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition hover:border-foreground/[0.12]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] border border-foreground/[0.08]">
            <User className="h-4 w-4 text-foreground/50" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[14px] text-foreground">{client.name}</p>
            <p className="truncate text-[11px] text-foreground/45">{client.email ?? "—"}</p>
          </div>
        </div>
        <StatusBadge status={client.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 pt-3 sm:grid-cols-4">
        {client.programa && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">Programa</p>
            <p className="mt-0.5 text-[12px] text-foreground/70">{client.programa}</p>
          </div>
        )}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">Inicio</p>
          <p className="mt-0.5 text-[12px] text-foreground/70">{fmtDate(client.program_start)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">Cuotas</p>
          <p className="mt-0.5 text-[12px] text-foreground/70">
            {client.num_installments > 1
              ? `${fmtCurrency(cuotaAmount)} × ${client.num_installments}`
              : "Pago único"}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">Total</p>
          <p className="mt-0.5 text-[12px] font-semibold text-foreground">{fmtCurrency(total)}</p>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-foreground/25">{fmtDate(client.created_at)}</p>
    </div>
  )
}

// ─── Link Generator Section ───────────────────────────────────────────────────

function LinkGeneratorSection() {
  const supabase = createClient()
  const [email,     setEmail]     = useState("")
  const [loading,   setLoading]   = useState(false)
  const [magicLink, setMagicLink] = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [copied,    setCopied]    = useState(false)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMagicLink(null)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sin sesión"); return }

      const res = await fetch("/api/admin/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: email.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? "Error al generar link"); return }
      setMagicLink(json.magicLink)
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado")
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    if (!magicLink) return
    navigator.clipboard.writeText(magicLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const inputCls = "h-10 w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 text-[13px] text-foreground placeholder:text-foreground/25 outline-none transition-all focus:border-[#ffde21]/40 focus:bg-foreground/[0.05] focus:ring-2 focus:ring-[#ffde21]/10"

  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-card p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground/[0.06] border border-foreground/[0.08]">
          <Link2 className="h-3.5 w-3.5 text-foreground/50" />
        </span>
        <div>
          <h3 className="text-[13px] font-bold text-foreground">Crear link de acceso</h3>
          <p className="text-[11px] text-foreground/40">Genera un magic link de 24hs para un cliente existente.</p>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="flex items-start gap-2">
        <div className="flex-1">
          <input
            className={inputCls}
            type="email"
            placeholder="email@cliente.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setMagicLink(null); setError(null) }}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email}
          className="flex h-10 items-center gap-2 rounded-xl bg-foreground/[0.07] border border-foreground/[0.08] px-4 text-[13px] font-medium text-foreground/70 hover:bg-foreground/[0.10] hover:text-foreground transition-colors disabled:opacity-40 shrink-0"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          Generar
        </button>
      </form>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-[12px] text-red-700 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {magicLink && (
        <div className="mt-3 rounded-xl border border-[#ffde21]/20 bg-[#ffde21]/[0.04] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/60">Link generado · válido 24hs</p>
          <div className="flex items-start gap-2">
            <p className="flex-1 break-all text-[11px] text-foreground/70 line-clamp-2">{magicLink}</p>
            <button
              onClick={copy}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#ffde21]/30 bg-[#ffde21]/10 text-[#ffde21] hover:bg-[#ffde21]/20 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payment Link Row ─────────────────────────────────────────────────────────

function PaymentLinkRow({ label, detail, url }: { label: string; detail: string; url: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-foreground/[0.07] bg-foreground/[0.02] px-4 py-3">
      <CreditCard className="h-4 w-4 shrink-0 text-foreground/30" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-foreground/45">{detail}</p>
      </div>
      <button
        onClick={copy}
        className="flex items-center gap-1.5 rounded-lg border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-1.5 text-[12px] font-medium text-foreground/60 hover:bg-foreground/[0.08] hover:text-foreground transition-colors shrink-0"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  )
}

// ─── Payment Link Section ─────────────────────────────────────────────────────

function PaymentLinkSection() {
  const supabase = createClient()
  const [type,         setType]         = useState<"once" | "recurring">("once")
  const [amount,       setAmount]       = useState("")
  const [amountPer,    setAmountPer]    = useState("")
  const [installments, setInstallments] = useState("")
  const [description,  setDescription]  = useState("")
  const [loading,      setLoading]      = useState(false)
  const [paymentUrl,   setPaymentUrl]   = useState<string | null>(null)
  const [summary,      setSummary]      = useState<string | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [copied,       setCopied]       = useState(false)

  const totalRecurring = amountPer && installments
    ? Number(amountPer) * Number(installments)
    : null

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setPaymentUrl(null); setSummary(null)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sin sesión"); return }

      const bodyPayload = type === "once"
        ? { type, amount: Number(amount), description: description || null }
        : { type, amount_per_installment: Number(amountPer), installments: Number(installments), description: description || null }

      const res = await fetch("/api/admin/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(bodyPayload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? "Error al generar link"); return }

      setPaymentUrl(json.paymentUrl)
      setSummary(type === "once"
        ? `Pago único — $${json.amount}`
        : `${json.installments} cuotas de $${json.amount_per_installment} — Total $${json.total}`
      )
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado")
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    if (!paymentUrl) return
    navigator.clipboard.writeText(paymentUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const inputCls = "h-10 w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 text-[13px] text-foreground placeholder:text-foreground/25 outline-none transition-all focus:border-[#ffde21]/40 focus:bg-foreground/[0.05] focus:ring-2 focus:ring-[#ffde21]/10"
  const labelCls = "block text-[10px] font-semibold uppercase tracking-widest text-foreground/40 mb-1.5"

  return (
    <div className="space-y-4">
    <div className="rounded-2xl border border-foreground/[0.08] bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffde21]/10 border border-[#ffde21]/20">
            <CreditCard className="h-4 w-4 text-[#ffde21]" />
          </span>
          <div>
            <h2 className="font-bold text-foreground">Crear link de pago</h2>
            <p className="text-[12px] text-foreground/45">Genera un link de Stripe para enviarle al cliente.</p>
          </div>
        </div>
        <span className="rounded-full border border-[#ffde21]/30 bg-[#ffde21]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#ffde21]/70">
          Próximamente
        </span>
      </div>

      <form onSubmit={handleGenerate} className="space-y-5 pointer-events-none opacity-40 select-none">

        {/* Tipo de pago */}
        <div className="flex gap-2">
          {([
            { key: "once",      label: "Pago único"  },
            { key: "recurring", label: "En cuotas"   },
          ] as const).map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setType(t.key); setPaymentUrl(null); setError(null) }}
              className={cn(
                "flex-1 rounded-xl border py-2 text-[13px] font-medium transition-all",
                type === t.key
                  ? "border-[#ffde21]/40 bg-[#ffde21]/10 text-[#ffde21]"
                  : "border-foreground/[0.08] bg-foreground/[0.03] text-foreground/50 hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Campos según tipo */}
        {type === "once" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Monto (USD) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" />
                <input className={cn(inputCls, "pl-8")} type="number" min="1" placeholder="1500"
                  value={amount} onChange={e => { setAmount(e.target.value); setPaymentUrl(null) }} required />
              </div>
            </div>
            <div>
              <label className={labelCls}>Descripción</label>
              <input className={inputCls} placeholder="Ej: Smart Scale Grupal" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Monto por cuota (USD) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30" />
                <input className={cn(inputCls, "pl-8")} type="number" min="1" placeholder="1500"
                  value={amountPer} onChange={e => { setAmountPer(e.target.value); setPaymentUrl(null) }} required />
              </div>
            </div>
            <div>
              <label className={labelCls}>Cantidad de cuotas *</label>
              <input className={inputCls} type="number" min="1" max="24" placeholder="6"
                value={installments} onChange={e => { setInstallments(e.target.value); setPaymentUrl(null) }} required />
            </div>
            <div>
              <label className={labelCls}>Descripción</label>
              <input className={inputCls} placeholder="Smart Scale Grupal" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            {totalRecurring && (
              <div className="sm:col-span-3 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-2.5 text-[12px] text-foreground/50">
                Total: <span className="font-bold text-foreground">${totalRecurring.toLocaleString()}</span>
                {" "}({installments} cuotas de ${Number(amountPer).toLocaleString()}/mes)
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-[12px] text-red-700 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
          </div>
        )}

        {paymentUrl && (
          <div className="rounded-xl border border-[#ffde21]/20 bg-[#ffde21]/[0.04] p-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/60">Link generado</p>
            {summary && <p className="mb-2 text-[11px] text-foreground/50">{summary}</p>}
            <div className="flex items-start gap-2">
              <a href={paymentUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 break-all text-[12px] text-[#ffde21] hover:text-[#ffe84d] underline line-clamp-2">
                {paymentUrl}
              </a>
              <button type="button" onClick={copy}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#ffde21]/30 bg-[#ffde21]/10 text-[#ffde21] hover:bg-[#ffde21]/20 transition-colors">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-foreground/[0.05] pt-4">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-5 py-2 text-[13px] font-bold text-black transition hover:bg-[#ffe84d] disabled:opacity-50">
            {loading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando…</>
              : <><CreditCard className="h-3.5 w-3.5" /> Generar link de pago</>}
          </button>
        </div>
      </form>
    </div>

    {/* Links manuales */}
    <div className="rounded-2xl border border-foreground/[0.08] bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground/[0.06] border border-foreground/[0.08]">
            <Link2 className="h-3.5 w-3.5 text-foreground/50" />
          </span>
          <div>
            <h3 className="text-[13px] font-bold text-foreground">Links de pagos</h3>
            <p className="text-[11px] text-foreground/40">Copiá el link y enviáselo al cliente.</p>
          </div>
        </div>
        <a
          href="https://app.mazefunnels.com/location/E1oNhkzQzo6coEkINu7k/payments/links"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-foreground/30 hover:text-foreground/60 transition-colors"
        >
          Gestionar en GHL →
        </a>
      </div>
      <div className="space-y-2">
        {[
          { label: "Pago único",              detail: "$6.000",                        url: "https://os.strategycoach.us/payment-link/6a0cc4bedf34fbd99ba7a380" },
          { label: "Recurrente 6 cuotas",     detail: "$1.250 / mes · Total $7.500",   url: "https://os.strategycoach.us/payment-link/6a0c8c50ee2395af2c17f43e" },
          { label: "Recurrente 6 cuotas",     detail: "$1.500 / mes · Total $9.000",   url: "https://os.strategycoach.us/payment-link/69f0b86dc970abb4095aff64" },
        ].map((link) => (
          <PaymentLinkRow key={link.url} {...link} />
        ))}
      </div>
    </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AdminOnboardingView() {
  const supabase = createClient()

  const [tab,      setTab]      = useState<"onboarding" | "payment">("onboarding")
  const [view,     setView]     = useState<"list" | "form">("list")
  const [clients,  setClients]  = useState<OnboardingClient[]>([])
  const [setters,  setSetters]  = useState<SetterProfile[]>([])
  const [loading,  setLoading]  = useState(true)
  const [success,  setSuccess]  = useState<{ name: string; email: string; tempPassword: string | null; magicLink: string | null } | null>(null)

  const loadClients = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch("/api/admin/onboarding", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (res.ok) setClients(json.clients ?? [])
    } finally {
      setLoading(false)
    }
  }, []) // createClient() es estable en SSR — no necesita en deps

  // Cargar setters del equipo para el select
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, name")
      .in("role", ["setter", "admin", "team"])
      .then(({ data }) => setSetters((data as SetterProfile[]) ?? []))
  }, []) // inicial solamente

  useEffect(() => { loadClients() }, [loadClients])

  function handleSuccess(data: { name: string; email: string; tempPassword: string | null; magicLink: string | null }) {
    setView("list")
    setSuccess(data)
    // loadClients se llama al cerrar el modal para no interrumpir la pantalla de éxito
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-1 pb-12 page-enter">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Onboarding</h1>
          <p className="mt-0.5 text-[13px] text-foreground/45">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""} registrado{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "onboarding" && (
            <>
              <button
                onClick={loadClients}
                disabled={loading}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
                title="Recargar"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </button>
              {view === "list" ? (
                <button
                  onClick={() => setView("form")}
                  className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-[13px] font-bold text-black transition hover:bg-[#ffe84d]"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Nuevo onboarding
                </button>
              ) : (
                <button
                  onClick={() => setView("list")}
                  className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-[13px] font-medium text-foreground/70 hover:bg-foreground/[0.04] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-foreground/[0.07] bg-foreground/[0.02] p-1 w-fit">
        {([
          { key: "onboarding", label: "Onboarding",      icon: UserPlus  },
          { key: "payment",    label: "Link de Pago",    icon: CreditCard },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key === "onboarding") setView("list") }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all",
              tab === t.key
                ? "bg-card border border-foreground/[0.08] text-foreground shadow-sm"
                : "text-foreground/50 hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Onboarding */}
      {tab === "onboarding" && (
        <>
          {/* Form */}
          {view === "form" && (
            <OnboardingForm
              setters={setters}
              onSuccess={handleSuccess}
              onCancel={() => setView("list")}
            />
          )}
        </>
      )}

      {/* Tab: Link de Pago */}
      {tab === "payment" && <PaymentLinkSection />}

      {/* List — solo en tab onboarding */}
      {tab === "onboarding" && view === "list" && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-foreground/30" />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-foreground/[0.08] py-16 text-center">
              <UserPlus className="mb-3 h-8 w-8 text-foreground/20" />
              <p className="font-semibold text-foreground/50">Sin onboardings aún</p>
              <p className="mt-1 text-[12px] text-foreground/30">Creá el primero con el botón de arriba.</p>
              <button
                onClick={() => setView("form")}
                className="mt-4 flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-[13px] font-bold text-black transition hover:bg-[#ffe84d]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Nuevo onboarding
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {clients.map(c => <ClientCard key={c.id} client={c} />)}
            </div>
          )}
        </>
      )}

      {/* Success modal */}
      {success && (
        <SuccessModal
          name={success.name}
          email={success.email}
          tempPassword={success.tempPassword}
          magicLink={success.magicLink}
          onClose={() => { setSuccess(null); loadClients() }}
        />
      )}
    </div>
  )
}
