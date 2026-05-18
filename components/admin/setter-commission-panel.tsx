"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface CommissionData {
  setter_id: string
  setter_name: string | null
  client_count: number
  mrr_total: number
  cash_collected: number
  old_cash: number
  new_cash: number
  commission_earned: number
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-")
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" }).toUpperCase()
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function SetterCommissionPanel({ userRole, userId, month }: { userRole: string | null; userId: string; month: string }) {
  const [commissions, setCommissions] = useState<CommissionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isSetter = userRole === "setter"

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError("No autenticado")
          return
        }

        // Load commissions for the selected month
        const queryParam = isSetter ? `?month=${month}&setter_id=${userId}` : `?month=${month}`
        const res = await fetch(`/api/admin/setting/commissions${queryParam}`, {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        })

        if (!res.ok) {
          const json = await res.json()
          setError(json?.error ?? "Error cargando comisiones")
          return
        }

        const json = await res.json()
        if (isSetter) {
          setCommissions(json.commission ? [json.commission] : [])
        } else {
          setCommissions(json.commissions ?? [])
        }
      } catch (err: any) {
        setError(err?.message ?? "Error de red")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [month, isSetter, userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-700/20 bg-red-700/5 px-4 py-3 text-sm text-red-700 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (commissions.length === 0) {
    return (
      <div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] px-4 py-6 text-center text-sm text-foreground/40">
        Sin comisiones registradas
      </div>
    )
  }

  // If setter: show single card with month selector
  if (isSetter && commissions.length === 1) {
    const c = commissions[0]
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">Mi comisión — <span className="text-[#ffde21]">{monthLabel(month)}</span></h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <CommissionCard label="Clientes" value={String(c.client_count)} />
          <CommissionCard label="MRR" value={formatCurrency(c.mrr_total)} />
          <CommissionCard label="Cash Cobrado" value={formatCurrency(c.cash_collected)} />
          <CommissionCard label="Old Cash" value={formatCurrency(c.old_cash)} small />
          <CommissionCard label="Comisión (5%)" value={formatCurrency(c.commission_earned)} highlight />
        </div>
      </div>
    )
  }

  // If admin/team: show summary + table
  const totalCommission = commissions.reduce((sum, c) => sum + c.commission_earned, 0)
  const totalOldCash = commissions.reduce((sum, c) => sum + c.old_cash, 0)
  const totalNewCash = commissions.reduce((sum, c) => sum + c.new_cash, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50">Comisiones del equipo — <span className="text-[#ffde21]">{monthLabel(month)}</span></h3>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl border border-[#ffde21]/30 bg-[#ffde21]/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Total en comisiones</span>
          <span className="text-lg font-bold text-[#ffde21]">{formatCurrency(totalCommission)}</span>
        </div>
      </div>

      {/* Per-setter table */}
      <div className="overflow-x-auto rounded-2xl border border-foreground/[0.07]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
              <th className="px-4 py-2.5 text-left font-semibold text-foreground/80">Setter</th>
              <th className="px-4 py-2.5 text-right font-semibold text-foreground/80">Clientes</th>
              <th className="px-4 py-2.5 text-right font-semibold text-foreground/80">MRR</th>
              <th className="px-4 py-2.5 text-right font-semibold text-foreground/80">Cash</th>
              <th className="px-4 py-2.5 text-right font-semibold text-foreground/80 text-[#ffde21]/70">Old</th>
              <th className="px-4 py-2.5 text-right font-semibold text-foreground/80">Comisión</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c.setter_id} className="border-b border-foreground/[0.04] hover:bg-foreground/[0.02] transition-colors">
                <td className="px-4 py-2.5 font-medium text-foreground">
                  {c.setter_name ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-right text-foreground/80">
                  {c.client_count}
                </td>
                <td className="px-4 py-2.5 text-right text-foreground/80">
                  {formatCurrency(c.mrr_total)}
                </td>
                <td className="px-4 py-2.5 text-right text-foreground/80">
                  {formatCurrency(c.cash_collected)}
                </td>
                <td className="px-4 py-2.5 text-right text-[#ffde21]/60 text-xs">
                  {c.old_cash > 0 ? formatCurrency(c.old_cash) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-[#ffde21]">
                  {formatCurrency(c.commission_earned)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CommissionCard({ label, value, highlight, small }: { label: string; value: string; highlight?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-3 text-center ${
      highlight
        ? "border-[#ffde21]/30 bg-[#ffde21]/5"
        : "border-foreground/[0.07] bg-card"
    }`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
        {label}
      </div>
      <div className={`mt-1.5 font-bold ${
        small ? "text-sm" : "text-lg"
      } ${
        highlight ? "text-[#ffde21]" : "text-foreground"
      }`}>
        {value}
      </div>
    </div>
  )
}
