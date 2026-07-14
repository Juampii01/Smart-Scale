"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { createClient } from "@/lib/supabase"
import {
  UserPlus, Loader2, Check, Copy, X, ChevronRight,
  Phone, Calendar, DollarSign, User, Mail,
  RefreshCw, CheckCircle2, Clock, AlertCircle, XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingFlowStatus {
  contract_signed_at:     string | null
  email_skool_sent_at:    string | null
  email_skool_error:      string | null
  email_slack_sent_at:    string | null
  email_slack_error:      string | null
  email_platform_sent_at: string | null
  email_platform_error:   string | null
}

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
  onboarding_flow:    OnboardingFlowStatus | null
}

interface SetterProfile {
  id:   string
  name: string | null
}

interface LeadOption {
  id:        string
  name:      string
  instagram: string | null
}

type OnboardingEmailTemplate = "skool" | "slack" | "platform"

// ─── Etapa resumida (para el punto de color en la card + los filtros) ────────

type OnboardingStage = "esperando" | "procesando" | "completo" | "error"

function getOnboardingStage(flow: OnboardingFlowStatus | null): OnboardingStage {
  if (!flow?.contract_signed_at) return "esperando"
  if (flow.email_skool_error || flow.email_slack_error || flow.email_platform_error) return "error"
  if (flow.email_skool_sent_at && flow.email_slack_sent_at && flow.email_platform_sent_at) return "completo"
  return "procesando"
}

const STAGE_META: Record<OnboardingStage, { label: string; dot: string }> = {
  esperando:  { label: "Esperando contrato",  dot: "bg-foreground/25" },
  procesando: { label: "Procesando accesos",  dot: "bg-amber-500" },
  completo:   { label: "Onboarding completo", dot: "bg-emerald-500" },
  error:      { label: "Con errores",         dot: "bg-red-500" },
}

function StageIndicator({ stage }: { stage: OnboardingStage }) {
  const meta = STAGE_META[stage]
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/50">
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", meta.dot)} />
      {meta.label}
    </span>
  )
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function copy(text: string, type: "password" | "magic") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  if (!mounted) return null

  // Portal directo a document.body — el contenedor de la vista tiene la
  // animación .page-enter (transform: translateY), y cualquier transform en
  // un ancestro rompe el posicionamiento de "fixed" (queda relativo a ese
  // ancestro en vez del viewport completo), lo que hacía que este modal
  // apareciera corrido hacia abajo en vez de centrado en pantalla.
  return createPortal(
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
    </div>,
    document.body
  )
}

// ─── Onboarding Form ──────────────────────────────────────────────────────────

