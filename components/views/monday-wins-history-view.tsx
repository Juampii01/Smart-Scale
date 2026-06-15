"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { Star, Loader2, Target, AlertCircle, Trophy } from "lucide-react"

interface MondayWin {
  id: string
  fecha: string
  logro_1: string
  logro_2: string | null
  logro_3: string | null
  una_sola_cosa: string | null
  bloqueo: string | null
  created_at: string
}

function fmtDate(iso: string) {
  return new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("es-AR", {
    day: "numeric", month: "long", year: "numeric",
  })
}

export function MondayWinsHistoryView() {
  const activeClientId = useActiveClient()
  const [items, setItems] = useState<MondayWin[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    if (!activeClientId) { setItems([]); setLoading(false); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from("monday_wins")
        .select("id, fecha, logro_1, logro_2, logro_3, una_sola_cosa, bloqueo, created_at")
        .eq("client_id", activeClientId)
        .order("fecha", { ascending: false })
        .limit(100)
      setItems((data ?? []) as MondayWin[])
    } catch { setItems([]) } finally { setLoading(false) }
  }, [activeClientId])

  useEffect(() => { fetchItems() }, [fetchItems])

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
          <Trophy className="h-5 w-5 text-foreground/20" />
        </div>
        <p className="text-sm text-foreground/40">Todavía no hay Monday Wins registrados.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-foreground">Historial de Monday Wins</h3>
        <span className="text-xs text-foreground/30 tabular-nums">{items.length} registro{items.length !== 1 ? "s" : ""}</span>
      </div>

      {items.map((w) => (
        <div key={w.id} className="overflow-hidden rounded-[14px] border border-foreground/[0.07] bg-card">
          <div className="flex items-center gap-2.5 border-b border-foreground/[0.05] px-5 py-3">
            <Star className="h-3.5 w-3.5 text-[#ffde21]" />
            <span className="text-[13px] font-semibold text-foreground">{fmtDate(w.fecha)}</span>
          </div>
          <div className="p-5 space-y-4">
            {/* Logros */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/35 mb-2">Logros</p>
              <ul className="space-y-1.5">
                {[w.logro_1, w.logro_2, w.logro_3].filter(Boolean).map((l, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-foreground/80">
                    <span className="text-[#ffde21] font-bold">{i + 1}.</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>

            {w.una_sola_cosa && (
              <div className="rounded-xl border border-[#ffde21]/20 bg-[#ffde21]/[0.04] px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="h-3 w-3 text-[#ffde21]" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/80">Una sola cosa</p>
                </div>
                <p className="text-[13px] text-foreground/85">{w.una_sola_cosa}</p>
              </div>
            )}

            {w.bloqueo && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertCircle className="h-3 w-3 text-foreground/35" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/35">Bloqueo / pregunta</p>
                </div>
                <p className="text-[13px] text-foreground/65">{w.bloqueo}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
