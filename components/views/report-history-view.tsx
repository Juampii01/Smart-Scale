"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useActiveClient, useOwnClient } from "@/components/layout/dashboard-layout"
import { useMarkPageReady } from "@/hooks/use-mark-page-ready"
import { isAdmin as isAdminRole } from "@/lib/auth/permissions"
import {
  Trash2, AlertTriangle, Loader2, FileText, ChevronDown, ChevronUp, X,
  DollarSign, TrendingUp, Mail, Youtube, Instagram, Users, MessageSquare,
} from "lucide-react"

interface MonthlyReport {
  id: string
  month: string
  total_revenue: number | null
  cash_collected: number | null
  mrr: number | null
  software_costs: number | null
  variable_costs: number | null
  ad_spend: number | null
  scheduled_calls: number | null
  attended_calls: number | null
  qualified_calls: number | null
  inbound_messages: number | null
  aplications: number | null
  new_clients: number | null
  active_clients: number | null
  offer_docs_sent: number | null
  offer_docs_responded: number | null
  cierres_por_offerdoc: number | null
  short_followers: number | null
  short_reach: number | null
  short_posts: number | null
  yt_subscribers: number | null
  yt_new_subscribers: number | null
  yt_monthly_audience: number | null
  yt_views: number | null
  yt_watch_time: number | null
  yt_videos: number | null
  email_subscribers: number | null
  email_new_subscribers: number | null
  email_sent: number | null
  email_open_rate: number | null
  nps_score: number | null
  biggest_win: string | null
  next_focus: string | null
  support_needed: string | null
  improvements: string | null
  created_at: string
}

function fmt(n: number | null | undefined, prefix = "$") {
  if (n == null) return "—"
  return `${prefix}${n.toLocaleString()}`
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—"
  return n.toLocaleString()
}