function OnboardingForm({
  setters, leadOptions, onSuccess, onCancel,
}: {
  setters:     SetterProfile[]
  leadOptions: LeadOption[]
  onSuccess:   (data: { name: string; email: string; tempPassword: string | null; magicLink: string | null }) => void
  onCancel:    () => void
}) {
  const supabase = createClient()

  const [fields, setFields] = useState({
    name:              "",
    email:             "",
    phone:             "",
    address:           "",
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
    lead_id:           "",
  })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [leadQuery, setLeadQuery] = useState("")
  const [leadPickerOpen, setLeadPickerOpen] = useState(false)

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
          address:      fields.address.trim()   || null,
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
          lead_id:          fields.lead_id || null,
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
            <div>
              <label className={labelCls}>Domicilio</label>
              <input className={inputCls} placeholder="Calle 123, Ciudad" value={fields.address} onChange={set("address")} />
            </div>
            <div className="relative">
              <label className={labelCls}>Lead de origen (opcional)</label>
              <input
                className={inputCls}
                placeholder="Buscar por nombre o instagram..."
                value={fields.lead_id ? (leadOptions.find(l => l.id === fields.lead_id)?.name ?? "") : leadQuery}
                onChange={e => {
                  setLeadQuery(e.target.value)
                  if (fields.lead_id) setFields(prev => ({ ...prev, lead_id: "" }))
                  setLeadPickerOpen(true)
                }}
                onFocus={() => setLeadPickerOpen(true)}
                onBlur={() => setTimeout(() => setLeadPickerOpen(false), 150)}
              />
              {fields.lead_id && (
                <button
                  type="button"
                  onClick={() => { setFields(prev => ({ ...prev, lead_id: "" })); setLeadQuery("") }}
                  className="absolute right-2.5 top-[34px] text-foreground/30 hover:text-foreground"
                  aria-label="Quitar lead vinculado"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {leadPickerOpen && leadQuery.trim().length > 0 && !fields.lead_id && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                  {leadOptions
                    .filter(l =>
                      l.name.toLowerCase().includes(leadQuery.toLowerCase()) ||
                      (l.instagram ?? "").toLowerCase().includes(leadQuery.toLowerCase())
                    )
                    .slice(0, 8)
                    .map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onMouseDown={() => { setFields(prev => ({ ...prev, lead_id: l.id })); setLeadQuery(""); setLeadPickerOpen(false) }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-foreground/[0.05]"
                      >
                        <span className="truncate">{l.name}</span>
                        {l.instagram && <span className="shrink-0 text-[11px] text-foreground/40">{l.instagram}</span>}
                      </button>
                    ))}
                  {leadOptions.filter(l => l.name.toLowerCase().includes(leadQuery.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-[12px] text-foreground/40">Sin resultados</p>
                  )}
                </div>
              )}
              <p className="mt-1 text-[10px] text-foreground/30">Vincula este cliente a su lead de origen para el análisis de Ann AI.</p>
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

function ClientCard({ client, onClick }: { client: OnboardingClient; onClick: () => void }) {
  const mrr = client.installment_amount * client.num_installments
  const stage = getOnboardingStage(client.onboarding_flow)
  return (
    <button
      onClick={onClick}
      className="w-full rounded-[14px] border border-border bg-card p-4 text-left transition hover:border-foreground/[0.12] hover:bg-foreground/[0.015]"
    >
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

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-foreground/25">{fmtDate(client.created_at)}</p>
        <StageIndicator stage={stage} />
      </div>
    </button>
  )
}

// ─── Onboarding detail drawer ─────────────────────────────────────────────────

type TimelineState = "done" | "pending" | "error" | "locked"

function TimelineStep({
  label, state, error, onAction, actionLabel, actionLoading, last,
}: {
  label:         string
  state:         TimelineState
  error?:        string | null
  onAction?:     () => void
  actionLabel?:  string
  actionLoading?: boolean
  last?:         boolean
}) {
  const Icon = state === "done" ? CheckCircle2 : state === "error" ? XCircle : Clock
  const iconCls =
    state === "done"  ? "border-emerald-200 dark:border-emerald-500/20 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
    state === "error" ? "border-red-200 dark:border-red-500/20 bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400" :
    "border-foreground/[0.1] bg-foreground/[0.04] text-foreground/35"

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", iconCls)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        {!last && <div className="w-px flex-1 bg-border" />}
      </div>
      <div className={cn("min-w-0", !last && "pb-5")}>
        <p className="text-[13px] font-semibold text-foreground">{label}</p>
        {state === "locked" && <p className="mt-0.5 text-[11px] text-foreground/35">Esperando etapa anterior</p>}
        {error && <p className="mt-0.5 text-[11px] text-red-700 dark:text-red-400">{error}</p>}
        {onAction && (
          <button
            onClick={onAction}
            disabled={actionLoading}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-foreground/[0.1] px-2.5 py-1 text-[11px] font-semibold text-foreground/70 transition-colors hover:bg-foreground/[0.05] disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

function OnboardingDetailDrawer({
  client, onClose, onMarkSigned, onResend, busyMarkSigned, busyResendTemplate, actionError,
}: {
  client:              OnboardingClient
  onClose:             () => void
  onMarkSigned:        () => void
  onResend:            (template: OnboardingEmailTemplate) => void
  busyMarkSigned:      boolean
  busyResendTemplate:  OnboardingEmailTemplate | null
  actionError:         string | null
}) {
  const flow = client.onboarding_flow
  const contractSigned = !!flow?.contract_signed_at

  function emailState(sentAt?: string | null, error?: string | null): TimelineState {
    if (!contractSigned) return "locked"
    if (sentAt) return "done"
    if (error) return "error"
    return "pending"
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[440px] flex-col border-l border-foreground/[0.08] shadow-2xl" style={{ backgroundColor: "var(--card)" }}>

        <div className="flex items-start justify-between gap-4 border-b border-foreground/[0.06] px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-foreground">{client.name}</h2>
            <p className="mt-0.5 truncate text-[12px] text-foreground/35">{client.email}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground/30 transition-all hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {actionError && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[12px] text-red-700 dark:text-red-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {actionError}
            </div>
          )}

          <TimelineStep label="Cuenta creada" state="done" />

          <TimelineStep
            label="Contrato firmado"
            state={contractSigned ? "done" : "pending"}
            onAction={!contractSigned ? onMarkSigned : undefined}
            actionLabel="Marcar como firmado"
            actionLoading={busyMarkSigned}
          />

          {(["skool", "slack", "platform"] as const).map((template, i) => {
            const sentAt = template === "skool" ? flow?.email_skool_sent_at : template === "slack" ? flow?.email_slack_sent_at : flow?.email_platform_sent_at
            const emailError = template === "skool" ? flow?.email_skool_error : template === "slack" ? flow?.email_slack_error : flow?.email_platform_error
            const state = emailState(sentAt, emailError)
            const label = template === "skool" ? "Email: acceso a Skool" : template === "slack" ? "Email: acceso a Slack" : "Email: acceso a la plataforma"
            // Reintentar si falló, Reenviar si ya salió bien (por si el cliente dice que no le llegó) — no hay acción mientras está bloqueado o pendiente.
            const canAct = state === "error" || state === "done"
            return (
              <TimelineStep
                key={template}
                label={label}
                state={state}
                error={emailError}
                onAction={canAct ? () => onResend(template) : undefined}
                actionLabel={state === "error" ? "Reintentar" : "Reenviar"}
                actionLoading={busyResendTemplate === template}
                last={i === 2}
              />
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── Vistas rápidas por etapa ─────────────────────────────────────────────────

type OnboardingViewId = "todos" | "esperando" | "errores"
const ONBOARDING_VIEWS: { id: OnboardingViewId; label: string }[] = [
  { id: "todos",     label: "Todos" },
  { id: "esperando", label: "Esperando contrato" },
  { id: "errores",   label: "Con errores" },
]

// ─── Main view ────────────────────────────────────────────────────────────────

export function AdminOnboardingView() {
  const supabase = createClient()

  const [view,       setView]       = useState<"list" | "form">("list")
  const [clients,    setClients]    = useState<OnboardingClient[]>([])
  const [setters,    setSetters]    = useState<SetterProfile[]>([])
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([])
  const [loading,    setLoading]    = useState(true)
  const [success,    setSuccess]    = useState<{ name: string; email: string; tempPassword: string | null; magicLink: string | null } | null>(null)
  const [activeView, setActiveView] = useState<OnboardingViewId>("todos")

  const [selectedClientId,     setSelectedClientId]     = useState<string | null>(null)
  const [busyMarkSigned,       setBusyMarkSigned]       = useState(false)
  const [busyResendTemplate,   setBusyResendTemplate]   = useState<OnboardingEmailTemplate | null>(null)
  const [drawerError,          setDrawerError]          = useState<string | null>(null)

  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null

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

  // Cargar leads recientes para vincular el onboarding a su lead de origen
  useEffect(() => {
    supabase
      .from("leads")
      .select("id, name, instagram")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => setLeadOptions((data as LeadOption[]) ?? []))
  }, []) // inicial solamente

  useEffect(() => { loadClients() }, [loadClients])

  function handleSuccess(data: { name: string; email: string; tempPassword: string | null; magicLink: string | null }) {
    setSuccess(data)
    setView("list")
    loadClients()
  }

  async function handleMarkSigned() {
    if (!selectedClientId) return
    setDrawerError(null)
    setBusyMarkSigned(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/admin/onboarding/${selectedClientId}/mark-contract-signed`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) { setDrawerError(json?.error ?? "No se pudo marcar el contrato como firmado"); return }
      await loadClients()
    } finally {
      setBusyMarkSigned(false)
    }
  }

  async function handleResend(template: OnboardingEmailTemplate) {
    if (!selectedClientId) return
    setDrawerError(null)
    setBusyResendTemplate(template)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/admin/onboarding/${selectedClientId}/resend-email`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ template }),
      })
      const json = await res.json()
      if (!res.ok) { setDrawerError(json?.error ?? "No se pudo reenviar el email"); return }
      await loadClients()
    } finally {
      setBusyResendTemplate(null)
    }
  }

  const filteredClients = clients.filter(c => {
    const stage = getOnboardingStage(c.onboarding_flow)
    if (activeView === "esperando") return stage === "esperando"
    if (activeView === "errores")   return stage === "error"
    return true
  })

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
          leadOptions={leadOptions}
          onSuccess={handleSuccess}
          onCancel={() => setView("list")}
        />
      )}

      {/* List */}
      {view === "list" && (
        <>
          {/* Vistas rápidas por etapa */}
          {clients.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-foreground/[0.06] pb-3">
              {ONBOARDING_VIEWS.map(v => (
                <button
                  key={v.id}
                  onClick={() => setActiveView(v.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-8 rounded-lg px-3 text-[12.5px] font-semibold transition-all",
                    activeView === v.id
                      ? "bg-foreground text-background"
                      : "text-foreground/45 hover:text-foreground hover:bg-foreground/[0.05]"
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

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
          ) : filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-foreground/[0.08] py-16 text-center">
              <p className="font-semibold text-foreground/50">Nada en esta vista</p>
              <p className="mt-1 text-[12px] text-foreground/30">Probá con otro filtro.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredClients.map(c => (
                <ClientCard key={c.id} client={c} onClick={() => setSelectedClientId(c.id)} />
              ))}
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

      {/* Detail drawer */}
      {selectedClient && (
        <OnboardingDetailDrawer
          client={selectedClient}
          onClose={() => { setSelectedClientId(null); setDrawerError(null) }}
          onMarkSigned={handleMarkSigned}
          onResend={handleResend}
          busyMarkSigned={busyMarkSigned}
          busyResendTemplate={busyResendTemplate}
          actionError={drawerError}
        />
      )}
    </div>
  )
}
