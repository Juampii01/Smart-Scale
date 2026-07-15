"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Sk } from "@/components/ui/skeleton"
import { Stat } from "@/components/ui/stat"
import {
  TrendingUp, RefreshCw, MessageSquareText,
  CalendarClock, AlertTriangle, Clock, Users, DollarSign,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

type Range = "7d" | "14d" | "30d"

interface NewCashClient {
  id: string
  name: string
  total_amount: number
  paid_amount: number
  pending_amount: number
  program_start: string
  created_at: string
  programa: string | null
}

interface OldCashInstallment {
  id: string
  client_name: string
  client_id: string
  amount: number
  paid_at: string
  installment_number: number
}

interface SetterRow {
  setter_id:                  string
  setter_name:                string
  new_conversations_inbound:  number
  new_conversations_outbound: number
  outbound_replies:           number
  total_conversations:        number
  qualified_leads:            number
  offer_docs_sent:            number
  offer_doc_responses:        number
  calls_done:                 number
  cash_collected:             number
  cierres:                    number
  cierre_amount:              number
}

interface QuotaItem {
  id: string
  client_name: string
  client_id: string
  amount: number
  due_date: string
  installment_number: number
  days_overdue?: number
  days_until_due?: number
}

interface DashboardData {
  range: string
  period_start: string
  new_cash: {
    client_count: number
    total_contracted: number
    total_paid: number
    total_pending: number
    clients: NewCashClient[]
  }
  old_cash: {
    installment_count: number
    total_collected: number
    installments: OldCashInstallment[]
  }
  setting: {
    totals: Omit<SetterRow, "setter_id" | "setter_name">
    by_setter: SetterRow[]
  }
  upcoming_quotas: {
    overdue_count: number
    overdue_total: number
    upcoming_count: number
    upcoming_total: number
    overdue: QuotaItem[]
    upcoming: QuotaItem[]
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US")

const fmtDate = (s: string) => {
  const d = new Date(s + (s.length === 10 ? "T00:00:00Z" : ""))
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" })
}

const RANGE_LABELS: Record<Range, string> = {
  "7d":  "7 días",
  "14d": "14 días",
  "30d": "30 días",
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function BlockSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[14px] border border-foreground/[0.07] bg-card overflow-hidden", className)}>
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Sk className="h-3 w-28" />
            <Sk className="h-7 w-36" />
          </div>
          <Sk className="h-9 w-9 rounded-xl" />
        </div>
        <div className="flex gap-4">
          <Sk className="h-5 w-20 rounded-full" />
          <Sk className="h-5 w-20 rounded-full" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between">
            <Sk className="h-2.5 w-32" />
            <Sk className="h-2.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#dafc69]/[0.1] border border-[#dafc69]/20">
          <Icon className="h-4 w-4 text-[#dafc69]" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">{subtitle}</p>
          <p className="text-[15px] font-bold text-foreground leading-tight">{title}</p>
        </div>
      </div>
      {badge}
    </div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: "green" | "amber" | "blue" | "default"
}) {
  const colors = {
    green:   "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    amber:   "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
    blue:    "bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
    default: "bg-foreground/[0.05] text-foreground/70",
  }
  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold", colors[accent ?? "default"])}>
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </div>
  )
}

// ─── Block: New Cash ──────────────────────────────────────────────────────────

function NewCashBlock({ data }: { data: DashboardData["new_cash"] }) {
  return (
    <div className="rounded-[14px] border border-foreground/[0.07] bg-card overflow-hidden">
      <div className="p-5">
        <SectionHeader
          icon={TrendingUp}
          title="New Cash"
          subtitle={`${data.client_count} cliente${data.client_count !== 1 ? "s" : ""} nuevos`}
          badge={<Stat value={data.total_contracted} label="contratado" format="currency" />}
        />

        <div className="flex flex-wrap gap-2 mb-4">
          <StatPill label="cobrado" value={fmt(data.total_paid)}    accent="green" />
          <StatPill label="pendiente" value={fmt(data.total_pending)} accent="amber" />
        </div>

        {data.clients.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-foreground/40">
            Sin clientes nuevos en este período
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-foreground/[0.06]">
                  <th className="pb-2 text-left font-semibold text-foreground/40 pr-3">Cliente</th>
                  <th className="pb-2 text-right font-semibold text-foreground/40 pr-3">Contratado</th>
                  <th className="pb-2 text-right font-semibold text-foreground/40 pr-3">Cobrado</th>
                  <th className="pb-2 text-right font-semibold text-foreground/40">Pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/[0.04]">
                {data.clients.map(c => (
                  <tr key={c.id} className="group hover:bg-foreground/[0.02] transition-colors">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-foreground leading-tight">{c.name}</p>
                      {c.programa && (
                        <p className="text-[10px] text-foreground/40 mt-0.5">{c.programa}</p>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold text-foreground tabular-nums">
                      {fmt(c.total_amount)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {fmt(c.paid_amount)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      {fmt(c.pending_amount)}
                    </td>
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

// ─── Block: Old Cash ──────────────────────────────────────────────────────────

// Agrupa cuotas del mismo cliente cobradas el mismo día en una sola fila
function groupOldCashInstallments(installments: OldCashInstallment[]) {
  const map = new Map<string, {
    key: string
    client_name: string
    numbers: number[]
    total: number
    paid_at: string
  }>()
  for (const inst of installments) {
    const dateKey = inst.paid_at?.slice(0, 10) ?? ""
    const groupKey = `${inst.client_id}__${dateKey}`
    if (!map.has(groupKey)) {
      map.set(groupKey, {
        key: groupKey,
        client_name: inst.client_name,
        numbers: [],
        total: 0,
        paid_at: inst.paid_at,
      })
    }
    const g = map.get(groupKey)!
    g.numbers.push(inst.installment_number)
    g.total += inst.amount
  }
  return Array.from(map.values()).map(g => ({
    ...g,
    numbers: [...g.numbers].sort((a, b) => a - b),
    label: g.numbers.length === 1
      ? `#${g.numbers[0]}`
      : `#${[...g.numbers].sort((a, b) => a - b).join(" y #")}`,
  }))
}

function OldCashBlock({ data }: { data: DashboardData["old_cash"] }) {
  const grouped = groupOldCashInstallments(data.installments)
  return (
    <div className="rounded-[14px] border border-foreground/[0.07] bg-card overflow-hidden">
      <div className="p-5">
        <SectionHeader
          icon={RefreshCw}
          title="Caja Recurrente"
          subtitle={`${data.installment_count} cuota${data.installment_count !== 1 ? "s" : ""} cobradas`}
          badge={<Stat value={data.total_collected} label="cobrado" format="currency" />}
        />

        {grouped.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-foreground/40">
            Sin cuotas recurrentes cobradas en este período
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-foreground/[0.06]">
                  <th className="pb-2 text-left font-semibold text-foreground/40 pr-3">Cliente</th>
                  <th className="pb-2 text-center font-semibold text-foreground/40 pr-3">Cuota</th>
                  <th className="pb-2 text-right font-semibold text-foreground/40 pr-3">Monto</th>
                  <th className="pb-2 text-right font-semibold text-foreground/40">Cobrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/[0.04]">
                {grouped.map(g => (
                  <tr key={g.key} className="group hover:bg-foreground/[0.02] transition-colors">
                    <td className="py-2 pr-3 font-medium text-foreground">{g.client_name}</td>
                    <td className="py-2 pr-3 text-center text-foreground/60">{g.label}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-foreground tabular-nums">
                      {fmt(g.total)}
                    </td>
                    <td className="py-2 text-right text-foreground/50 text-[11px]">
                      {fmtDate(g.paid_at)}
                    </td>
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

// ─── Block: Setting ───────────────────────────────────────────────────────────

function SettingBlock({ data }: { data: DashboardData["setting"] }) {
  type Col = { key: keyof SetterRow; label: string; highlight?: boolean }
  const cols: Col[] = [
    { key: "new_conversations_inbound",  label: "Inbound"     },
    { key: "new_conversations_outbound", label: "Outbound"    },
    { key: "outbound_replies",           label: "Resp. OB"    },
    { key: "total_conversations",        label: "Total Conv.", highlight: true },
    { key: "qualified_leads",            label: "Leads"       },
    { key: "offer_docs_sent",            label: "Docs"        },
    { key: "offer_doc_responses",        label: "Doc Resp."   },
    { key: "calls_done",                 label: "Calls"       },
    { key: "cierres",                    label: "Cierres",    highlight: true },
    { key: "cierre_amount",              label: "Revenue"     },
  ]

  return (
    <div className="rounded-[14px] border border-foreground/[0.07] bg-card overflow-hidden">
      <div className="p-5">
        <SectionHeader
          icon={MessageSquareText}
          title="Setting / Equipo"
          subtitle="performance del período"
          badge={
            <div className="flex gap-5">
              <Stat value={data.totals.total_conversations} label="total conv." colorClass="text-[#dafc69]" />
              <Stat value={data.totals.cierres}             label="cierres" />
              <Stat value={data.totals.cierre_amount}       label="monto"   format="currency" />
            </div>
          }
        />

        {data.by_setter.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-foreground/40">
            Sin actividad de setting en este período
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-foreground/[0.06]">
                  <th className="pb-2 text-left font-semibold text-foreground/40 pr-4 min-w-[120px]">Setter</th>
                  {cols.map(c => (
                    <th
                      key={c.key}
                      className={cn(
                        "pb-2 text-right font-semibold px-2 whitespace-nowrap",
                        c.highlight ? "text-[#dafc69]/70" : "text-foreground/40",
                      )}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/[0.04]">
                {data.by_setter.map(s => (
                  <tr key={s.setter_id} className="group hover:bg-foreground/[0.02] transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{s.setter_name}</td>
                    {cols.map(c => (
                      <td
                        key={c.key}
                        className={cn(
                          "py-2.5 px-2 text-right tabular-nums",
                          c.highlight ? "font-bold text-[#dafc69]" : "text-foreground/80",
                          c.key === "cierre_amount" && "font-semibold text-foreground",
                        )}
                      >
                        {c.key === "cierre_amount"
                          ? (s.cierre_amount > 0 ? fmt(s.cierre_amount) : "—")
                          : String(s[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {/* Totals row — solo si hay más de un setter */}
              {data.by_setter.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-foreground/[0.1] bg-foreground/[0.02]">
                    <td className="py-2.5 pr-4 text-[11px] font-bold uppercase tracking-wider text-foreground/50">Total</td>
                    {cols.map(c => (
                      <td
                        key={c.key}
                        className={cn(
                          "py-2.5 px-2 text-right tabular-nums font-bold",
                          c.highlight ? "text-[#dafc69]" : "text-foreground",
                        )}
                      >
                        {c.key === "cierre_amount"
                          ? (data.totals.cierre_amount > 0 ? fmt(data.totals.cierre_amount) : "—")
                          : String((data.totals as any)[c.key])}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Block: Upcoming Quotas ───────────────────────────────────────────────────

function UpcomingQuotasBlock({ data }: { data: DashboardData["upcoming_quotas"] }) {
  return (
    <div className="rounded-[14px] border border-foreground/[0.07] bg-card overflow-hidden">
      <div className="p-5">
        <SectionHeader
          icon={CalendarClock}
          title="Cuotas Próximas"
          subtitle="vencidas y por vencer"
          badge={
            <div className="flex gap-4">
              {data.overdue_count > 0 && (
                <Stat value={data.overdue_total} label="vencidas" format="currency"
                  colorClass="text-red-700 dark:text-red-400" />
              )}
              {data.upcoming_count > 0 && (
                <Stat value={data.upcoming_total} label="próximas" format="currency" />
              )}
            </div>
          }
        />

        {data.overdue.length === 0 && data.upcoming.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-foreground/40">
            Sin cuotas pendientes en este período
          </p>
        ) : (
          <div className="space-y-5">
            {/* Overdue */}
            {data.overdue.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                    Vencidas ({data.overdue_count}) — {fmt(data.overdue_total)}
                  </span>
                </div>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-foreground/[0.06]">
                        <th className="pb-2 text-left font-semibold text-foreground/40 pr-3">Cliente</th>
                        <th className="pb-2 text-center font-semibold text-foreground/40 pr-3">Cuota</th>
                        <th className="pb-2 text-right font-semibold text-foreground/40 pr-3">Monto</th>
                        <th className="pb-2 text-right font-semibold text-foreground/40 pr-3">Vencimiento</th>
                        <th className="pb-2 text-right font-semibold text-foreground/40">Atraso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/[0.04]">
                      {data.overdue.map(q => (
                        <tr key={q.id} className="group hover:bg-red-50 dark:hover:bg-red-500/[0.04] transition-colors">
                          <td className="py-2 pr-3 font-medium text-foreground">{q.client_name}</td>
                          <td className="py-2 pr-3 text-center text-foreground/60">#{q.installment_number}</td>
                          <td className="py-2 pr-3 text-right font-semibold tabular-nums text-foreground">{fmt(q.amount)}</td>
                          <td className="py-2 pr-3 text-right text-foreground/50">{fmtDate(q.due_date)}</td>
                          <td className="py-2 text-right">
                            <span className="rounded-full bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-0.5 text-[10px] font-semibold">
                              {q.days_overdue}d
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Upcoming */}
            {data.upcoming.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Clock className="h-3.5 w-3.5 text-foreground/50" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">
                    Próximas ({data.upcoming_count}) — {fmt(data.upcoming_total)}
                  </span>
                </div>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-foreground/[0.06]">
                        <th className="pb-2 text-left font-semibold text-foreground/40 pr-3">Cliente</th>
                        <th className="pb-2 text-center font-semibold text-foreground/40 pr-3">Cuota</th>
                        <th className="pb-2 text-right font-semibold text-foreground/40 pr-3">Monto</th>
                        <th className="pb-2 text-right font-semibold text-foreground/40 pr-3">Vencimiento</th>
                        <th className="pb-2 text-right font-semibold text-foreground/40">En</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/[0.04]">
                      {data.upcoming.map(q => (
                        <tr key={q.id} className="group hover:bg-foreground/[0.02] transition-colors">
                          <td className="py-2 pr-3 font-medium text-foreground">{q.client_name}</td>
                          <td className="py-2 pr-3 text-center text-foreground/60">#{q.installment_number}</td>
                          <td className="py-2 pr-3 text-right font-semibold tabular-nums text-foreground">{fmt(q.amount)}</td>
                          <td className="py-2 pr-3 text-right text-foreground/50">{fmtDate(q.due_date)}</td>
                          <td className="py-2 text-right">
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              (q.days_until_due ?? 99) <= 3
                                ? "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : "bg-foreground/[0.05] text-foreground/60"
                            )}>
                              {q.days_until_due === 0 ? "hoy" : `${q.days_until_due}d`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AdminExecutiveDashboardView() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()

  const range = ((searchParams.get("range") ?? "30d") as Range)
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const setRange = useCallback((r: Range) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("range", r)
    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("No autorizado"); return }

      const res = await fetch(`/api/admin/executive-dashboard?range=${range}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Error al cargar datos"); return }
      setData(json)
    } catch (err: any) {
      setError(err?.message ?? "Error de red")
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived ──
  const periodLabel = (() => {
    if (!data) return ""
    const start = new Date(data.period_start + "T00:00:00Z")
    const end   = new Date()
    return `${start.toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" })} – ${end.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`
  })()

  return (
    <div className="max-w-[1280px] mx-auto space-y-5 pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-foreground leading-tight">Dashboard Ejecutivo</h1>
          {!loading && data && (
            <p className="text-[13px] text-foreground/50 mt-0.5">{periodLabel}</p>
          )}
        </div>

        {/* Range filter */}
        <div className="flex items-center gap-1 rounded-xl border border-foreground/[0.07] bg-card p-1">
          {(["7d", "14d", "30d"] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-all",
                range === r
                  ? "bg-[#dafc69] text-black shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/[0.05]",
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.05] px-4 py-3 flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-[13px] text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={fetchData}
            className="ml-auto text-[12px] font-semibold text-red-600 dark:text-red-400 hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BlockSkeleton />
            <BlockSkeleton />
          </div>
          <BlockSkeleton className="w-full" />
          <BlockSkeleton className="w-full" />
        </div>
      ) : data ? (
        <>
          {/* Row 1: New Cash + Old Cash */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <NewCashBlock  data={data.new_cash}  />
            <OldCashBlock  data={data.old_cash}  />
          </div>

          {/* Row 2: Setting */}
          <SettingBlock data={data.setting} />

          {/* Row 3: Upcoming Quotas */}
          <UpcomingQuotasBlock data={data.upcoming_quotas} />
        </>
      ) : null}
    </div>
  )
}
