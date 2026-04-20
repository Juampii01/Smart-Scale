"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Plus, Trash2, RefreshCw, X, ChevronRight,
  CheckCircle2, Circle, AlertCircle, Clock, Users,
  DollarSign, Calendar, Phone, Mail, Instagram,
  MessageCircle, PhoneCall, AtSign, MoreHorizontal,
  Check, UserCheck,
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
  program_start:      string
  num_installments:   number
  installment_amount: number
  status:             "activo" | "inactivo" | "completado"
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

const CLIENT_STATUS_STYLE: Record<string, string> = {
  activo:     "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  inactivo:   "bg-red-500/10 text-red-300 border-red-500/25",
  completado: "bg-sky-500/10 text-sky-300 border-sky-500/25",
}

const INST_STATUS_STYLE: Record<string, string> = {
  pagado:    "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  pendiente: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  vencido:   "bg-red-500/10 text-red-300 border-red-500/25",
}

const FOLLOWUP_TYPE_STYLE: Record<string, string> = {
  whatsapp: "bg-pink-500/10 text-pink-300 border-pink-500/25",
  llamada:  "bg-blue-500/10 text-blue-300 border-blue-500/25",
  email:    "bg-purple-500/10 text-purple-300 border-purple-500/25",
  otro:     "bg-white/[0.05] text-white/50 border-white/[0.10]",
}

const FOLLOWUP_TYPE_ICON: Record<string, React.ReactNode> = {
  whatsapp: <MessageCircle className="h-3 w-3" />,
  llamada:  <PhoneCall className="h-3 w-3" />,
  email:    <Mail className="h-3 w-3" />,
  otro:     <MoreHorizontal className="h-3 w-3" />,
}

const inputCls = "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none transition-all"
const labelCls = "text-[10px] font-bold uppercase tracking-widest text-white/25"

// ─── New Client Panel ─────────────────────────────────────────────────────────

