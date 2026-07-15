"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { DollarSign, Loader2, TrendingUp, Wallet, Quote } from "lucide-react"

interface ChaChing {
  id: string
  fecha: string
  valor_trato: number
  cash_collected: number
  proximo_nivel: string | null
  notas: string | null
  created_at: string
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0)
}
function fmtDate(iso: string) {
  return new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("es-AR", {
    day: "numeric", month: "short", year: "numeric",
  })
}

export function ChaChingHistoryView() {
  const activeClientId = useActiveClient()
  const [items, setItems] = useState<ChaChing[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!activeClientId) { setItems([]); setLoading(false); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from("cha_ching")
        .select("id, fecha, valor_trato, cash_collected, proximo_nivel, notas, created_at")
        .eq("client_id", activeClientId)
        .order("fecha", { ascending: false })
        .limit(200)
      setItems((data ?? []) as ChaChing[])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [activeClientId])

  useEffect(() => { fetchItems() }, [fetchItems])

  const totals = useMemo(() => {
    const now = new Date()
    const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
    let totalDeals = 0, totalCash = 0, mesCash = 0
    for (const i of items) {
      totalDeals += Number(i.valor_trato) || 0
      totalCash  += Number(i.cash_collected) || 0
      if (i.fecha?.slice(0, 7) === thisMonth) mesCash += Number(i.cash_collected) || 0
    }
    return { totalDeals, totalCash, mesCash, count: items.length }
  }, [items])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[14px] border border-foreground/[0.07] bg-card py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-foreground/[0.07] bg-foreground/[0.03]">
          <DollarSign className="h-5 w-5 text-foreground/20" />
        </div>
        <p className="text-sm text-foreground/40">Todavía no hay ventas (Cha-Ching) registradas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[14px] border border-foreground/[0.07] bg-card p-4">
          <div className="flex items-center gap-1.5 text-foreground/35 mb-1.5"><TrendingUp className="h-3 w-3" /><span className="text-[10px] font-semibold uppercase tracking-widest">Total cerrado</span></div>
          <p className="text-xl font-bold text-foreground tabular-nums">{fmtMoney(totals.totalDeals)}</p>
        </div>
        <div className="rounded-[14px] border border-foreground/[0.07] bg-card p-4">
          <div className="flex items-center gap-1.5 text-foreground/35 mb-1.5"><Wallet className="h-3 w-3" /><span className="text-[10px] font-semibold uppercase tracking-widest">Cash total</span></div>
          <p className="text-xl font-bold text-[#dafc69] tabular-nums">{fmtMoney(totals.totalCash)}</p>
        </div>
        <div className="rounded-[14px] border border-foreground/[0.07] bg-card p-4">
          <div className="flex items-center gap-1.5 text-foreground/35 mb-1.5"><DollarSign className="h-3 w-3" /><span className="text-[10px] font-semibold uppercase tracking-widest">Cash este mes</span></div>
          <p className="text-xl font-bold text-foreground tabular-nums">{fmtMoney(totals.mesCash)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-foreground">Historial de ventas</h3>
        <span className="text-xs text-foreground/30 tabular-nums">{totals.count} venta{totals.count !== 1 ? "s" : ""}</span>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-foreground/[0.07] bg-card divide-y divide-foreground/[0.05]">
        {items.map((d) => (
          <div key={d.id} className="px-5 py-3.5">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#dafc69]/10 border border-[#dafc69]/20">
                <DollarSign className="h-4 w-4 text-[#dafc69]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground tabular-nums">{fmtMoney(d.valor_trato)}</p>
                <p className="text-[11px] text-foreground/35">{fmtDate(d.fecha)}{d.proximo_nivel ? ` · próximo: ${d.proximo_nivel}` : ""}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-foreground/30">Cash</p>
                <p className="text-[13px] font-bold text-[#dafc69] tabular-nums">{fmtMoney(d.cash_collected)}</p>
              </div>
            </div>
            {d.notas && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-3.5 py-2.5">
                <Quote className="h-3.5 w-3.5 shrink-0 text-[#dafc69]/60 mt-0.5" />
                <p className="text-[12.5px] text-foreground/70 leading-relaxed whitespace-pre-wrap">{d.notas}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
