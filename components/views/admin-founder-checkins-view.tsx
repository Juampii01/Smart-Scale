"use client"

/**
 * Check-in trimestral de dinero por cliente — sector Founder.
 *
 * Base mínima pedida por Juampi/Ann/Steffano (llamada 2/8): el equipo carga
 * esto a mano después de hablar con el cliente. Todavía NO es un flujo
 * automatizado ni algo que el cliente completa solo — eso quedó
 * explícitamente sin definir en la llamada ("no sé cómo pedir esto").
 * Admin only.
 */

import { useEffect, useState, useCallback } from "react"
import { Loader2, Save, Check, DollarSign } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { SectionHeader } from "@/components/ui/section-header"

interface Checkin {
  id: string
  client_id: string
  client_name: string
  quarter_label: string
  best_month_cash: number | null
  revenue_bracket: number | null
  next_quarter_goal_cash: number | null
  new_clients_needed: number | null
  notes: string | null
  updated_at: string
}

const REVENUE_BRACKETS = [10000, 20000, 40000, 60000, 80000, 100000]

function currentQuarterLabel(): string {
  const d = new Date()
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()}-Q${q}`
}

// Trimestres seleccionables: año actual completo + año siguiente completo —
// cubre "el trimestre en curso" y "el que está por arrancar" sin dejar
// que se tipeen valores libres (rompía comparaciones entre registros).
function quarterOptions(): string[] {
  const year = new Date().getFullYear()
  const options: string[] = []
  for (const y of [year, year + 1]) {
    for (let q = 1; q <= 4; q++) options.push(`${y}-Q${q}`)
  }
  return options
}

function fmtMoney(n: number | null): string {
  if (n == null) return "—"
  return `$${n.toLocaleString("es-AR")}`
}

const inputCls = "h-10 w-full rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-3 text-[13px] text-foreground placeholder:text-text-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-text-2 mb-1.5"

export function AdminFounderCheckinsView() {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const [clientId, setClientId] = useState("")
  const [quarter, setQuarter] = useState(currentQuarterLabel())
  const [bestMonthCash, setBestMonthCash] = useState("")
  const [revenueBracket, setRevenueBracket] = useState("")
  const [goalCash, setGoalCash] = useState("")
  const [newClientsNeeded, setNewClientsNeeded] = useState("")
  const [notes, setNotes] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch("/api/admin/founder/quarterly-checkins", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (res.ok) {
        setClients(json.clients ?? [])
        setCheckins(json.checkins ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !quarter.trim()) return
    setSaveState("saving")
    setErrorMsg("")
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setSaveState("error"); return }
      const res = await fetch("/api/admin/founder/quarterly-checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          client_id: clientId,
          quarter_label: quarter.trim(),
          best_month_cash: bestMonthCash,
          revenue_bracket: revenueBracket,
          next_quarter_goal_cash: goalCash,
          new_clients_needed: newClientsNeeded,
          notes,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setSaveState("error"); setErrorMsg(json?.error ?? "Error al guardar"); return }
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 1500)
      setBestMonthCash(""); setRevenueBracket(""); setGoalCash(""); setNewClientsNeeded(""); setNotes("")
      load()
    } catch (err: any) {
      setSaveState("error")
      setErrorMsg(err?.message ?? "Error inesperado")
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-[24px] font-bold text-foreground leading-tight">Check-in Trimestral de Dinero</h1>
        <p className="text-[13px] text-text-2 mt-0.5">
          Facturación, meta y clientes nuevos necesarios por cliente, cada trimestre. Se carga a mano después de la llamada — todavía no es automático.
        </p>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-foreground/[0.08] bg-card p-5">
        <SectionHeader icon={DollarSign} title="Nuevo registro" className="mb-4" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Cliente</label>
              <select className={inputCls} value={clientId} onChange={e => setClientId(e.target.value)} required>
                <option value="">Seleccioná un cliente…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Trimestre</label>
              <select className={inputCls} value={quarter} onChange={e => setQuarter(e.target.value)} required>
                {quarterOptions().map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Cash collected mensual más alto</label>
              <input className={inputCls} type="number" min="0" value={bestMonthCash} onChange={e => setBestMonthCash(e.target.value)} placeholder="$" />
            </div>
            <div>
              <label className={labelCls}>Escalón de revenue actual</label>
              <select className={inputCls} value={revenueBracket} onChange={e => setRevenueBracket(e.target.value)}>
                <option value="">—</option>
                {REVENUE_BRACKETS.map(b => <option key={b} value={b}>{fmtMoney(b)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Meta cash collected próx. trimestre</label>
              <input className={inputCls} type="number" min="0" value={goalCash} onChange={e => setGoalCash(e.target.value)} placeholder="$" />
            </div>
            <div>
              <label className={labelCls}>Nuevos clientes necesarios</label>
              <input className={inputCls} type="number" min="0" value={newClientsNeeded} onChange={e => setNewClientsNeeded(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notas</label>
            <textarea className={inputCls.replace("h-10", "min-h-[70px] py-2")} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contexto de la llamada, observaciones…" />
          </div>

          {saveState === "error" && <p className="text-[13px] text-red-700 dark:text-red-400">{errorMsg}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saveState === "saving" || !clientId}
              className="flex items-center gap-2 rounded-xl btn-accent px-5 py-2 text-[13px] font-bold transition disabled:opacity-50"
            >
              {saveState === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saveState === "saved" && <Check className="h-3.5 w-3.5" />}
              {saveState === "idle" && <Save className="h-3.5 w-3.5" />}
              {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "Guardado ✓" : "Guardar"}
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div>
        <SectionHeader icon={DollarSign} title="Historial" subtitle={`${checkins.length} registro${checkins.length !== 1 ? "s" : ""}`} className="mb-4" />
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-accent-ink/40" /></div>
        ) : checkins.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foreground/[0.08] bg-foreground/[0.02] px-6 py-10 text-center text-[13px] text-text-3">
            Todavía no hay check-ins cargados.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-foreground/[0.08] bg-card">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
                  {["Cliente", "Trimestre", "Cash collected top", "Escalón", "Meta próx.", "Nuevos clientes", "Notas"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-text-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {checkins.map(c => (
                  <tr key={c.id} className="border-b border-foreground/[0.04] last:border-b-0">
                    <td className="px-4 py-3 text-[13px] font-semibold text-foreground">{c.client_name}</td>
                    <td className="px-4 py-3 text-[13px] text-text-2">{c.quarter_label}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-foreground">{fmtMoney(c.best_month_cash)}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-foreground">{fmtMoney(c.revenue_bracket)}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-foreground">{fmtMoney(c.next_quarter_goal_cash)}</td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-foreground">{c.new_clients_needed ?? "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-text-2 max-w-[220px] truncate">{c.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
