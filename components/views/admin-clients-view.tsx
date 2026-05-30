"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Plus, Trash2, RefreshCw, X, ChevronRight,
  CheckCircle2, Circle, AlertCircle, Clock, Users,
  DollarSign, Calendar, Mail,
  MessageCircle, PhoneCall, MoreHorizontal,
  Check, ChevronUp, ChevronDown, ChevronsUpDown, UserX,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Installment {
  id:                 string
  client_id:          string
  installment_number: number
  due_date:           string
  amount:             number
  paid_at:            string | null
  notes:              string | null
  status:             "pagado" | "pendiente" | "vencido"
}

interface Followup {
  id:             string
  client_id:      string
  scheduled_date: string
  type:           "whatsapp" | "llamada" | "email" | "otro"
  notes:          string | null
  completed:      boolean
  created_at:     string
}

interface Client {
  id:                 string
  name:               string
  email:              string | null
  instagram:          string | null
  phone:              string | null
  programa:            string | null
  forma_pago:          string | null
  total_amount:        number | null
  address:             string | null
  dashboard_email:     string | null
  dashboard_password:  string | null
  program_start:       string
  program_duration:    number   // meses de programa
  num_installments:    number   // cantidad de cuotas de pago
  installment_amount:  number
  is_monthly_subscription: boolean
  status:              "activo" | "en_pausa" | "inactivo" | "completado"
  notes:              string | null
  created_at:         string
  updated_at:         string
  installments:       Installment[]
  followups:          Followup[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("es-AR", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  })
}

function fmtDateShort(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""))
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]
  return `${d.getDate()} ${months[d.getMonth()]} '${d.getFullYear().toString().slice(2)}`
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T12:00:00")
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split("T")[0]
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + "T12:00:00")
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function clientHasOverdue(client: Client): boolean {
  return client.installments.some(i => i.status === "vencido")
}

function clientHasUpcoming(client: Client): boolean {
  if (clientHasOverdue(client)) return false
  return client.installments.some(i => {
    if (i.status !== "pendiente") return false
    const days = daysUntil(i.due_date)
    return days >= 0 && days <= 7
  })
}

function nextFollowup(client: Client): Followup | null {
  const pending = client.followups
    .filter(f => !f.completed)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  return pending[0] ?? null
}

// ─── Style constants ──────────────────────────────────────────────────────────

// Pills dual-mode: en light el texto baja a -800 (legible sobre bg-x-100/x-50);
// en dark sube a -300 (legible sobre bg-x-500/10). Bordes con poca opacidad.
const CLIENT_STATUS_STYLE: Record<string, string> = {
  activo:     "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
  en_pausa:   "bg-amber-100   text-amber-800   border-amber-300   dark:bg-amber-500/10   dark:text-amber-300   dark:border-amber-500/25",
  inactivo:   "bg-red-100     text-red-800     border-red-300     dark:bg-red-500/10     dark:text-red-300     dark:border-red-500/25",
  completado: "bg-sky-100     text-sky-800     border-sky-300     dark:bg-sky-500/10     dark:text-sky-300     dark:border-sky-500/25",
}

const CLIENT_STATUS_LABEL: Record<string, string> = {
  activo:     "Activo",
  en_pausa:   "En pausa",
  inactivo:   "Inactivo",
  completado: "Finalizado",
}

const INST_STATUS_STYLE: Record<string, string> = {
  pagado:    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
  pendiente: "bg-amber-100   text-amber-800   border-amber-300   dark:bg-amber-500/10   dark:text-amber-300   dark:border-amber-500/25",
  vencido:   "bg-red-100     text-red-800     border-red-300     dark:bg-red-500/10     dark:text-red-300     dark:border-red-500/25",
}

const FOLLOWUP_TYPE_STYLE: Record<string, string> = {
  whatsapp: "bg-pink-100   text-pink-800   border-pink-300   dark:bg-pink-500/10   dark:text-pink-300   dark:border-pink-500/25",
  llamada:  "bg-blue-100   text-blue-800   border-blue-300   dark:bg-blue-500/10   dark:text-blue-300   dark:border-blue-500/25",
  email:    "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/25",
  otro:     "bg-foreground/[0.05] text-foreground/60 border-foreground/[0.10] dark:text-foreground/50",
}

const FOLLOWUP_TYPE_ICON: Record<string, React.ReactNode> = {
  whatsapp: <MessageCircle className="h-3 w-3" />,
  llamada:  <PhoneCall className="h-3 w-3" />,
  email:    <Mail className="h-3 w-3" />,
  otro:     <MoreHorizontal className="h-3 w-3" />,
}

const inputCls = "w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all"
const labelCls = "text-[10px] font-bold uppercase tracking-widest text-foreground/25"

// ─── Webhook Card ─────────────────────────────────────────────────────────────

function WebhookCard() {
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    setUrl(`${window.location.origin}/api/webhooks/client`)
  }, [])

  const copy = () => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-foreground/[0.07] bg-card px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mb-2">
        Webhook URL — Zapier / Formulario de onboarding
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-lg bg-foreground/[0.04] px-3 py-2 text-[12px] text-[#ffde21]/70 font-mono truncate" suppressHydrationWarning>
          {url ?? "Cargando…"}
        </code>
        <button onClick={copy} disabled={!url}
          className="shrink-0 h-8 rounded-lg border border-foreground/[0.08] px-3 text-[12px] text-foreground/40 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40">
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
      <p className="text-[11px] text-foreground/25 mt-1.5">
        Campos: <code className="text-foreground/40">nombre</code>, <code className="text-foreground/40">email</code>, <code className="text-foreground/40">telefono</code>, <code className="text-foreground/40">fecha_cierre</code>, <code className="text-foreground/40">programa</code>, <code className="text-foreground/40">cantidad_meses</code> (duración del programa), <code className="text-foreground/40">cantidad_pagos</code> (cuotas de pago), <code className="text-foreground/40">primer_pago</code>, <code className="text-foreground/40">mes_2</code>…<code className="text-foreground/40">mes_6</code>
      </p>
    </div>
  )
}