function fmtMonth(raw: string) {
  const [year, month] = raw.slice(0, 7).split("-")
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  const m = parseInt(month, 10)
  return `${names[m - 1] ?? month} ${year}`
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

function ConfirmDeleteDialog({
  month, onConfirm, onCancel, loading,
}: {
  month: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-red-400 bg-card p-6 shadow-2xl dark:border-red-500/30">
        <button onClick={onCancel} className="absolute right-4 top-4 text-foreground/30 hover:text-foreground/70 transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 border border-red-300 dark:bg-red-500/10 dark:border-red-500/20">
          <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-400" />
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground mb-1">Eliminar reporte</h3>
        <p className="text-sm text-foreground/50 mb-5">
          Vas a eliminar el reporte de <span className="text-foreground font-medium">{fmtMonth(month)}</span>.
          Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-4 py-2 text-sm text-foreground/60 hover:bg-foreground/[0.08] hover:text-foreground transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg border border-red-400 bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200 hover:border-red-500 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 dark:hover:border-red-500/60 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {loading ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Section block inside expanded detail ────────────────────────────────────

function DetailSection({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3 w-3 text-foreground/30" />
        <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/30">{label}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
        {children}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] text-foreground/30 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground/80">{String(value)}</p>
    </div>
  )
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="col-span-2 sm:col-span-3 lg:col-span-4">
      <p className="text-[10px] text-foreground/30 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground/70 leading-relaxed">{value}</p>
    </div>
  )
}

// ─── Report Row ───────────────────────────────────────────────────────────────

function ReportRow({
  report, isAdmin, onDelete,
}: {
  report: MonthlyReport
  isAdmin: boolean
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-foreground/[0.06] bg-card overflow-hidden transition-all">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#ffde21]/10 border border-[#ffde21]/20">
          <FileText className="h-4 w-4 text-[#ffde21]" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{fmtMonth(report.month)}</p>
          <p className="text-[10px] text-foreground/30 mt-0.5">
            Creado {new Date(report.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] text-foreground/30 uppercase tracking-wider">Revenue</p>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{fmt(report.total_revenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-foreground/30 uppercase tracking-wider">Cash</p>
            <p className="text-sm font-medium text-foreground/70">{fmt(report.cash_collected)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-foreground/30 uppercase tracking-wider">Nuevos</p>
            <p className="text-sm font-semibold text-[#ffde21]">{report.new_clients ?? "—"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-foreground/[0.06] bg-foreground/[0.04] text-foreground/40 hover:text-foreground/80 hover:bg-foreground/[0.08] transition-all"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {isAdmin && (
            <button
              onClick={() => onDelete(report.id)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-700 hover:text-red-900 hover:bg-red-100 hover:border-red-500 dark:border-red-500/20 dark:bg-red-500/[0.04] dark:text-red-400/60 dark:hover:text-red-400 dark:hover:bg-red-500/10 dark:hover:border-red-500/40 transition-all"
              title="Eliminar reporte"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-foreground/[0.06] px-4 py-5 space-y-5">

          {/* Financiero */}
          <DetailSection icon={DollarSign} label="Financiero">
            <Stat label="Revenue Total"   value={fmt(report.total_revenue)} />
            <Stat label="Cash Collected"  value={fmt(report.cash_collected)} />
            <Stat label="MRR"             value={fmt(report.mrr)} />
            <Stat label="Ad Spend"        value={fmt(report.ad_spend)} />
            <Stat label="Software Costs"  value={fmt(report.software_costs)} />
            <Stat label="Variable Costs"  value={fmt(report.variable_costs)} />
          </DetailSection>

          {/* Ventas */}
          <DetailSection icon={TrendingUp} label="Ventas">
            <Stat label="Nuevos Clientes"       value={fmtNum(report.new_clients)} />
            <Stat label="Clientes Activos"      value={fmtNum(report.active_clients)} />
            <Stat label="Llamadas Agendadas"    value={fmtNum(report.scheduled_calls)} />
            <Stat label="Llamadas Atendidas"    value={fmtNum(report.attended_calls)} />
            <Stat label="Llamadas Calificadas"  value={fmtNum(report.qualified_calls)} />
            <Stat label="Aplicaciones"          value={fmtNum(report.aplications)} />
            <Stat label="Offer Docs Enviados"   value={fmtNum(report.offer_docs_sent)} />
            <Stat label="Offer Docs Resp."      value={fmtNum(report.offer_docs_responded)} />
            <Stat label="Cierres x Offer Doc"   value={fmtNum(report.cierres_por_offerdoc)} />
            <Stat label="Mensajes Inbound"      value={fmtNum(report.inbound_messages)} />
            {report.nps_score != null && (
              <Stat label="NPS Score" value={report.nps_score} />
            )}
          </DetailSection>

          {/* Instagram / Shorts */}
          <DetailSection icon={Instagram} label="Instagram / Shorts">
            <Stat label="Seguidores"     value={fmtNum(report.short_followers)} />
            <Stat label="Alcance"        value={fmtNum(report.short_reach)} />
            <Stat label="Posts Shorts"   value={fmtNum(report.short_posts)} />
          </DetailSection>

          {/* YouTube */}
          <DetailSection icon={Youtube} label="YouTube">
            <Stat label="Suscriptores"       value={fmtNum(report.yt_subscribers)} />
            <Stat label="Nuevos Suscript."   value={fmtNum(report.yt_new_subscribers)} />
            <Stat label="Audiencia Mensual"  value={fmtNum(report.yt_monthly_audience)} />
            <Stat label="Vistas"             value={fmtNum(report.yt_views)} />
            <Stat label="Watch Time (hs)"    value={fmtNum(report.yt_watch_time)} />
            <Stat label="Videos Publicados"  value={fmtNum(report.yt_videos)} />
          </DetailSection>

          {/* Email */}
          <DetailSection icon={Mail} label="Email">
            <Stat label="Total Subscribers"  value={fmtNum(report.email_subscribers)} />
            <Stat label="Nuevos Suscript."   value={fmtNum(report.email_new_subscribers)} />
            <Stat label="Emails Sent"        value={fmtNum(report.email_sent)} />
            {report.email_open_rate != null && (
              <Stat label="Open Rate" value={`${report.email_open_rate}%`} />
            )}
          </DetailSection>

          {/* Reflexión */}
          <DetailSection icon={MessageSquare} label="Reflexión">
            <TextBlock label="Mayor logro"         value={report.biggest_win} />
            <TextBlock label="Próximo foco"        value={report.next_focus} />
            <TextBlock label="Mejoras del mes"     value={report.improvements} />
            <TextBlock label="Soporte necesario"   value={report.support_needed} />
          </DetailSection>

        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function ReportHistoryView() {
  const activeClientId = useActiveClient()
  const ownClientId    = useOwnClient()
  const isOwn = !!activeClientId && !!ownClientId && activeClientId === ownClientId
  const [reports, setReports] = useState<MonthlyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useMarkPageReady(!loading)
  const [isAdmin, setIsAdmin] = useState(false)
  const [jwt, setJwt] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<{ id: string; month: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const loadReports = useCallback(async () => {
    if (!activeClientId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from("monthly_reports")
        .select(`
          id, month, created_at,
          total_revenue, cash_collected, mrr, ad_spend, software_costs, variable_costs,
          new_clients, active_clients, scheduled_calls, attended_calls, qualified_calls,
          inbound_messages, aplications, offer_docs_sent, offer_docs_responded, cierres_por_offerdoc,
          nps_score,
          short_followers, short_reach, short_posts,
          yt_subscribers, yt_new_subscribers, yt_monthly_audience, yt_views, yt_watch_time, yt_videos,
          email_subscribers, email_new_subscribers, email_sent, email_open_rate,
          biggest_win, next_focus, improvements, support_needed
        `)
        .eq("client_id", activeClientId)
        .order("month", { ascending: false })

      if (err) throw err
      setReports((data ?? []) as MonthlyReport[])
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar reportes")
    } finally {
      setLoading(false)
    }
  }, [activeClientId])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setJwt(session.access_token)
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle()
      setIsAdmin(isAdminRole((prof as any)?.role))
    }
    init()
  }, [])

  useEffect(() => { loadReports() }, [loadReports])

  const handleDeleteRequest = (id: string) => {
    const report = reports.find((r) => r.id === id)
    if (!report) return
    setDeleteError(null)
    setPendingDelete({ id, month: report.month })
  }

  const handleDeleteConfirm = async () => {
    if (!pendingDelete || !jwt) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch("/api/monthly-reports/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ id: pendingDelete.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Error al eliminar")
      setReports((prev) => prev.filter((r) => r.id !== pendingDelete.id))
      setPendingDelete(null)
      router.refresh()
    } catch (e: any) {
      setDeleteError(e?.message ?? "Error al eliminar")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.06] bg-card px-6 py-5">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#ffde21]/60 via-[#ffde21]/30 to-transparent" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/70 mb-1">Datos</p>
          <h2 className="text-xl font-bold text-foreground">Historial de Reportes</h2>
          <p className="text-sm text-foreground/40 mt-1">
            {loading ? "Cargando…" : `${reports.length} reporte${reports.length !== 1 ? "s" : ""} encontrado${reports.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-foreground/30" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-500/20 dark:bg-red-500/5">
          <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      ) : !activeClientId ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-foreground/30">Seleccioná un cliente para ver el historial.</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <FileText className="h-10 w-10 text-foreground/10" />
          <p className="text-sm text-foreground/30">
            {isOwn ? "Todavía no tenés reportes cargados." : "No hay reportes cargados para este cliente."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {deleteError && (
            <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 mb-4 dark:border-red-500/20 dark:bg-red-500/5">
              <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{deleteError}</p>
            </div>
          )}
          {reports.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              isAdmin={isAdmin}
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDeleteDialog
          month={pendingDelete.month}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPendingDelete(null)}
          loading={deleting}
        />
      )}
    </div>
  )
}
