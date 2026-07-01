"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import {
  UserPlus, Loader2, Check, Copy, X, ChevronRight,
  Phone, Calendar, DollarSign, User, Mail,
  RefreshCw, CheckCircle2, Clock, AlertCircle,
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
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-[14px] border border-border bg-card p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Check className="h-5 w-5 text-emerald-500" />
          </span>
          <div>
            <h3 className="font-bold text-foreground">Onboarding creado</h3>
            <p className="text-[12px] text-foreground/50">El cliente ya tiene acceso al dashboard.</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-foreground/[0.02] p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Cliente</p>
            <p className="mt-0.5 font-semibold text-foreground">{name}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Email</p>
            <p className="mt-0.5 text-[13px] text-foreground">{email}</p>
          </div>
          {magicLink && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Magic Link (acceso inmediato)</p>
              <div className="mt-1.5 flex items-start gap-2">
                <a
                  href={magicLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-[12px] text-[#ffde21] hover:text-[#ffe84d] break-all line-clamp-2 underline"
                >
                  {magicLink}
                </a>
                <button
                  onClick={() => copy(magicLink, "magic")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground/50 hover:text-foreground transition-colors"
                >
                  {copied === "magic" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-foreground/35">El cliente puede usar este link para acceder sin contraseña. Válido por 24 horas.</p>
            </div>
          )}
          {tempPassword && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Contraseña temporal</p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-[13px] text-foreground">
                  {tempPassword}
                </code>
                <button
                  onClick={() => copy(tempPassword, "password")}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground/50 hover:text-foreground transition-colors"
                >
                  {copied === "password" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-foreground/35">Alternativa si no usa magic link. Puede cambiarla desde su perfil.</p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-[#ffde21] py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe84d]"
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
    name:              "",
    email:             "",
    phone:             "",
    program:           "",
    total_amount:      "",
    cuota_1:           "",
    cuota_2:           "",
    cuota_3:           "",
    cuota_4:           "",
    cuota_5:           "",
    cuota_6:           "",
    program_start:     new Date().toISOString().slice(0, 10),
    program_duration:  "6",
    setter_id:         "",
    forma_pago:        "",
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

  // Auto-seleccionar el setter por defecto (Steffano) cuando carguen los setters
  useEffect(() => {
    if (setters.length === 0) return
    const preferido = setters.find(s => s.name?.toLowerCase().includes("steffano"))
      ?? (setters.length === 1 ? setters[0] : undefined)
    if (preferido) {
      setFields(prev => ({ ...prev, setter_id: prev.setter_id || preferido.id }))
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
          program_start:    fields.program_start,
          program_duration: Number(fields.program_duration) || 6,
          setter_id:        fields.setter_id || null,
          forma_pago:       fields.forma_pago.trim() || null,
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
    <div className="rounded-[14px] border border-border bg-card p-6">
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
              <label className={labelCls}>Duración del programa</label>
              <select className={cn(inputCls, "cursor-pointer")} value={fields.program_duration} onChange={set("program_duration")}>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}</option>
                ))}
              </select>
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
  const mrr = client.installment_amount * client.num_installments
  return (
    <div className="rounded-[14px] border border-border bg-card p-4 transition hover:border-foreground/[0.12]">
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
        {client.instagram && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">Instagram</p>
            <p className="mt-0.5 text-[12px] text-foreground/70">{client.instagram}</p>
          </div>
        )}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">Inicio</p>
          <p className="mt-0.5 text-[12px] text-foreground/70">{fmtDate(client.program_start)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">Plan</p>
          <p className="mt-0.5 text-[12px] text-foreground/70">
            {fmtCurrency(client.installment_amount)} × {client.num_installments}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">Total</p>
          <p className="mt-0.5 text-[12px] font-semibold text-foreground">{fmtCurrency(mrr)}</p>
        </div>
        {client.notes && (
          <div className="col-span-2 sm:col-span-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">Notas</p>
            <p className="mt-0.5 text-[11px] text-foreground/55 line-clamp-1">{client.notes}</p>
          </div>
        )}
      </div>

      <p className="mt-2 text-[10px] text-foreground/25">{fmtDate(client.created_at)}</p>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AdminOnboardingView() {
  const supabase = createClient()

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
    setSuccess(data)
    setView("list")
    loadClients()
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
        </div>
      </div>

      {/* Form */}
      {view === "form" && (
        <OnboardingForm
          setters={setters}
          onSuccess={handleSuccess}
          onCancel={() => setView("list")}
        />
      )}

      {/* List */}
      {view === "list" && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-foreground/30" />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-foreground/[0.08] py-16 text-center">
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
          onClose={() => setSuccess(null)}
        />
      )}
    </div>
  )
}