function NewClientPanel({ onSave, onCancel }: {
  onSave:   (data: any) => Promise<void>
  onCancel: () => void
}) {
  const [name,               setName]              = useState("")
  const [email,              setEmail]             = useState("")
  const [instagram,          setInstagram]         = useState("")
  const [phone,              setPhone]             = useState("")
  const [programStart,       setProgramStart]      = useState("")
  const [numInstallments,    setNumInstallments]   = useState("1")
  const [installmentAmount,  setInstallmentAmount] = useState("")
  const [notes,              setNotes]             = useState("")
  const [saving,             setSaving]            = useState(false)
  const [error,              setError]             = useState<string | null>(null)

  const total = Number(installmentAmount || 0) * Number(numInstallments || 0)

  const handleSave = async () => {
    if (!name.trim() || !programStart || !numInstallments || !installmentAmount) {
      setError("Completá los campos obligatorios (*).")
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSave({
        name:               name.trim(),
        email:              email.trim() || null,
        instagram:          instagram.trim() || null,
        phone:              phone.trim() || null,
        program_start:      programStart,
        num_installments:   Number(numInstallments),
        installment_amount: Number(installmentAmount),
        notes:              notes.trim() || null,
      })
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#ffde21]/15 bg-[#ffde21]/[0.02] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Nuevo cliente</h2>
        <button onClick={onCancel} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="text-[12px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className={labelCls}>Nombre *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Instagram</label>
          <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@usuario" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Teléfono</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 11 1234-5678" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Fecha de inicio *</label>
          <input type="date" value={programStart} onChange={e => setProgramStart(e.target.value)}
            className={`${inputCls} [color-scheme:dark]`} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Cantidad de cuotas *</label>
          <select value={numInstallments} onChange={e => setNumInstallments(e.target.value)}
            className="w-full appearance-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white focus:border-white/20 focus:outline-none transition-all">
            {[1,2,3,4,5,6].map(n => (
              <option key={n} value={n}>{n} cuota{n > 1 ? "s" : ""}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Monto por cuota (USD) *</label>
          <input type="number" min="0" value={installmentAmount} onChange={e => setInstallmentAmount(e.target.value)}
            placeholder="0" className={`${inputCls} text-right`} />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <label className={labelCls}>Notas</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones..." className={inputCls} />
        </div>
      </div>

      {/* Computed total */}
      {Number(installmentAmount) > 0 && (
        <div className="rounded-xl border border-[#ffde21]/15 bg-[#ffde21]/[0.04] px-4 py-2.5 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-[#ffde21]/60 shrink-0" />
          <span className="text-[13px] text-white/60">
            Total:{" "}
            <span className="font-bold text-[#ffde21]">{fmtMoney(Number(installmentAmount))}</span>
            {" "}×{" "}
            <span className="font-bold text-white">{numInstallments}</span>
            {" "}cuota{Number(numInstallments) > 1 ? "s" : ""}{" = "}
            <span className="font-bold text-[#ffde21]">{fmtMoney(total)}</span>
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={handleSave} disabled={saving || !name.trim() || !programStart || !installmentAmount}
          className="flex items-center gap-2 h-9 rounded-xl bg-[#ffde21] px-5 text-sm font-bold text-black hover:bg-[#ffe84d] disabled:opacity-40 transition-all">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Guardar cliente
        </button>
        <button onClick={onCancel} className="h-9 rounded-xl border border-white/[0.08] px-4 text-sm text-white/40 hover:text-white hover:border-white/20 transition-all">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  client,
  onClose,
  onPatchClient,
  onToggleInstallment,
  onAddFollowup,
  onToggleFollowup,
  onDeleteFollowup,
  onDeleteClient,
  deleting,
}: {
  client:              Client
  onClose:             () => void
  onPatchClient:       (id: string, updates: Partial<Client>) => Promise<void>
  onToggleInstallment: (installmentId: string, currentPaidAt: string | null) => Promise<void>
  onAddFollowup:       (clientId: string, data: any) => Promise<void>
  onToggleFollowup:    (followupId: string) => Promise<void>
  onDeleteFollowup:    (followupId: string) => Promise<void>
  onDeleteClient:      (id: string) => Promise<void>
  deleting:            boolean
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

  const endDate = addMonths(client.program_start, client.num_installments)
  const paidCount = client.installments.filter(i => i.status === "pagado").length

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-[480px] flex-col border-l border-white/[0.08] shadow-2xl" style={{ backgroundColor: "#111113" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5" style={{ backgroundColor: "#111113" }}>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{client.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${CLIENT_STATUS_STYLE[client.status]}`}>
                {client.status}
              </span>
              <span className="text-[12px] text-white/30">desde {fmtDate(client.program_start)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onDeleteClient(client.id)} disabled={deleting}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#111113" }}>

          {/* Section 1: Info fields */}
          <div className="px-6 py-5 space-y-4 border-b border-white/[0.06]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Información</p>

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
                  className="w-full appearance-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white focus:border-white/20 focus:outline-none transition-all">
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="completado">Completado</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className={labelCls}>Notas</p>
              <textarea
                defaultValue={client.notes ?? ""}
                placeholder="Observaciones, contexto..."
                rows={3}
                onBlur={e    => onPatchClient(client.id, { notes: e.target.value || null })}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) (e.target as HTMLTextAreaElement).blur() }}
                className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Section 2: Installments */}
          <div className="px-6 py-5 space-y-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Cuotas</p>
              <span className="rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-bold text-white/50">
                {paidCount}/{client.num_installments} pagadas
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#ffde21] transition-all duration-500"
                style={{ width: `${client.num_installments > 0 ? (paidCount / client.num_installments) * 100 : 0}%` }}
              />
            </div>

            <div className="space-y-2">
              {client.installments.map(inst => (
                <div key={inst.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-white/60 shrink-0">
                      {inst.installment_number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-white">{fmtMoney(inst.amount)}</span>
                        <span className="text-[12px] text-white/40">{fmtDate(inst.due_date)}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${INST_STATUS_STYLE[inst.status]}`}>
                          {inst.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleInst(inst)}
                      disabled={togglingInst === inst.id}
                      className={`shrink-0 h-7 rounded-lg border px-2.5 text-[11px] font-semibold transition-all disabled:opacity-40 ${
                        inst.status === "pagado"
                          ? "border-red-500/25 text-red-300 hover:bg-red-500/10"
                          : "border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/10"
                      }`}>
                      {togglingInst === inst.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : inst.status === "pagado" ? "Desmarcar" : "Marcar pagado"}
                    </button>
                  </div>
                  {inst.paid_at && (
                    <p className="text-[11px] text-white/35 pl-9">Pagado el {fmtDate(inst.paid_at)}</p>
                  )}
                </div>
              ))}

              {client.installments.length === 0 && (
                <p className="text-[12px] text-white/25 text-center py-3">Sin cuotas generadas.</p>
              )}
            </div>
          </div>

          {/* Section 3: Follow-ups */}
          <div className="px-6 py-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Seguimientos</p>
              <button
                onClick={() => setShowFollowupForm(v => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] text-white/40 hover:text-[#ffde21] hover:border-[#ffde21]/30 transition-all">
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
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-white focus:border-white/20 focus:outline-none [color-scheme:dark]" />
                  </div>
                  <div className="space-y-1">
                    <p className={labelCls}>Tipo</p>
                    <select value={fuType} onChange={e => setFuType(e.target.value as Followup["type"])}
                      className="w-full appearance-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-white focus:border-white/20 focus:outline-none">
                      <option value="whatsapp">WhatsApp</option>
                      <option value="llamada">Llamada</option>
                      <option value="email">Email</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                </div>
                <input value={fuNotes} onChange={e => setFuNotes(e.target.value)}
                  placeholder="Notas del seguimiento..."
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none" />
                <div className="flex items-center gap-2">
                  <button onClick={handleSaveFollowup} disabled={savingFu || !fuDate}
                    className="flex items-center gap-1.5 h-7 rounded-lg bg-[#ffde21] px-3 text-[12px] font-bold text-black hover:bg-[#ffe84d] disabled:opacity-40 transition-all">
                    {savingFu ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Guardar
                  </button>
                  <button onClick={() => setShowFollowupForm(false)}
                    className="h-7 rounded-lg border border-white/[0.08] px-3 text-[12px] text-white/40 hover:text-white transition-all">
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
                    fu.completed ? "border-white/[0.04] bg-white/[0.01] opacity-50" : "border-white/[0.07] bg-white/[0.02]"
                  }`}>
                    <button
                      onClick={() => handleToggleFu(fu)}
                      disabled={togglingFu === fu.id}
                      className="mt-0.5 shrink-0 text-white/30 hover:text-emerald-400 transition-colors disabled:opacity-40">
                      {togglingFu === fu.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : fu.completed
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          : <Circle className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-white/80">{fmtDate(fu.scheduled_date)}</span>
                        <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${FOLLOWUP_TYPE_STYLE[fu.type]}`}>
                          {FOLLOWUP_TYPE_ICON[fu.type]}
                          {fu.type}
                        </span>
                        {fu.scheduled_date === todayStr() && !fu.completed && (
                          <span className="rounded-full bg-[#ffde21]/10 border border-[#ffde21]/20 px-2 py-0.5 text-[10px] font-bold text-[#ffde21]">hoy</span>
                        )}
                      </div>
                      {fu.notes && (
                        <p className="text-[11px] text-white/40 mt-1">{fu.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteFu(fu.id)}
                      disabled={deletingFuId === fu.id}
                      className="shrink-0 opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
                      {deletingFuId === fu.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                ))}

              {client.followups.length === 0 && !showFollowupForm && (
                <p className="text-[12px] text-white/25 text-center py-3">Sin seguimientos agendados.</p>
              )}
            </div>
          </div>

        </div>

        {/* Footer with summary */}
        <div className="border-t border-white/[0.06] px-6 py-3" style={{ backgroundColor: "#111113" }}>
          <div className="flex items-center gap-4 text-[11px] text-white/30">
            <span>
              Fin estimado:{" "}
              <span className="text-white/60 font-semibold">{fmtDate(endDate)}</span>
            </span>
            <span>
              Total:{" "}
              <span className="text-white/60 font-semibold">
                {fmtMoney(client.installment_amount * client.num_installments)}
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
      color: "text-white",
      icon:  <Users className="h-4 w-4" />,
    },
    {
      label: "Cobrado este mes",
      value: fmtMoney(cobradoEsteMes),
      color: "text-emerald-300",
      icon:  <DollarSign className="h-4 w-4" />,
    },
    {
      label: "Por cobrar este mes",
      value: fmtMoney(porCobrarEsteMes),
      color: "text-amber-300",
      icon:  <Clock className="h-4 w-4" />,
    },
    {
      label: "Follow-ups hoy",
      value: String(followupsHoy),
      color: followupsHoy > 0 ? "text-[#ffde21]" : "text-white/50",
      icon:  <Calendar className="h-4 w-4" />,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(card => (
        <div key={card.label} className="rounded-2xl border border-white/[0.07] bg-[#111113] px-5 py-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-white/25">{card.icon}</span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">{card.label}</p>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
        </div>
      ))}
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
      <span className="text-[12px] text-white/60 tabular-nums">{paid}/{total} pagadas</span>
      <div className="h-1.5 w-24 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#ffde21] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminClientsView() {
  const [clients,      setClients]      = useState<Client[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [selected,     setSelected]     = useState<Client | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [search,       setSearch]       = useState("")
  const [showNewForm,  setShowNewForm]  = useState(false)

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

  const handleAddClient = async (data: any) => {
    const session = await getSession()
    if (!session) throw new Error("No autenticado")
    const res = await fetch("/api/admin/clients", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "Error al crear cliente")
    setShowNewForm(false)
    await fetchClients()
  }

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

  const handleToggleInstallment = async (installmentId: string, currentPaidAt: string | null) => {
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/clients", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body:    JSON.stringify({ installment_id: installmentId }),
    })
    const json = await res.json()
    if (res.ok) {
      const newPaidAt = json.paid_at
      setClients(prev => prev.map(c => ({
        ...c,
        installments: c.installments.map(i => {
          if (i.id !== installmentId) return i
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const due = new Date(i.due_date + "T12:00:00")
          due.setHours(0, 0, 0, 0)
          const status: Installment["status"] = newPaidAt
            ? "pagado"
            : due < today ? "vencido" : "pendiente"
          return { ...i, paid_at: newPaidAt, status }
        }),
      })))
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

  const handleDeleteClient = async (id: string) => {
    setDeletingId(id)
    const session = await getSession()
    if (!session) return
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

  const today = todayStr()

  return (
    <>
      {selected && (
        <DetailDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onPatchClient={handlePatchClient}
          onToggleInstallment={handleToggleInstallment}
          onAddFollowup={handleAddFollowup}
          onToggleFollowup={handleToggleFollowup}
          onDeleteFollowup={handleDeleteFollowup}
          onDeleteClient={handleDeleteClient}
          deleting={deletingId === selected.id}
        />
      )}

      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Clientes</h1>
            <p className="text-sm text-white/40 mt-0.5">{clients.length} clientes</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchClients} disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white hover:border-white/20 transition-all disabled:opacity-40">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setShowNewForm(true)} disabled={showNewForm}
              className="flex items-center gap-2 h-9 rounded-xl bg-[#ffde21] px-4 text-sm font-bold text-black hover:bg-[#ffe84d] disabled:opacity-50 transition-all">
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </button>
          </div>
        </div>

        {/* New client form */}
        {showNewForm && (
          <NewClientPanel
            onSave={handleAddClient}
            onCancel={() => setShowNewForm(false)}
          />
        )}

        {/* Summary cards */}
        <SummaryCards clients={clients} />

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Filters + Search row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {["todos", "activo", "inactivo", "completado"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`h-8 rounded-xl border px-3.5 text-[12px] font-medium capitalize transition-all ${
                  filterStatus === s
                    ? "border-[#ffde21]/40 bg-[#ffde21]/10 text-[#ffde21]"
                    : "border-white/[0.07] text-white/40 hover:text-white hover:border-white/20"
                }`}>
                {s}
                {s !== "todos" && (
                  <span className="ml-1.5 text-[10px] opacity-60">
                    {clients.filter(c => c.status === s).length}
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
            className="h-8 rounded-xl border border-white/[0.08] bg-[#1c1c1f] px-4 text-[13px] text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none flex-1 min-w-[200px] max-w-xs"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/40" />
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ backgroundColor: "#111113" }}>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    {["Cliente", "Inicio", "Fin", "Cuotas", "Monto/cuota", "Estado", "Alertas", "Próx. follow-up", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!filtered.length ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-sm text-white/25">
                        {clients.length ? "No hay clientes con ese filtro." : "Todavía no hay clientes registrados."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map(client => {
                      const overdue  = clientHasOverdue(client)
                      const upcoming = clientHasUpcoming(client)
                      const nextFu   = nextFollowup(client)
                      const endDate  = addMonths(client.program_start, client.num_installments)

                      const rowBorder = overdue
                        ? "border-l-2 border-l-red-500/50"
                        : upcoming
                          ? "border-l-2 border-l-yellow-500/50"
                          : ""

                      return (
                        <tr
                          key={client.id}
                          onClick={() => setSelected(client)}
                          className={`border-b border-white/[0.04] cursor-pointer transition-colors group ${rowBorder}`}
                          style={{ backgroundColor: "#111113" }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#18181b")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#111113")}
                        >
                          {/* Cliente */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div>
                              <p className="text-[13px] font-semibold text-white">{client.name}</p>
                              {client.instagram && (
                                <p className="text-[11px] text-pink-300/60 mt-0.5">{client.instagram}</p>
                              )}
                            </div>
                          </td>

                          {/* Inicio */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-[12px] text-white/55">{fmtDate(client.program_start)}</span>
                          </td>

                          {/* Fin */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-[12px] text-white/55">{fmtDate(endDate)}</span>
                          </td>

                          {/* Cuotas */}
                          <td className="px-4 py-3.5 whitespace-nowrap min-w-[130px]" onClick={e => e.stopPropagation()}>
                            <InstallmentProgress client={client} />
                          </td>

                          {/* Monto/cuota */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-[13px] font-semibold tabular-nums text-white/80">
                              {fmtMoney(client.installment_amount)}
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${CLIENT_STATUS_STYLE[client.status]}`}>
                              {client.status}
                            </span>
                          </td>

                          {/* Alertas */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {overdue && (
                                <span className="h-2 w-2 rounded-full bg-red-500" title="Cuota vencida" />
                              )}
                              {upcoming && !overdue && (
                                <span className="h-2 w-2 rounded-full bg-yellow-500" title="Pago próximo en 7 días" />
                              )}
                              {!overdue && !upcoming && (
                                <span className="text-white/15">—</span>
                              )}
                            </div>
                          </td>

                          {/* Próx. follow-up */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {nextFu ? (
                              <div className="flex items-center gap-1.5">
                                <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${FOLLOWUP_TYPE_STYLE[nextFu.type]}`}>
                                  {FOLLOWUP_TYPE_ICON[nextFu.type]}
                                  {fmtDate(nextFu.scheduled_date)}
                                </span>
                                {nextFu.scheduled_date === today && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#ffde21] animate-pulse" />
                                )}
                              </div>
                            ) : (
                              <span className="text-white/20 text-[12px]">—</span>
                            )}
                          </td>

                          {/* Chevron */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <ChevronRight className="h-4 w-4 text-white/25 group-hover:text-white/60 transition-colors" />
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
