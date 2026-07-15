"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import {
  Loader2, Plus, Trash2, RefreshCw, Download, Check, X, LayoutList, CalendarDays, Link2,
} from "lucide-react"
import { PaymentLinkDialog } from "@/components/admin/payment-link-dialog"

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

function monthKey(iso: string) {
  // Returns "YYYY-MM" for grouping
  return iso.slice(0, 7)
}

function fmtMonthLabel(key: string) {
  // "2026-05" → "Mayo 2026"
  const [year, month] = key.split("-")
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    .replace(/^\w/, c => c.toUpperCase())
}

function groupByMonth(payments: Payment[]): { key: string; label: string; items: Payment[] }[] {
  const map = new Map<string, Payment[]>()
  for (const p of payments) {
    const k = monthKey(p.created_at)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(p)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))        // newest first
    .map(([key, items]) => ({ key, label: fmtMonthLabel(key), items }))
}

const STATUS_STYLE: Record<string, string> = {
  aceptado:  "bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
  rechazado: "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25",
  pendiente: "bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25",
}

// ─── New Payment Row ──────────────────────────────────────────────────────────

function todayDateStr() {
  return new Date().toISOString().slice(0, 10)
}

function NewPaymentRow({ onSave, onCancel }: { onSave: (p: Omit<Payment, "id" | "created_at"> & { created_at?: string }) => Promise<void>; onCancel: () => void }) {
  const [name,        setName]        = useState("")
  const [email,       setEmail]       = useState("")
  const [amount,      setAmount]      = useState("")
  const [status,      setStatus]      = useState<Payment["status"]>("aceptado")
  const [description, setDescription] = useState("")
  const [date,        setDate]        = useState(todayDateStr())
  const [saving,      setSaving]      = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !amount.trim()) return
    setSaving(true)
    await onSave({
      name:        name.trim(),
      email:       email.trim() || null,
      amount:      Number(amount),
      status,
      description: description.trim() || null,
      created_at:  date || todayDateStr(),
    })
    setSaving(false)
  }

  const inputCls = "h-8 rounded-lg border border-foreground/[0.08] bg-card px-3 text-[13px] text-foreground placeholder:text-foreground/20 focus:border-foreground/20 focus:outline-none w-full"

  return (
    <tr className="border-b border-[#dafc69]/10 bg-[#dafc69]/[0.03]">
      <td className="px-4 py-2.5"><input value={name}  onChange={e => setName(e.target.value)}  placeholder="Nombre completo *" className={inputCls} /></td>
      <td className="px-4 py-2.5"><input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com"  className={inputCls} /></td>
      <td className="px-4 py-2.5">
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0 *" className={`${inputCls} text-right`} />
      </td>
      <td className="px-4 py-2.5">
        <select value={status} onChange={e => setStatus(e.target.value as Payment["status"])}
          className="h-8 w-full appearance-none rounded-lg border border-foreground/[0.08] bg-card px-3 text-[13px] text-foreground capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-[#dafc69]/40 focus-visible:ring-offset-1">
          <option value="aceptado">Aceptado</option>
          <option value="rechazado">Rechazado</option>
          <option value="pendiente">Pendiente</option>
        </select>
      </td>
      <td className="px-4 py-2.5"><input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción..." className={inputCls} /></td>
      <td className="px-4 py-2.5">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="h-8 rounded-lg border border-foreground/[0.08] bg-card px-3 text-[13px] text-foreground focus:border-foreground/20 focus:outline-none w-full [color-scheme:dark]"
        />
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <button onClick={handleSave} disabled={saving || !name.trim() || !amount.trim()} aria-label="Guardar"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#dafc69] text-black hover:bg-[#f2ffc0] disabled:opacity-40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#dafc69]/40 focus-visible:ring-offset-1">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onCancel} aria-label="Cancelar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/[0.08] text-foreground/40 hover:text-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#dafc69]/40">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminPaymentsView() {
  const [payments,         setPayments]         = useState<Payment[]>([])
  const [loading,          setLoading]          = useState(true)
  const [adding,           setAdding]           = useState(false)
  const [deletingId,       setDeletingId]       = useState<string | null>(null)
  const [filterStatus,     setFilterStatus]     = useState<string>("todos")
  const [filterMonth,      setFilterMonth]      = useState<string>("todos")
  const [viewMode,         setViewMode]         = useState<"tabla" | "mes">("mes")
  const [showLinkDialog,   setShowLinkDialog]   = useState(false)

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

  const handleAdd = async (p: Omit<Payment, "id" | "created_at"> & { created_at?: string }) => {
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

  const filtered = payments
    .filter(p => filterStatus === "todos" || p.status === filterStatus)
    .filter(p => filterMonth  === "todos" || monthKey(p.created_at) === filterMonth)

  const totalAceptado = payments.filter(p => p.status === "aceptado").reduce((s, p) => s + p.amount, 0)

  // Unique months present in ALL payments (not filtered), newest first
  const availableMonths = Array.from(new Set(payments.map(p => monthKey(p.created_at))))
    .sort((a, b) => b.localeCompare(a))

  const monthGroups = groupByMonth(filtered)

  // Shared payment row renderer
  const PaymentRow = (p: Payment) => (
    <tr key={p.id} className="border-b border-foreground/[0.04] hover:bg-foreground/[0.02] transition-colors group">
      <td className="px-4 py-3 text-[13px] font-semibold text-foreground whitespace-nowrap">{p.name}</td>
      <td className="px-4 py-3 text-[13px] text-foreground/55 whitespace-nowrap">
        {p.email ?? <span className="text-foreground/20">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-[13px] font-bold tabular-nums text-foreground/80">{fmtMoney(p.amount)}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <select
          value={p.status}
          onChange={e => handleStatusChange(p.id, e.target.value)}
          className={`h-7 cursor-pointer appearance-none rounded-lg border px-2.5 pr-6 text-[11px] font-semibold capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-[#dafc69]/40 focus-visible:ring-offset-1 ${STATUS_STYLE[p.status]}`}
        >
          <option value="aceptado">Aceptado</option>
          <option value="rechazado">Rechazado</option>
          <option value="pendiente">Pendiente</option>
        </select>
      </td>
      <td className="px-4 py-3 text-[13px] text-foreground/45 max-w-[260px] truncate">
        {p.description ?? <span className="text-foreground/20">—</span>}
      </td>
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
  )

  const TableHead = () => (
    <thead>
      <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
        {["Nombre","Email","Monto","Estado","Descripción","Fecha",""].map(h => (
          <th key={h} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/25 whitespace-nowrap ${h === "Monto" ? "text-right" : "text-left"}`}>{h}</th>
        ))}
      </tr>
    </thead>
  )

  return (
    <div className="space-y-6">

      <PaymentLinkDialog open={showLinkDialog} onClose={() => setShowLinkDialog(false)} />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Pagos</h1>
          <p className="text-sm text-foreground/40 mt-0.5">{payments.length} registros</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] p-1 gap-1">
            <button
              onClick={() => setViewMode("mes")}
              title="Vista por mes"
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${viewMode === "mes" ? "bg-[#dafc69] text-black" : "text-foreground/40 hover:text-foreground"}`}>
              <CalendarDays className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("tabla")}
              title="Vista tabla"
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${viewMode === "tabla" ? "bg-[#dafc69] text-black" : "text-foreground/40 hover:text-foreground"}`}>
              <LayoutList className="h-3.5 w-3.5" />
            </button>
          </div>

          <button onClick={() => fetchPayments()} disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] text-foreground/40 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={exportCsv} disabled={!filtered.length}
            className="flex items-center gap-2 h-9 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-4 text-sm font-medium text-foreground/50 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40">
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button onClick={() => setShowLinkDialog(true)}
            className="flex items-center gap-2 h-9 rounded-xl border border-[#dafc69]/30 bg-[#dafc69]/[0.08] px-4 text-sm font-semibold text-[#dafc69] hover:bg-[#dafc69]/15 transition-all">
            <Link2 className="h-3.5 w-3.5" />
            Link de pago
          </button>
          <button onClick={() => setAdding(true)} disabled={adding}
            className="flex items-center gap-2 h-9 rounded-xl bg-[#dafc69] px-4 text-sm font-bold text-black hover:bg-[#f2ffc0] disabled:opacity-50 transition-all">
            <Plus className="h-4 w-4" />
            Nuevo pago
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total cobrado",    value: fmtMoney(totalAceptado),                                              color: "text-emerald-700 dark:text-emerald-300" },
          { label: "Pagos aceptados",  value: String(payments.filter(p => p.status === "aceptado").length),         color: "text-emerald-700 dark:text-emerald-300" },
          { label: "Pagos rechazados", value: String(payments.filter(p => p.status === "rechazado").length),        color: "text-red-700 dark:text-red-300" },
        ].map(card => (
          <div key={card.label} className="rounded-[14px] border border-foreground/[0.07] bg-card px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30">{card.label}</p>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {["todos","aceptado","rechazado","pendiente"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`h-8 rounded-xl border px-3.5 text-[12px] font-medium capitalize transition-all ${
              filterStatus === s
                ? "border-[#dafc69]/40 bg-[#dafc69]/10 text-[#dafc69]"
                : "border-foreground/[0.07] text-foreground/40 hover:text-foreground hover:border-foreground/20"
            }`}>
            {s}
            {s !== "todos" && <span className="ml-1.5 text-[10px] opacity-60">{payments.filter(p => p.status === s).length}</span>}
          </button>
        ))}
      </div>

      {/* Month filters */}
      {availableMonths.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/20 mr-1">Mes</span>
          <button
            onClick={() => setFilterMonth("todos")}
            className={`h-7 rounded-lg border px-3 text-[11px] font-medium transition-all ${
              filterMonth === "todos"
                ? "border-foreground/20 bg-foreground/[0.06] text-foreground/70"
                : "border-foreground/[0.07] text-foreground/30 hover:text-foreground/60 hover:border-foreground/15"
            }`}>
            Todos
          </button>
          {availableMonths.map(m => (
            <button key={m} onClick={() => setFilterMonth(m)}
              className={`h-7 rounded-lg border px-3 text-[11px] font-medium capitalize transition-all ${
                filterMonth === m
                  ? "border-foreground/20 bg-foreground/[0.06] text-foreground/70"
                  : "border-foreground/[0.07] text-foreground/30 hover:text-foreground/60 hover:border-foreground/15"
              }`}>
              {fmtMonthLabel(m)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#dafc69]/40" /></div>
      ) : viewMode === "mes" ? (

        /* ── Vista por mes ─────────────────────────────────────────────── */
        <div className="space-y-8">
          {adding && (
            <div className="overflow-hidden rounded-[14px] border border-foreground/[0.08] bg-card">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <TableHead />
                  <tbody>
                    <NewPaymentRow onSave={handleAdd} onCancel={() => setAdding(false)} />
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {monthGroups.length === 0 && !adding ? (
            <div className="flex items-center justify-center py-20 text-sm text-foreground/25">
              {payments.length ? "No hay pagos con ese estado." : "Todavía no hay pagos registrados."}
            </div>
          ) : (
            monthGroups.map(({ key, label, items }) => {
              const monthAceptado  = items.filter(p => p.status === "aceptado").reduce((s, p) => s + p.amount, 0)
              const monthCount     = items.length
              return (
                <div key={key} className="space-y-3">
                  {/* Month header */}
                  <div className="flex items-center gap-3">
                    <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-foreground/50">{label}</h2>
                    <div className="flex-1 h-px bg-foreground/[0.06]" />
                  </div>

                  {/* Two stat cards per month */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-foreground/[0.07] bg-card px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Cobrado</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{fmtMoney(monthAceptado)}</p>
                    </div>
                    <div className="rounded-xl border border-foreground/[0.07] bg-card px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/25">Pagos</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-foreground/70">{monthCount}</p>
                    </div>
                  </div>

                  {/* Payment rows */}
                  <div className="overflow-hidden rounded-xl border border-foreground/[0.08] bg-card">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <TableHead />
                        <tbody>
                          {items.map(p => <PaymentRow key={p.id} {...p} />)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

      ) : (

        /* ── Vista tabla plana ─────────────────────────────────────────── */
        <div className="overflow-hidden rounded-[14px] border border-foreground/[0.08] bg-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <TableHead />
              <tbody>
                {adding && (
                  <NewPaymentRow onSave={handleAdd} onCancel={() => setAdding(false)} />
                )}
                {!filtered.length && !adding ? (
                  <tr><td colSpan={6} className="py-16 text-center text-sm text-foreground/25">
                    {payments.length ? "No hay pagos con ese estado." : "Todavía no hay pagos registrados."}
                  </td></tr>
                ) : (
                  filtered.map(p => <PaymentRow key={p.id} {...p} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

      )}
    </div>
  )
}
