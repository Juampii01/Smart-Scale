"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { DollarSign, Loader2, TrendingUp, Wallet, Quote, Plus } from "lucide-react"

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

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

  const startEditing = (item: ChaChing) => {
    setEditingId(item.id)
    setDraft(item.notas ?? "")
  }

  const saveNotas = async (id: string) => {
    if (!draft.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch("/api/chi-chang", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id, notas: draft.trim() }),
      })
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, notas: draft.trim() } : i)))
        setEditingId(null)
      }
    } finally {
      setSaving(false)
    }
  }

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
        <Loader2 className="h-5 w-5 animate-spin text-text-3" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[14px] border border-border bg-card py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-foreground/[0.03]">
          <DollarSign className="h-5 w-5 text-text-3" />
        </div>
        <p className="text-[13px] text-text-2">Todavía no hay ventas (Cha-Ching) registradas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[14px] border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-text-3 mb-1.5"><TrendingUp className="h-3 w-3" /><span className="text-[11px] font-semibold uppercase tracking-widest">Total cerrado</span></div>
          <p className="text-[24px] font-bold text-foreground tabular-nums">{fmtMoney(totals.totalDeals)}</p>
        </div>
        <div className="rounded-[14px] border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-text-3 mb-1.5"><Wallet className="h-3 w-3" /><span className="text-[11px] font-semibold uppercase tracking-widest">Cash total</span></div>
          <p className="text-[24px] font-bold text-accent-ink tabular-nums">{fmtMoney(totals.totalCash)}</p>
        </div>
        <div className="rounded-[14px] border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-text-3 mb-1.5"><DollarSign className="h-3 w-3" /><span className="text-[11px] font-semibold uppercase tracking-widest">Cash este mes</span></div>
          <p className="text-[24px] font-bold text-foreground tabular-nums">{fmtMoney(totals.mesCash)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <h3 className="text-[13px] font-bold text-foreground">Historial de ventas</h3>
        <span className="text-[13px] text-text-3 tabular-nums">{totals.count} venta{totals.count !== 1 ? "s" : ""}</span>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card divide-y divide-border">
        {items.map((d) => (
          <div key={d.id} className="px-5 py-3.5">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft border border-accent/25">
                <DollarSign className="h-4 w-4 text-accent-ink" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground tabular-nums">{fmtMoney(d.valor_trato)}</p>
                <p className="text-[13px] text-text-3">{fmtDate(d.fecha)}{d.proximo_nivel ? ` · próximo: ${d.proximo_nivel}` : ""}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-widest text-text-3">Cash</p>
                <p className="text-[13px] font-bold text-accent-ink tabular-nums">{fmtMoney(d.cash_collected)}</p>
              </div>
            </div>
            {d.notas && editingId !== d.id && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-foreground/[0.02] px-3.5 py-2.5">
                <Quote className="h-3.5 w-3.5 shrink-0 text-accent-ink/60 mt-0.5" />
                <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">{d.notas}</p>
              </div>
            )}

            {!d.notas && editingId !== d.id && (
              <button
                type="button"
                onClick={() => startEditing(d)}
                className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-text-2 hover:text-foreground transition-colors"
              >
                <Plus className="h-3 w-3" /> Agregar reflexión
              </button>
            )}

            {editingId === d.id && (
              <div className="mt-3 space-y-2">
                <textarea
                  autoFocus
                  rows={3}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ej: Este cliente me dijo 3 veces que no… y entendí que el seguimiento gana más tratos que el pitch."
                  className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-text-3 focus:border-accent focus:outline-none resize-y leading-relaxed"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveNotas(d.id)}
                    disabled={saving || !draft.trim()}
                    className="rounded-lg btn-accent px-3.5 py-1.5 text-[13px] font-bold disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-text-2 hover:text-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
