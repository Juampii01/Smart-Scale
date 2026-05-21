"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Plus, Trash2, RefreshCw, Download, Check, X,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id:          string
  name:        string
  email:       string | null
  amount:      number
  status:      "aceptado" | "rechazado" | "pendiente"
  description: string | null
  created_at:  string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

const STATUS_STYLE: Record<string, string> = {
  aceptado:  "bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
  rechazado: "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25",
  pendiente: "bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25",
}

// ─── New Payment Row ──────────────────────────────────────────────────────────

function NewPaymentRow({ onSave, onCancel }: { onSave: (p: Omit<Payment, "id" | "created_at">) => Promise<void>; onCancel: () => void }) {
  const [name,        setName]        = useState("")
  const [email,       setEmail]       = useState("")
  const [amount,      setAmount]      = useState("")
  const [status,      setStatus]      = useState<Payment["status"]>("aceptado")
  const [description, setDescription] = useState("")
  const [saving,      setSaving]      = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !amount.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), email: email.trim() || null, amount: Number(amount), status, description: description.trim() || null })
    setSaving(false)
  }

  const inputCls = "h-8 rounded-lg border border-foreground/[0.08] bg-card px-3 text-[13px] text-foreground placeholder:text-foreground/20 focus:border-foreground/20 focus:outline-none w-full"

  return (
    <tr className="border-b border-[#ffde21]/10 bg-[#ffde21]/[0.03]">
      <td className="px-4 py-2.5"><input value={name}  onChange={e => setName(e.target.value)}  placeholder="Nombre completo *" className={inputCls} /></td>
      <td className="px-4 py-2.5"><input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com"  className={inputCls} /></td>
      <td className="px-4 py-2.5">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0 *" className={`${inputCls} text-right`} />
      </td>
      <td className="px-4 py-2.5">
        <select value={status} onChange={e => setStatus(e.target.value as Payment["status"])}
          className="h-8 w-full appearance-none rounded-lg border border-foreground/[0.08] bg-card px-3 text-[13px] text-foreground capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde21]/40 focus-visible:ring-offset-1">
          <option value="aceptado">Aceptado</option>
          <option value="rechazado">Rechazado</option>
          <option value="pendiente">Pendiente</option>
        </select>
      </td>
      <td className="px-4 py-2.5"><input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción..." className={inputCls} /></td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <button onClick={handleSave} disabled={saving || !name.trim() || !amount.trim()} aria-label="Guardar"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffde21] text-black hover:bg-[#ffe84d] disabled:opacity-40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde21]/40 focus-visible:ring-offset-1">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onCancel} aria-label="Cancelar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/[0.08] text-foreground/40 hover:text-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde21]/40">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminPaymentsView() {
  const [payments,      setPayments]      = useState<Payment[]>([])
  const [loading,       setLoading]       = useState(true)
  const [adding,        setAdding]        = useState(false)
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [filterStatus,  setFilterStatus]  = useState<string>("todos")

  const getSession = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/payments", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      setPayments(json.payments ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  const handleAdd = async (p: Omit<Payment, "id" | "created_at">) => {
    const session = await getSession()
    if (!session) return
    const res = await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify(p),
    })
    if (res.ok) {
      const json = await res.json()
      setPayments(prev => [json.payment, ...prev])
      setAdding(false)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: status as Payment["status"] } : p))
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, status }),
    })
  }

  const handleDelete = async (id: string) => {
    const payment = payments.find(p => p.id === id)
    const label = payment ? `el pago de ${payment.name ?? "(sin nombre)"} por ${payment.amount ? `US$ ${payment.amount}` : "monto desconocido"}` : "este pago"
    if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return
    setDeletingId(id)
    const session = await getSession()
    if (!session) { setDeletingId(null); return }
    await fetch("/api/admin/payments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    })
    setPayments(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
  }

  const exportCsv = () => {
    const header = ["Nombre","Email","Monto","Estado","Descripción","Fecha"].join(",")
    const rows = filtered.map(p =>
      [p.name, p.email, p.amount, p.status, p.description, p.created_at]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    const csv  = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement("a"), { href: url, download: "pagos.csv" }).click()
    URL.revokeObjectURL(url)
  }

  const filtered = filterStatus === "todos" ? payments : payments.filter(p => p.status === filterStatus)
  const totalAceptado = payments.filter(p => p.status === "aceptado").reduce((s, p) => s + p.amount, 0)

  // Monthly breakdown (accepted only, sorted newest first)
  const monthlyBreakdown = (() => {
    const map = new Map<string, { total: number; count: number }>()
    for (const p of payments) {
      if (p.status !== "aceptado") continue
      const d = new Date(p.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const existing = map.get(key) ?? { total: 0, count: 0 }
      map.set(key, { total: existing.total + p.amount, count: existing.count + 1 })
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, val]) => {
        const [year, month] = key.split("-")
        const label = new Date(Number(year), Number(month) - 1, 1)
          .toLocaleDateString("es-AR", { month: "long", year: "numeric" })
        return { key, label, ...val }
      })
  })()

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Pagos</h1>
          <p className="text-sm text-foreground/40 mt-0.5">{payments.length} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchPayments()} disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] text-foreground/40 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={exportCsv} disabled={!filtered.length}
            className="flex items-center gap-2 h-9 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-4 text-sm font-medium text-foreground/50 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40">
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button onClick={() => setAdding(true)} disabled={adding}
            className="flex items-center gap-2 h-9 rounded-xl bg-[#ffde21] px-4 text-sm font-bold text-black hover:bg-[#ffe84d] disabled:opacity-50 transition-all">
            <Plus className="h-4 w-4" />
            Nuevo pago
          </button>
        </div>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total cobrado",   value: fmtMoney(totalAceptado),                               color: "text-emerald-700 dark:text-emerald-300" },
          { label: "Pagos aceptados", value: String(payments.filter(p => p.status === "aceptado").length),  color: "text-emerald-700 dark:text-emerald-300" },
          { label: "Pagos rechazados",value: String(payments.filter(p => p.status === "rechazado").length), color: "text-red-700 dark:text-red-300"     },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-foreground/[0.07] bg-card px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30">{card.label}</p>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly breakdown */}
      {monthlyBreakdown.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25 px-0.5">Cobrado por mes</p>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
            {monthlyBreakdown.map((m, i) => {
              const pct = totalAceptado > 0 ? (m.total / totalAceptado) * 100 : 0
              const isTop = i === 0
              return (
                <div
                  key={m.key}
                  className={`flex-shrink-0 rounded-2xl border px-4 py-3 min-w-[150px] relative overflow-hidden transition-all ${
                    isTop
                      ? "border-[#ffde21]/30 bg-[#ffde21]/[0.05]"
                      : "border-foreground/[0.07] bg-card"
                  }`}
                >
                  {/* bar background */}
                  <div
                    className={`pointer-events-none absolute bottom-0 left-0 h-[3px] rounded-full transition-all ${isTop ? "bg-[#ffde21]/60" : "bg-foreground/10"}`}
                    style={{ width: `${pct}%` }}
                  />
                  <p className={`text-[10px] font-semibold uppercase tracking-wider capitalize mb-1.5 ${isTop ? "text-[#ffde21]/70" : "text-foreground/30"}`}>
                    {m.label}
                  </p>
                  <p className={`text-lg font-bold tabular-nums leading-none ${isTop ? "text-[#ffde21]" : "text-foreground/80"}`}>
                    {fmtMoney(m.total)}
                  </p>
                  <p className="text-[10px] text-foreground/25 mt-1">{m.count} pago{m.count !== 1 ? "s" : ""}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {["todos","aceptado","rechazado","pendiente"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`h-8 rounded-xl border px-3.5 text-[12px] font-medium capitalize transition-all ${
              filterStatus === s
                ? "border-[#ffde21]/40 bg-[#ffde21]/10 text-[#ffde21]"
                : "border-foreground/[0.07] text-foreground/40 hover:text-foreground hover:border-foreground/20"
            }`}>
            {s}
            {s !== "todos" && <span className="ml-1.5 text-[10px] opacity-60">{payments.filter(p => p.status === s).length}</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#ffde21]/40" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
                  {["Nombre","Email","Monto","Estado","Descripción",""].map(h => (
                    <th key={h} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/25 whitespace-nowrap ${h === "Monto" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adding && (
                  <NewPaymentRow onSave={handleAdd} onCancel={() => setAdding(false)} />
                )}
                {!filtered.length && !adding ? (
                  <tr><td colSpan={6} className="py-16 text-center text-sm text-foreground/25">
                    {payments.length ? "No hay pagos con ese estado." : "Todavía no hay pagos registrados."}
                  </td></tr>
                ) : (
                  filtered.map(p => (
                    <tr key={p.id} className="border-b border-foreground/[0.04] hover:bg-foreground/[0.02] transition-colors group">

                      {/* Nombre */}
                      <td className="px-4 py-3 text-[13px] font-semibold text-foreground whitespace-nowrap">{p.name}</td>

                      {/* Email */}
                      <td className="px-4 py-3 text-[13px] text-foreground/55 whitespace-nowrap">
                        {p.email ?? <span className="text-foreground/20">—</span>}
                      </td>

                      {/* Monto */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-[13px] font-bold tabular-nums text-foreground/80">{fmtMoney(p.amount)}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          value={p.status}
                          onChange={e => handleStatusChange(p.id, e.target.value)}
                          className={`h-7 cursor-pointer appearance-none rounded-lg border px-2.5 pr-6 text-[11px] font-semibold capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde21]/40 focus-visible:ring-offset-1 ${STATUS_STYLE[p.status]}`}
                        >
                          <option value="aceptado">Aceptado</option>
                          <option value="rechazado">Rechazado</option>
                          <option value="pendiente">Pendiente</option>
                        </select>
                      </td>

                      {/* Descripción */}
                      <td className="px-4 py-3 text-[13px] text-foreground/45 max-w-[260px] truncate">
                        {p.description ?? <span className="text-foreground/20">—</span>}
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-foreground/25">
                        <div className="flex items-center gap-3">
                          <span>{fmtDate(p.created_at)}</span>
                          <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                            className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-foreground/15 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40">
                            {deletingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