// ─── Installment Row (amount editable inline) ─────────────────────────────────

function InstallmentRow({
  inst,
  togglingInst,
  onToggle,
  onPatchAmount,
}: {
  inst:          Installment
  togglingInst:  string | null
  onToggle:      () => void
  onPatchAmount: (amount: number) => Promise<void>
}) {
  const [editing,  setEditing]  = useState(false)
  const [rawValue, setRawValue] = useState(String(inst.amount))
  const [saving,   setSaving]   = useState(false)

  // Sync if parent updates the amount (e.g. after optimistic rollback)
  useEffect(() => {
    if (!editing) setRawValue(String(inst.amount))
  }, [inst.amount, editing])

  const handleBlur = async () => {
    const parsed = parseFloat(rawValue.replace(/[^0-9.]/g, ""))
    if (isNaN(parsed) || parsed === inst.amount) {
      setRawValue(String(inst.amount))
      setEditing(false)
      return
    }
    setSaving(true)
    await onPatchAmount(parsed)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-3 space-y-2">
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground/[0.06] text-[11px] font-bold text-foreground/60 shrink-0">
          {inst.installment_number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Monto editable — click o Tab para activar */}
            {editing ? (
              <div className="flex items-center gap-1">
                <span className="text-[12px] text-foreground/40">$</span>
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  value={rawValue}
                  onChange={e => setRawValue(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={e => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                    if (e.key === "Escape") { setRawValue(String(inst.amount)); setEditing(false) }
                  }}
                  disabled={saving}
                  className="w-24 rounded-lg border border-[#ffde21]/40 bg-[#ffde21]/[0.05] px-2 py-0.5 text-[13px] font-semibold text-foreground focus:outline-none focus:border-[#ffde21]/70 disabled:opacity-50"
                />
                {saving && <Loader2 className="h-3 w-3 animate-spin text-foreground/40" />}
              </div>
            ) : (
              <button
                onClick={() => { if (inst.status !== "pagado") setEditing(true) }}
                title={inst.status === "pagado" ? "No se puede editar una cuota ya pagada" : "Click para editar el monto"}
                className={`text-[13px] font-semibold text-foreground rounded px-1 -mx-1 transition-all ${
                  inst.status !== "pagado"
                    ? "hover:bg-[#ffde21]/10 hover:text-[#ffde21] cursor-pointer"
                    : "cursor-default"
                }`}
              >
                {fmtMoney(inst.amount)}
              </button>
            )}
            <span className="text-[12px] text-foreground/40">{fmtDate(inst.due_date)}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${INST_STATUS_STYLE[inst.status]}`}>
              {inst.status}
            </span>
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={togglingInst === inst.id || saving || editing}
          className={`shrink-0 h-7 rounded-lg border px-2.5 text-[11px] font-semibold transition-all disabled:opacity-40 ${
            inst.status === "pagado"
              ? "border-red-300 text-red-700 hover:bg-red-100 dark:border-red-500/25 dark:text-red-300 dark:hover:bg-red-500/10"
              : "border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/25 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
          }`}>
          {togglingInst === inst.id
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : inst.status === "pagado" ? "Desmarcar" : "Marcar pagado"}
        </button>
      </div>
      {inst.paid_at && (
        <p className="text-[11px] text-foreground/35 pl-9">Pagado el {fmtDate(inst.paid_at)}</p>
      )}
    </div>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  client,
  onClose,
  onPatchClient,
  onToggleInstallment,
  onPatchInstallmentAmount,
  onAddFollowup,
  onToggleFollowup,
  onDeleteFollowup,
  onDeleteClient,
  onOffboard,
  deleting,
  offboarding,
}: {
  client:              Client
  onClose:             () => void
  onPatchClient:       (id: string, updates: Partial<Client>) => Promise<void>
  onToggleInstallment:       (installmentId: string, currentPaidAt: string | null) => Promise<void>
  onPatchInstallmentAmount:  (installmentId: string, amount: number) => Promise<void>
  onAddFollowup:             (clientId: string, data: any) => Promise<void>
  onToggleFollowup:    (followupId: string) => Promise<void>
  onDeleteFollowup:    (followupId: string) => Promise<void>
  onDeleteClient:      (id: string) => Promise<void>
  onOffboard:          (id: string) => Promise<void>
  deleting:            boolean
  offboarding:         boolean
}) {
  const [showFollowupForm, setShowFollowupForm]   = useState(false)
  const [fuDate,           setFuDate]             = useState(todayStr())
  const [fuType,           setFuType]             = useState<Followup["type"]>("whatsapp")
  const [fuNotes,          setFuNotes]            = useState("")
  const [savingFu,         setSavingFu]           = useState(false)
  const [togglingInst,     setTogglingInst]       = useState<string | null>(null)
  const [togglingFu,       setTogglingFu]         = useState<string | null>(null)
  const [deletingFuId,     setDeletingFuId]       = useState<string | null>(null)

  const handleSaveFollowup = async () => {
    if (!fuDate) return
    setSavingFu(true)
    await onAddFollowup(client.id, { scheduled_date: fuDate, followup_type: fuType, notes: fuNotes || null })
    setFuDate(todayStr())
    setFuType("whatsapp")
    setFuNotes("")
    setShowFollowupForm(false)
    setSavingFu(false)
  }

  const handleToggleInst = async (inst: Installment) => {
    setTogglingInst(inst.id)
    await onToggleInstallment(inst.id, inst.paid_at)
    setTogglingInst(null)
  }

  const handleToggleFu = async (fu: Followup) => {
    setTogglingFu(fu.id)
    await onToggleFollowup(fu.id)
    setTogglingFu(null)
  }

  const handleDeleteFu = async (fuId: string) => {
    setDeletingFuId(fuId)
    await onDeleteFollowup(fuId)
    setDeletingFuId(null)
  }

  const endDate = addMonths(client.program_start, client.program_duration ?? client.num_installments)
  const paidCount = client.installments.filter(i => i.status === "pagado").length

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[480px] flex-col border-l border-foreground/[0.08] shadow-2xl" style={{ backgroundColor: "var(--card)" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-foreground/[0.06] px-6 py-5" style={{ backgroundColor: "var(--card)" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground truncate">{client.name}</h2>
              {client.is_monthly_subscription && (
                <span className="inline-flex items-center rounded-full border border-[#ffde21]/30 bg-[#ffde21]/[0.08] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#ffde21] shrink-0">
                  Mensual
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CLIENT_STATUS_STYLE[client.status] ?? ""}`}>
                {CLIENT_STATUS_LABEL[client.status] ?? client.status}
              </span>
              <span className="text-[12px] text-foreground/30">desde {fmtDate(client.program_start)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Dar de baja — solo visible si está activo/en_pausa */}
            {client.status !== "inactivo" && (
              <button
                onClick={() => onOffboard(client.id)}
                disabled={offboarding || deleting}
                aria-label="Dar de baja"
                title="Dar de baja: marca inactivo y elimina cuotas pendientes"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-300/40 px-2.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100/60 dark:border-amber-500/25 dark:text-amber-400 dark:hover:bg-amber-500/10 transition-all disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde21]/40"
              >
                {offboarding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                {!offboarding && <span>Dar de baja</span>}
              </button>
            )}
            <button onClick={() => onDeleteClient(client.id)} disabled={deleting || offboarding} aria-label="Eliminar cliente"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/20 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition-all disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde21]/40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose} aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde21]/40">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--card)" }}>

          {/* Section 1: Info fields */}
          <div className="px-6 py-5 space-y-4 border-b border-foreground/[0.06]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Información</p>

            <div className="space-y-1.5">
              <p className={labelCls}>Nombre</p>
              <input
                type="text"
                defaultValue={client.name}
                onBlur={e    => onPatchClient(client.id, { name: e.target.value || client.name })}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className={labelCls}>Email</p>
                <input
                  type="email"
                  defaultValue={client.email ?? ""}
                  placeholder="correo@ejemplo.com"
                  onBlur={e    => onPatchClient(client.id, { email: e.target.value || null })}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <p className={labelCls}>Teléfono</p>
                <input
                  type="text"
                  defaultValue={client.phone ?? ""}
                  placeholder="+54 11..."
                  onBlur={e    => onPatchClient(client.id, { phone: e.target.value || null })}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className={labelCls}>Instagram</p>
                <input
                  type="text"
                  defaultValue={client.instagram ?? ""}
                  placeholder="@usuario"
                  onBlur={e    => onPatchClient(client.id, { instagram: e.target.value || null })}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <p className={labelCls}>Estado</p>
                <select
                  defaultValue={client.status}
                  onChange={e => onPatchClient(client.id, { status: e.target.value as Client["status"] })}
                  className="w-full appearance-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground focus:border-foreground/20 focus:outline-none transition-all">
                  <option value="activo">Activo</option>
                  <option value="en_pausa">En pausa</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="completado">Finalizado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className={labelCls}>Programa</p>
                <input
                  type="text"
                  defaultValue={client.programa ?? ""}
                  placeholder="Nombre del programa"
                  onBlur={e    => onPatchClient(client.id, { programa: e.target.value || null } as any)}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <p className={labelCls}>Forma de pago</p>
                <input
                  type="text"
                  defaultValue={client.forma_pago ?? ""}
                  placeholder="ej: cuotas, contado..."
                  onBlur={e    => onPatchClient(client.id, { forma_pago: e.target.value || null } as any)}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Plan mensual toggle */}
            <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3 flex items-start gap-3">
              <input
                type="checkbox"
                id={`monthly-${client.id}`}
                defaultChecked={!!client.is_monthly_subscription}
                onChange={e => onPatchClient(client.id, { is_monthly_subscription: e.target.checked } as any)}
                className="mt-0.5 h-4 w-4 rounded border-foreground/20 bg-foreground/[0.05] accent-[#ffde21] cursor-pointer"
              />
              <label htmlFor={`monthly-${client.id}`} className="flex-1 cursor-pointer">
                <p className="text-[13px] font-semibold text-foreground">Plan mensual auto-renovable</p>
                <p className="text-[11px] text-foreground/40 mt-0.5 leading-snug">
                  Cuando se marque la cuota como pagada, el sistema genera la siguiente automáticamente. Slack alerta 5 días antes de cada cobro. Apagá esto para finalizar la suscripción.
                </p>
              </label>
            </div>

            <div className="space-y-1.5">
              <p className={labelCls}>Dirección</p>
              <input
                type="text"
                defaultValue={client.address ?? ""}
                placeholder="Dirección del cliente"
                onBlur={e    => onPatchClient(client.id, { address: e.target.value || null } as any)}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <p className={labelCls}>Notas</p>
              <textarea
                defaultValue={client.notes ?? ""}
                placeholder="Observaciones, contexto..."
                rows={3}
                onBlur={e    => onPatchClient(client.id, { notes: e.target.value || null })}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) (e.target as HTMLTextAreaElement).blur() }}
                className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 text-[13px] text-foreground placeholder:text-foreground/40 focus:border-foreground/20 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Section: Credenciales del dashboard */}
          <div className="px-6 py-5 space-y-4 border-b border-foreground/[0.06]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Credenciales del Dashboard</p>
            <div className="space-y-1.5">
              <p className={labelCls}>Email de acceso</p>
              <input
                type="email"
                defaultValue={client.dashboard_email ?? ""}
                placeholder="correo@acceso.com"
                onBlur={e    => onPatchClient(client.id, { dashboard_email: e.target.value || null } as any)}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <p className={labelCls}>Contraseña</p>
              <input
                type="text"
                defaultValue={client.dashboard_password ?? ""}
                placeholder="Contraseña del cliente"
                onBlur={e    => onPatchClient(client.id, { dashboard_password: e.target.value || null } as any)}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                className={inputCls}
              />
            </div>
          </div>

          {/* Section 2: Installments */}
          <div className="px-6 py-5 space-y-3 border-b border-foreground/[0.06]">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Cuotas de pago</p>
                {/* Duración del programa — editable */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-foreground/35">Duración del programa:</span>
                  <select
                    value={client.program_duration ?? client.num_installments}
                    onChange={e => onPatchClient(client.id, { program_duration: Number(e.target.value) } as any)}
                    className="h-6 rounded-lg border border-foreground/[0.1] bg-foreground/[0.04] px-2 text-[11px] font-semibold text-foreground focus:border-[#ffde21]/40 focus:outline-none"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>{m} {m === 1 ? "mes" : "meses"}</option>
                    ))}
                  </select>
                  <span className="text-[11px] text-foreground/30">
                    · {client.num_installments} cuota{client.num_installments !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-foreground/[0.05] px-2.5 py-0.5 text-[11px] font-bold text-foreground/50 shrink-0">
                {paidCount}/{client.num_installments} pagadas
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#ffde21] transition-all duration-500"
                style={{ width: `${client.num_installments > 0 ? (paidCount / client.num_installments) * 100 : 0}%` }}
              />
            </div>

            <div className="space-y-2">
              {client.installments.map(inst => (
                <InstallmentRow
                  key={inst.id}
                  inst={inst}
                  togglingInst={togglingInst}
                  onToggle={() => handleToggleInst(inst)}
                  onPatchAmount={async (newAmt) => {
                    await onPatchInstallmentAmount(inst.id, newAmt)
                  }}
                />
              ))}

              {client.installments.length === 0 && (
                <p className="text-[12px] text-foreground/25 text-center py-3">Sin cuotas generadas.</p>
              )}
            </div>
          </div>

          {/* Section 3: Follow-ups */}
          <div className="px-6 py-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Seguimientos</p>
              <button
                onClick={() => setShowFollowupForm(v => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-foreground/[0.08] text-foreground/40 hover:text-[#ffde21] hover:border-[#ffde21]/30 transition-all">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Add followup form */}
            {showFollowupForm && (
              <div className="rounded-xl border border-[#ffde21]/15 bg-[#ffde21]/[0.02] p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className={labelCls}>Fecha</p>
                    <input type="date" value={fuDate} onChange={e => setFuDate(e.target.value)}
                      className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-2 text-[12px] text-foreground focus:border-foreground/20 focus:outline-none [color-scheme:dark]" />
                  </div>
                  <div className="space-y-1">
                    <p className={labelCls}>Tipo</p>
                    <select value={fuType} onChange={e => setFuType(e.target.value as Followup["type"])}
                      className="w-full appearance-none rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-2 text-[12px] text-foreground focus:border-foreground/20 focus:outline-none">
                      <option value="whatsapp">WhatsApp</option>
                      <option value="llamada">Llamada</option>
                      <option value="email">Email</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                </div>
                <input value={fuNotes} onChange={e => setFuNotes(e.target.value)}
                  placeholder="Notas del seguimiento..."
                  className="w-full rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-2 text-[12px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none" />
                <div className="flex items-center gap-2">
                  <button onClick={handleSaveFollowup} disabled={savingFu || !fuDate}
                    className="flex items-center gap-1.5 h-7 rounded-lg bg-[#ffde21] px-3 text-[12px] font-bold text-black hover:bg-[#ffe84d] disabled:opacity-40 transition-all">
                    {savingFu ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Guardar
                  </button>
                  <button onClick={() => setShowFollowupForm(false)}
                    className="h-7 rounded-lg border border-foreground/[0.08] px-3 text-[12px] text-foreground/40 hover:text-foreground transition-all">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Followup list */}
            <div className="space-y-2">
              {client.followups
                .slice()
                .sort((a, b) => {
                  if (a.completed !== b.completed) return a.completed ? 1 : -1
                  return a.scheduled_date.localeCompare(b.scheduled_date)
                })
                .map(fu => (
                  <div key={fu.id} className={`rounded-xl border p-3 flex items-start gap-3 group transition-all ${
                    fu.completed ? "border-foreground/[0.04] bg-foreground/[0.01] opacity-50" : "border-foreground/[0.07] bg-foreground/[0.02]"
                  }`}>
                    <button
                      onClick={() => handleToggleFu(fu)}
                      disabled={togglingFu === fu.id}
                      className="mt-0.5 shrink-0 text-foreground/30 hover:text-emerald-400 transition-colors disabled:opacity-40">
                      {togglingFu === fu.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : fu.completed
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          : <Circle className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-foreground/80">{fmtDate(fu.scheduled_date)}</span>
                        <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${FOLLOWUP_TYPE_STYLE[fu.type]}`}>
                          {FOLLOWUP_TYPE_ICON[fu.type]}
                          {fu.type}
                        </span>
                        {fu.scheduled_date === todayStr() && !fu.completed && (
                          <span className="rounded-full bg-[#ffde21]/10 border border-[#ffde21]/20 px-2 py-0.5 text-[10px] font-bold text-[#ffde21]">hoy</span>
                        )}
                      </div>
                      {fu.notes && (
                        <p className="text-[11px] text-foreground/40 mt-1">{fu.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteFu(fu.id)}
                      disabled={deletingFuId === fu.id}
                      className="shrink-0 opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-lg text-foreground/15 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
                      {deletingFuId === fu.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                ))}

              {client.followups.length === 0 && !showFollowupForm && (
                <p className="text-[12px] text-foreground/25 text-center py-3">Sin seguimientos agendados.</p>
              )}
            </div>
          </div>

        </div>

        {/* Footer with summary */}
        <div className="border-t border-foreground/[0.06] px-6 py-3" style={{ backgroundColor: "var(--card)" }}>
          <div className="flex items-center gap-4 text-[11px] text-foreground/30">
            <span>
              Fin estimado:{" "}
              <span className="text-foreground/60 font-semibold">{fmtDate(endDate)}</span>
            </span>
            <span>
              Total:{" "}
              <span className="text-foreground/60 font-semibold">
                {fmtMoney(
                  client.total_amount ??
                  (client.installments.reduce((s, i) => s + i.amount, 0) ||
                  client.installment_amount * client.num_installments)
                )}
              </span>
            </span>
          </div>
        </div>

      </div>
    </>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ clients }: { clients: Client[] }) {
  const today = todayStr()
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear  = now.getFullYear()

  const activeCount = clients.filter(c => c.status === "activo").length

  const cobradoEsteMes = clients.reduce((sum, c) =>
    sum + c.installments
      .filter(i => {
        if (!i.paid_at) return false
        const d = new Date(i.paid_at)
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      .reduce((s, i) => s + i.amount, 0)
  , 0)

  const porCobrarEsteMes = clients.reduce((sum, c) =>
    sum + c.installments
      .filter(i => {
        if (i.paid_at) return false
        const d = new Date(i.due_date + "T12:00:00")
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      .reduce((s, i) => s + i.amount, 0)
  , 0)

  const followupsHoy = clients.reduce((count, c) =>
    count + c.followups.filter(f => !f.completed && f.scheduled_date === today).length
  , 0)

  const cards = [
    {
      label: "Clientes activos",
      value: String(activeCount),
      color: "text-foreground",
      icon:  <Users className="h-4 w-4" />,
    },
    {
      label: "Cobrado este mes",
      value: fmtMoney(cobradoEsteMes),
      color: "text-emerald-700 dark:text-emerald-300",
      icon:  <DollarSign className="h-4 w-4" />,
    },
    {
      label: "Por cobrar este mes",
      value: fmtMoney(porCobrarEsteMes),
      color: "text-amber-700 dark:text-amber-300",
      icon:  <Clock className="h-4 w-4" />,
    },
    {
      label: "Follow-ups hoy",
      value: String(followupsHoy),
      color: followupsHoy > 0 ? "text-[#ffde21]" : "text-foreground/50",
      icon:  <Calendar className="h-4 w-4" />,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(card => (
        <div key={card.label} className="rounded-2xl border border-foreground/[0.07] bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-foreground/25">{card.icon}</span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30">{card.label}</p>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── New Cash / Old Cash ──────────────────────────────────────────────────────

function CashSection({ clients }: { clients: Client[] }) {
  const now          = new Date()
  const currentMonth = now.getMonth()
  const currentYear  = now.getFullYear()

  // Exclude churned/inactive clients from all cash calculations
  const activeClients = clients.filter(c => c.status !== "inactivo")

  // New Cash: clients whose created_at is this month
  const newClients = activeClients.filter(c => {
    const d = new Date(c.created_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  // New Cash = installment #1 of clients who started this month (the closing payment)
  const newCash = newClients.reduce((sum, c) => {
    const firstInst = c.installments.find(i => i.installment_number === 1)
    return sum + (firstInst?.amount ?? c.installment_amount)
  }, 0)

  // Old Cash: installments due this month from pre-existing clients
  const oldClients = activeClients.filter(c => {
    const d = new Date(c.created_at)
    return !(d.getMonth() === currentMonth && d.getFullYear() === currentYear)
  })

  const oldCashExpected = oldClients.reduce((sum, c) =>
    sum + c.installments
      .filter(i => {
        const d = new Date(i.due_date + "T12:00:00")
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      .reduce((s, i) => s + i.amount, 0)
  , 0)

  // Cobrado: misma base que expected (due_date en este mes) pero solo las ya pagadas
  // Así pendiente = lo que vence este mes y todavía no cobró (consistente con expected)
  const oldCashCobrado = oldClients.reduce((sum, c) =>
    sum + c.installments
      .filter(i => {
        if (!i.paid_at) return false
        const d = new Date(i.due_date + "T12:00:00")
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      .reduce((s, i) => s + i.amount, 0)
  , 0)

  const oldCashPendiente = oldCashExpected - oldCashCobrado
  const pct = oldCashExpected > 0 ? Math.min(100, (oldCashCobrado / oldCashExpected) * 100) : 0

  const monthName = now.toLocaleDateString("es-AR", { month: "long", year: "numeric" })

  return (
    <div className="rounded-2xl border border-foreground/[0.07] bg-card px-5 py-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mb-4">
        Cash — {monthName}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

        {/* New Cash */}
        <div>
          <p className="text-[11px] text-foreground/35 mb-1 font-semibold uppercase tracking-wider">New Cash</p>
          <p className="text-3xl font-bold text-[#ffde21] tabular-nums">{fmtMoney(newCash)}</p>
          <p className="text-[12px] text-foreground/30 mt-1.5">
            {newClients.length > 0
              ? `${newClients.length} cliente${newClients.length !== 1 ? "s" : ""} nuevo${newClients.length !== 1 ? "s" : ""} este mes`
              : "Sin clientes nuevos este mes"}
          </p>
        </div>

        {/* Old Cash */}
        <div>
          <p className="text-[11px] text-foreground/35 mb-1 font-semibold uppercase tracking-wider">Old Cash</p>
          <p className="text-3xl font-bold text-foreground tabular-nums">{fmtMoney(oldCashExpected)}</p>
          <div className="mt-2 space-y-1.5">
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] text-foreground/40 shrink-0 tabular-nums">{Math.round(pct)}%</span>
            </div>
            <div className="flex gap-4 text-[12px]">
              <span className="text-emerald-700 dark:text-emerald-300 tabular-nums">
                {fmtMoney(oldCashCobrado)} cobrado
              </span>
              {oldCashPendiente > 0 && (
                <span className="text-amber-700/80 dark:text-amber-300/70 tabular-nums">
                  {fmtMoney(oldCashPendiente)} pendiente
                </span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Installment Progress Bar ─────────────────────────────────────────────────

function InstallmentProgress({ client }: { client: Client }) {
  const paid  = client.installments.filter(i => i.status === "pagado").length
  const total = client.num_installments
  const pct   = total > 0 ? (paid / total) * 100 : 0

  return (
    <div className="space-y-1">
      <span className="text-[12px] text-foreground/60 tabular-nums">{paid}/{total} pagadas</span>
      <div className="h-1.5 w-24 rounded-full bg-foreground/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#ffde21] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Sortable column types ────────────────────────────────────────────────────

type SortKey = "name" | "start" | "end" | "remaining" | "amount" | "status" | "created_at"

const STATUS_ORDER: Record<string, number> = {
  activo:     0,
  en_pausa:   1,
  inactivo:   2,
  completado: 3,
}

function paidCountOf(c: Client): number {
  return c.installments?.filter(i => i.status === "pagado").length ?? 0
}

function endDateOf(c: Client): string {
  return addMonths(c.program_start, c.program_duration ?? c.num_installments)
}

function compareClients(a: Client, b: Client, key: SortKey): number {
  switch (key) {
    case "name":      return (a.name ?? "").toLowerCase().localeCompare((b.name ?? "").toLowerCase(), "es")
    case "start":     return a.program_start.localeCompare(b.program_start)
    case "end":       return endDateOf(a).localeCompare(endDateOf(b))
    case "remaining": return (a.num_installments - paidCountOf(a)) - (b.num_installments - paidCountOf(b))
    case "amount":    return (a.installment_amount ?? 0) - (b.installment_amount ?? 0)
    case "status":     return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
    case "created_at": return a.created_at.localeCompare(b.created_at)
  }
}

function SortableTh({
  label, sortKey: key, currentKey, dir, onClick,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  dir: "asc" | "desc"
  onClick: () => void
}) {
  const active = currentKey === key
  return (
    <th
      onClick={onClick}
      title={active ? `Ordenado ${dir === "asc" ? "↑ ascendente" : "↓ descendente"} · click para invertir` : "Click para ordenar"}
      className="px-2 py-2.5 text-left whitespace-nowrap cursor-pointer select-none"
    >
      <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
        active
          ? "bg-[#ffde21]/15 text-[#ffde21] ring-1 ring-[#ffde21]/25"
          : "text-foreground/40 hover:bg-foreground/[0.06] hover:text-foreground/75"
      }`}>
        {label}
        {active
          ? (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
          : <ChevronsUpDown className="h-3 w-3 opacity-50" />}
      </span>
    </th>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminClientsView() {
  const [clients,       setClients]      = useState<Client[]>([])
  const [loading,       setLoading]      = useState(true)
  const [error,         setError]        = useState<string | null>(null)
  const [selected,      setSelected]     = useState<Client | null>(null)
  const [deletingId,    setDeletingId]   = useState<string | null>(null)
  const [offboardingId, setOffboardingId] = useState<string | null>(null)
  const [filterStatus,  setFilterStatus] = useState<string>("todos")
  const [search,        setSearch]       = useState("")
  const [sortKey,       setSortKey]      = useState<SortKey>("created_at")
  const [sortDir,       setSortDir]      = useState<"asc" | "desc">("desc")

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const getSession = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getSession()
      if (!session) { setError("No autenticado"); return }
      const res = await fetch("/api/admin/clients", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      })
      if (!res.ok) { setError("Error al cargar clientes"); return }
      const json = await res.json()
      setClients(json.clients ?? [])
    } catch (e: any) {
      setError(e?.message ?? "Error inesperado")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  // Keep selected client in sync when clients list updates
  useEffect(() => {
    if (selected) {
      const updated = clients.find(c => c.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [clients]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePatchClient = async (id: string, updates: Partial<Client>) => {
    // Optimistic update
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/clients", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id, ...updates }),
    })
  }

  const handlePatchInstallmentAmount = async (installmentId: string, amount: number) => {
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/clients", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ installment_id: installmentId, amount }),
    })
    if (res.ok) {
      // Optimistic: update amount in state
      setClients(prev => prev.map(c => ({
        ...c,
        installments: c.installments.map(i =>
          i.id === installmentId ? { ...i, amount } : i
        ),
      })))
    }
  }

  const handleToggleInstallment = async (installmentId: string, _currentPaidAt: string | null) => {
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/clients", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ installment_id: installmentId }),
    })
    const json = await res.json()
    if (res.ok) {
      const newPaidAt   = json.paid_at
      const newInst     = json.new_installment ?? null   // auto-renewed installment (monthly subs)
      setClients(prev => prev.map(c => {
        // Find which client owns this installment
        const ownsIt = c.installments.some(i => i.id === installmentId)
        if (!ownsIt) return c

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const updatedInstallments = c.installments.map(i => {
          if (i.id !== installmentId) return i
          const due = new Date(i.due_date + "T12:00:00")
          due.setHours(0, 0, 0, 0)
          const status: Installment["status"] = newPaidAt
            ? "pagado"
            : due < today ? "vencido" : "pendiente"
          return { ...i, paid_at: newPaidAt, status }
        })

        // Append auto-generated next installment if present
        if (newInst && newPaidAt) {
          const due = new Date(newInst.due_date + "T12:00:00")
          due.setHours(0, 0, 0, 0)
          const status: Installment["status"] = due < today ? "vencido" : "pendiente"
          updatedInstallments.push({ ...newInst, status })
        }

        return { ...c, installments: updatedInstallments }
      }))
    }
  }

  const handleAddFollowup = async (clientId: string, data: any) => {
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/clients", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ type: "followup", client_id: clientId, ...data }),
    })
    const json = await res.json()
    if (res.ok && json.followup) {
      setClients(prev => prev.map(c =>
        c.id === clientId
          ? { ...c, followups: [...c.followups, json.followup] }
          : c
      ))
    }
  }

  const handleToggleFollowup = async (followupId: string) => {
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/clients", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ followup_id: followupId }),
    })
    const json = await res.json()
    if (res.ok) {
      setClients(prev => prev.map(c => ({
        ...c,
        followups: c.followups.map(f =>
          f.id === followupId ? { ...f, completed: json.completed } : f
        ),
      })))
    }
  }

  const handleDeleteFollowup = async (followupId: string) => {
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/clients", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ followup_id: followupId }),
    })
    if (res.ok) {
      setClients(prev => prev.map(c => ({
        ...c,
        followups: c.followups.filter(f => f.id !== followupId),
      })))
    }
  }

  const handleOffboardClient = async (id: string) => {
    const client = clients.find(c => c.id === id)
    const name = client?.name ?? "este cliente"
    if (!window.confirm(`¿Dar de baja a ${name}?\n\nEsto va a:\n• Marcar al cliente como Inactivo\n• Eliminar todas sus cuotas pendientes (no pagadas)\n\nLas cuotas ya cobradas se conservan. Esta acción no se puede deshacer.`)) return
    setOffboardingId(id)
    const session = await getSession()
    if (!session) { setOffboardingId(null); return }
    const res = await fetch("/api/admin/clients", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ type: "offboard", id }),
    })
    if (res.ok) {
      // Optimistic: mark inactivo + remove unpaid installments in state
      setClients(prev => prev.map(c =>
        c.id === id
          ? { ...c, status: "inactivo", installments: c.installments.filter(i => i.paid_at !== null) }
          : c
      ))
      if (selected?.id === id) {
        setSelected(prev => prev
          ? { ...prev, status: "inactivo", installments: prev.installments.filter(i => i.paid_at !== null) }
          : null
        )
      }
    }
    setOffboardingId(null)
  }

  const handleDeleteClient = async (id: string) => {
    const client = clients.find(c => c.id === id)
    const name = client?.name ?? "este cliente"
    if (!window.confirm(`¿Eliminar a ${name} y todas sus cuotas + follow-ups? Esta acción no se puede deshacer.`)) return
    setDeletingId(id)
    const session = await getSession()
    if (!session) { setDeletingId(null); return }
    await fetch("/api/admin/clients", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ id }),
    })
    setClients(prev => prev.filter(c => c.id !== id))
    if (selected?.id === id) setSelected(null)
    setDeletingId(null)
  }

  // Filtering
  const filtered = clients.filter(c => {
    if (filterStatus !== "todos" && c.status !== filterStatus) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [c.name, c.email, c.instagram, c.phone, c.notes]
      .some(v => v?.toLowerCase().includes(q))
  })

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const cmp = compareClients(a, b, sortKey)
      return sortDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const today = todayStr()

  return (
    <>
      {selected && (
        <DetailDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onPatchClient={handlePatchClient}
          onToggleInstallment={handleToggleInstallment}
          onPatchInstallmentAmount={handlePatchInstallmentAmount}
          onAddFollowup={handleAddFollowup}
          onToggleFollowup={handleToggleFollowup}
          onDeleteFollowup={handleDeleteFollowup}
          onDeleteClient={handleDeleteClient}
          onOffboard={handleOffboardClient}
          deleting={deletingId === selected.id}
          offboarding={offboardingId === selected.id}
        />
      )}

      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Clientes</h1>
            <p className="text-sm text-foreground/40 mt-0.5">{clients.length} clientes</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchClients} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] text-foreground/40 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Webhook card */}
        <WebhookCard />

        {/* Summary cards */}
        <SummaryCards clients={clients} />

        {/* New Cash / Old Cash */}
        <CashSection clients={clients} />

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Filters + Search row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: "todos",      label: "Todos" },
              { key: "activo",     label: "Activo" },
              { key: "en_pausa",   label: "En pausa" },
              { key: "inactivo",   label: "Inactivo" },
              { key: "completado", label: "Finalizado" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilterStatus(key)}
                className={`h-8 rounded-xl border px-3.5 text-[12px] font-medium transition-all ${
                  filterStatus === key
                    ? "border-[#ffde21]/40 bg-[#ffde21]/10 text-[#ffde21]"
                    : "border-foreground/[0.07] text-foreground/40 hover:text-foreground hover:border-foreground/20"
                }`}>
                {label}
                {key !== "todos" && (
                  <span className="ml-1.5 text-[10px] opacity-60">
                    {clients.filter(c => c.status === key).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, instagram..."
            className="h-8 rounded-xl border border-foreground/[0.08] bg-card px-4 text-[13px] text-foreground placeholder:text-foreground/25 focus:border-foreground/20 focus:outline-none flex-1 min-w-[200px] max-w-xs"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card">
          {loading ? (
            <div className="overflow-x-auto" style={{ backgroundColor: "var(--card)" }}>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
                    {["Cliente", "Inicio", "Fin", "Cuotas", "Próx. cuota", "Estado", "Alertas", "Próx. follow-up", ""].map(h => (
                      <th key={h} className="px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/25 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-foreground/[0.04]">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-2 py-3">
                          <div className="h-3 skeleton rounded" style={{ width: `${50 + (i * 7 + j * 11) % 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ backgroundColor: "var(--card)" }}>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
                    <SortableTh label="Cliente"      sortKey="name"      currentKey={sortKey} dir={sortDir} onClick={() => toggleSort("name")} />
                    <SortableTh label="Inicio"       sortKey="start"     currentKey={sortKey} dir={sortDir} onClick={() => toggleSort("start")} />
                    <SortableTh label="Fin"          sortKey="end"       currentKey={sortKey} dir={sortDir} onClick={() => toggleSort("end")} />
                    <SortableTh label="Cuotas"       sortKey="remaining" currentKey={sortKey} dir={sortDir} onClick={() => toggleSort("remaining")} />
                    <SortableTh label="Próx. cuota"  sortKey="amount"    currentKey={sortKey} dir={sortDir} onClick={() => toggleSort("amount")} />
                    <SortableTh label="Estado"       sortKey="status"    currentKey={sortKey} dir={sortDir} onClick={() => toggleSort("status")} />
                    {["Alertas", "Próx. follow-up", ""].map(h => (
                      <th key={h} className="px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/25 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!sorted.length ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-sm text-foreground/25">
                        {clients.length ? "No hay clientes con ese filtro." : "Todavía no hay clientes registrados."}
                      </td>
                    </tr>
                  ) : (
                    sorted.map(client => {
                      const overdue  = clientHasOverdue(client)
                      const upcoming = clientHasUpcoming(client)
                      const nextFu   = nextFollowup(client)
                      const endDate  = addMonths(client.program_start, client.program_duration ?? client.num_installments)

                      const rowBorder = overdue
                        ? "border-l-2 border-l-red-500/50"
                        : upcoming
                          ? "border-l-2 border-l-yellow-500/50"
                          : ""

                      return (
                        <tr
                          key={client.id}
                          onClick={() => setSelected(client)}
                          className={`border-b border-foreground/[0.04] cursor-pointer transition-colors group bg-card hover:bg-muted ${rowBorder}`}
                        >
                          {/* Cliente */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-semibold text-foreground">{client.name}</p>
                                {client.is_monthly_subscription && (
                                  <span
                                    className="inline-flex items-center rounded-full border border-[#ffde21]/30 bg-[#ffde21]/[0.08] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#ffde21]"
                                    title="Plan mensual auto-renovable"
                                  >
                                    Mensual
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-foreground/30 mt-0.5">
                                {client.instagram
                                  ? <span className="text-pink-400/50">{client.instagram}</span>
                                  : fmtDateShort(client.created_at)}
                              </p>
                            </div>
                          </td>

                          {/* Inicio */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="text-[12px] text-foreground/55">{fmtDateShort(client.program_start)}</span>
                          </td>

                          {/* Fin */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="text-[12px] text-foreground/55">{fmtDateShort(endDate)}</span>
                          </td>

                          {/* Cuotas */}
                          <td className="px-3 py-2.5 whitespace-nowrap min-w-[110px]" onClick={e => e.stopPropagation()}>
                            <InstallmentProgress client={client} />
                          </td>

                          {/* Próx. cuota */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {(() => {
                              const nextInst = client.installments
                                ?.filter(i => i.paid_at === null)
                                ?.sort((a, b) => a.installment_number - b.installment_number)[0]
                              if (!nextInst) {
                                return (
                                  <span className="inline-flex items-center rounded-full border border-sky-300 bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300">
                                    Pago completado
                                  </span>
                                )
                              }
                              return (
                                <span className="text-[13px] font-semibold tabular-nums text-foreground/80">
                                  {fmtMoney(nextInst.amount)}
                                </span>
                              )
                            })()}
                          </td>

                          {/* Estado */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CLIENT_STATUS_STYLE[client.status] ?? ""}`}>
                              {CLIENT_STATUS_LABEL[client.status] ?? client.status}
                            </span>
                          </td>

                          {/* Alertas */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {overdue && (
                                <span className="h-2 w-2 rounded-full bg-red-500" title="Cuota vencida" />
                              )}
                              {upcoming && !overdue && (
                                <span className="h-2 w-2 rounded-full bg-yellow-500" title="Pago próximo en 7 días" />
                              )}
                              {!overdue && !upcoming && (
                                <span className="text-foreground/15">—</span>
                              )}
                            </div>
                          </td>

                          {/* Próx. follow-up */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {nextFu ? (
                              <div className="flex items-center gap-1.5">
                                <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${FOLLOWUP_TYPE_STYLE[nextFu.type]}`}>
                                  {FOLLOWUP_TYPE_ICON[nextFu.type]}
                                  {fmtDateShort(nextFu.scheduled_date)}
                                </span>
                                {nextFu.scheduled_date === today && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#ffde21] animate-pulse" />
                                )}
                              </div>
                            ) : (
                              <span className="text-foreground/20 text-[12px]">—</span>
                            )}
                          </td>

                          {/* Chevron */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <ChevronRight className="h-4 w-4 text-foreground/25 group-hover:text-foreground/60 transition-colors" />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
