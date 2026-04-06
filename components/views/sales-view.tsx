"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useSelectedMonth, useActiveClient } from "@/components/layout/dashboard-layout"
import { useMarkPageReady } from "@/hooks/use-mark-page-ready"
import { useMinLoading } from "@/hooks/use-min-loading"
import { FunnelRowSkeleton, SectionHeaderSkeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, ArrowDown } from "lucide-react"
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonth(m: string) {
  const s = String(m).slice(0, 7)
  const [year, mon] = s.split("-")
  const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  return `${names[parseInt(mon,10)-1] ?? mon} '${year.slice(2)}`
}

function pct(num: number, den: number) {
  if (!den) return 0
  return Math.round((num / den) * 100)
}

function convColor(p: number) {
  if (p >= 60) return { bar: "#4ade80", text: "text-emerald-300", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20" }
  if (p >= 30) return { bar: "#ffde21", text: "text-yellow-300",  bg: "bg-yellow-500/10",  ring: "ring-yellow-500/20"  }
  return         { bar: "#f87171",  text: "text-red-300",     bg: "bg-red-500/10",     ring: "ring-red-500/20"     }
}

// ─── Visual Funnel Step ───────────────────────────────────────────────────────

function FunnelStep({
  label, count, pctOfTop, convFromPrev, convLabel, isLast,
}: {
  label: string; count: number; pctOfTop: number
  convFromPrev: number; convLabel: string; isLast?: boolean
}) {
  const col = convColor(pctOfTop)
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5 hover:border-white/[0.12] transition-colors">
        {/* Proportional fill bar as background */}
        <div
          className="absolute inset-y-0 left-0 rounded-2xl opacity-[0.07] transition-all duration-700"
          style={{ width: `${pctOfTop}%`, backgroundColor: col.bar }}
        />
        {/* Left accent */}
        <div className="absolute left-0 inset-y-0 w-[3px] rounded-l-2xl" style={{ backgroundColor: col.bar, opacity: 0.8 }} />

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">{label}</p>
            <p className="text-4xl font-bold tracking-tight text-white leading-none">
              {count > 0 ? count : "—"}
            </p>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            {/* % of top of funnel */}
            <span className={`text-2xl font-bold tabular-nums ${col.text}`}>
              {pctOfTop}%
            </span>
            <p className="text-[10px] text-white/30">del total agendado</p>
            {/* Conversion from previous step */}
            {!isLast && convFromPrev < 100 && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${col.bg} ${col.text} ${col.ring}`}>
                {convLabel} vs paso anterior
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Arrow between steps */}
      {!isLast && (
        <div className="flex flex-col items-center py-1 gap-0">
          <div className="h-3 w-px bg-white/10" />
          <ArrowDown className="h-3.5 w-3.5 text-white/20" />
        </div>
      )}
    </div>
  )
}

// ─── Mini stat card ───────────────────────────────────────────────────────────

function MiniStat({ label, value, sub, color = "#ffde21" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5 hover:border-white/[0.12] transition-colors">
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: `${color}99` }}>{label}</p>
      <p className="text-3xl font-bold tracking-tight text-white leading-none">{value}</p>
      {sub && <p className="mt-2 text-xs text-white/30">{sub}</p>}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesView() {
  const ctxMonth      = useSelectedMonth()
  const activeClientId = useActiveClient()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const selectedMonth = mounted ? (ctxMonth ?? "2025-12") : "2025-12"

  const [data, setData]         = useState<any | null>(null)
  const [history, setHistory]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const showSkeleton = useMinLoading(loading)
  useMarkPageReady(!showSkeleton)

  const monthValue = useMemo(() => {
    if (/^\d{4}-\d{2}$/.test(selectedMonth)) return `${selectedMonth}-01`
    return selectedMonth
  }, [selectedMonth])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        if (alive) { setLoading(true); setError(null) }
        const supabase = createClient()
        const { data: { user }, error: uErr } = await supabase.auth.getUser()
        if (uErr) throw uErr
        if (!user || !activeClientId) return

        const [curRes, histRes] = await Promise.all([
          supabase
            .from("monthly_reports")
            .select("scheduled_calls,attended_calls,aplications,new_clients,offer_docs_sent,offer_docs_responded,cierres_por_offerdoc")
            .eq("client_id", activeClientId)
            .eq("month", monthValue)
            .maybeSingle(),
          supabase
            .from("monthly_reports")
            .select("month,scheduled_calls,attended_calls,new_clients,offer_docs_sent,cierres_por_offerdoc")
            .eq("client_id", activeClientId)
            .order("month", { ascending: true })
            .limit(12),
        ])

        if (curRes.error) throw curRes.error
        if (histRes.error) throw histRes.error

        if (alive) {
          setData(curRes.data ?? null)
          setHistory(
            (histRes.data ?? []).map(r => ({
              month:    fmtMonth(r.month),
              agendadas: Number(r.scheduled_calls) || 0,
              atendidas: Number(r.attended_calls)  || 0,
              cierres:   Number(r.new_clients)     || 0,
              offerdocs: Number(r.cierres_por_offerdoc) || 0,
            }))
          )
          setLoading(false)
        }
      } catch (e: any) {
        if (alive) { setData(null); setLoading(false); setError(e?.message ?? "Error") }
      }
    }
    load()
    return () => { alive = false }
  }, [monthValue, activeClientId])

  const scheduled  = Number(data?.scheduled_calls) || 0
  const attended   = Number(data?.attended_calls)  || 0
  const aplications = Number(data?.aplications)    || 0
  const closed     = Number(data?.new_clients)     || 0
  const odSent     = Number(data?.offer_docs_sent) || 0
  const odResp     = Number(data?.offer_docs_responded) || 0
  const odCierres  = Number(data?.cierres_por_offerdoc) || 0

  const closeRatePct = attended > 0 ? ((closed / attended) * 100).toFixed(1) : "—"
  const odRespRate   = odSent    > 0 ? ((odResp / odSent)   * 100).toFixed(1) : "—"
  const odCloseRate  = odResp    > 0 ? ((odCierres / odResp) * 100).toFixed(1) : "—"

  if (showSkeleton) {
    return (
      <div className="space-y-6">
        <SectionHeaderSkeleton />
        <div className="space-y-3">{Array.from({length:3}).map((_,i) => <FunnelRowSkeleton key={i} />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Ventas y Conversión</h2>
        <p suppressHydrationWarning className="text-[13px] text-white/40 mt-0.5">
          Embudo mensual · {selectedMonth}
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!loading && !error && !data && <p className="text-white/40 text-sm">No hay reporte para este mes.</p>}

      <div className="grid gap-10 lg:grid-cols-2">
        {/* ── Funnel visual ── */}
        <section className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Embudo de llamadas</h3>
            <p className="text-xs text-white/35 mt-0.5">Cada barra muestra qué tan ancho llega a cada paso</p>
          </div>
          <div>
            <FunnelStep
              label="Llamadas agendadas"
              count={scheduled}
              pctOfTop={100}
              convFromPrev={100}
              convLabel="100%"
            />
            <FunnelStep
              label="Llamadas atendidas"
              count={attended}
              pctOfTop={pct(attended, scheduled)}
              convFromPrev={pct(attended, scheduled)}
              convLabel={`${pct(attended, scheduled)}%`}
            />
            <FunnelStep
              label="Nuevos clientes cerrados"
              count={closed}
              pctOfTop={pct(closed, scheduled)}
              convFromPrev={pct(closed, attended)}
              convLabel={`${pct(closed, attended)}%`}
              isLast
            />
          </div>

          {/* Close rate callout */}
          <div className={`rounded-2xl border p-5 flex items-center justify-between ${
            Number(closeRatePct) >= 20
              ? "border-emerald-500/20 bg-emerald-500/[0.06]"
              : Number(closeRatePct) >= 10
              ? "border-yellow-500/20 bg-yellow-500/[0.04]"
              : "border-red-500/20 bg-red-500/[0.04]"
          }`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Tasa de cierre</p>
              <p className="text-xs text-white/30 mt-0.5">cierres / llamadas atendidas</p>
            </div>
            <p className={`text-4xl font-bold tabular-nums ${
              Number(closeRatePct) >= 20 ? "text-emerald-300"
              : Number(closeRatePct) >= 10 ? "text-yellow-300"
              : "text-red-300"
            }`}>{closeRatePct}{closeRatePct !== "—" ? "%" : ""}</p>
          </div>
        </section>

        {/* ── Offer Docs + Aplicaciones ── */}
        <section className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Offer Docs & Pipeline</h3>
            <p className="text-xs text-white/35 mt-0.5">El recorrido desde la aplicación al cierre</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Aplicaciones"        value={aplications || "—"} color="#818cf8" />
            <MiniStat label="Offer Docs enviados" value={odSent || "—"}      color="#60a5fa" />
            <MiniStat
              label="Offer Docs respondidos"
              value={odResp || "—"}
              sub={`Response rate: ${odRespRate}${odRespRate !== "—" ? "%" : ""}`}
              color="#4ade80"
            />
            <MiniStat
              label="Cierres por Offer Doc"
              value={odCierres || "—"}
              sub={`Tasa: ${odCloseRate}${odCloseRate !== "—" ? "%" : ""}`}
              color="#ffde21"
            />
          </div>

          {/* Offer Doc funnel */}
          {odSent > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-5 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Funnel Offer Doc</p>
              {[
                { label: "Enviados", value: odSent,    pctW: 100,                         color: "#60a5fa" },
                { label: "Respondidos", value: odResp, pctW: pct(odResp, odSent),         color: "#4ade80" },
                { label: "Cerrados",  value: odCierres,pctW: pct(odCierres, odSent),      color: "#ffde21" },
              ].map(row => (
                <div key={row.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/50">{row.label}</span>
                    <span className="font-bold text-white tabular-nums">{row.value} <span className="text-white/35 font-normal">({row.pctW}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${row.pctW}%`, backgroundColor: row.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Historical funnel trend ── */}
      {history.length >= 2 && (
        <section className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Tendencia del Embudo</h3>
            <p className="text-xs text-white/35 mt-0.5">¿El pipeline está creciendo o deteriorándose?</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
            {/* Legend */}
            <div className="flex flex-wrap gap-5 mb-5">
              {[
                { label: "Agendadas", color: "#818cf8" },
                { label: "Atendidas", color: "#60a5fa" },
                { label: "Cierres",   color: "#4ade80" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                  <span className="text-[11px] text-white/50">{l.label}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={history} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="transparent" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis stroke="transparent" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f0f10", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "10px 14px" }}
                  labelStyle={{ color: "#fff", fontWeight: 700, fontSize: 12 }}
                  itemStyle={{ fontSize: 13, fontWeight: 600 }}
                />
                <Bar dataKey="agendadas" name="Agendadas" fill="#818cf8" fillOpacity={0.7} radius={[3,3,0,0]} maxBarSize={32} />
                <Line dataKey="atendidas" name="Atendidas" stroke="#60a5fa" strokeWidth={2.5} dot={{ fill: "#60a5fa", r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line dataKey="cierres"   name="Cierres"   stroke="#4ade80" strokeWidth={2.5} dot={{ fill: "#4ade80", r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  )
}
