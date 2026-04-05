"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { useMarkPageReady } from "@/hooks/use-mark-page-ready"
import {
  Trash2, AlertTriangle, Loader2, FileText, ChevronDown, ChevronUp, X
} from "lucide-react"

interface MonthlyReport {
  id: string
  month: string
  total_revenue: number | null
  cash_collected: number | null
  mrr: number | null
  new_clients: number | null
  active_clients: number | null
  scheduled_calls: number | null
  attended_calls: number | null
  ad_spend: number | null
  biggest_win: string | null
  next_focus: string | null
  created_at: string
}

function fmt(n: number | null | undefined, prefix = "$") {
  if (n == null) return "—"
  return `${prefix}${n.toLocaleString()}`
}

function fmtMonth(raw: string) {
  const [year, month] = raw.slice(0, 7).split("-")
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  const m = parseInt(month, 10)
  return `${names[m - 1] ?? month} ${year}`
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

function ConfirmDeleteDialog({
  month,
  onConfirm,
  onCancel,
  loading,
}: {
  month: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#111113] p-6 shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-white/30 hover:text-white/70 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>

        <h3 className="text-sm font-semibold uppercase tracking-widest text-white mb-1">
          Eliminar reporte
        </h3>
        <p className="text-sm text-white/50 mb-5">
          Vas a eliminar el reporte de <span className="text-white font-medium">{fmtMonth(month)}</span>.
          Esta acción no se puede deshacer.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/60 hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 hover:border-red-500/60 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {loading ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Report Row ───────────────────────────────────────────────────────────────

function ReportRow({
  report,
  isAdmin,
  onDelete,
}: {
  report: MonthlyReport
  isAdmin: boolean
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111113] overflow-hidden transition-all">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Month badge */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#ffde21]/10 border border-[#ffde21]/20">
          <FileText className="h-4 w-4 text-[#ffde21]" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{fmtMonth(report.month)}</p>
          <p className="text-[10px] text-white/30 mt-0.5">
            Creado {new Date(report.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>

        {/* Key metrics */}
        <div className="hidden sm:flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Revenue</p>
            <p className="text-sm font-semibold text-emerald-400">{fmt(report.total_revenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Cash</p>
            <p className="text-sm font-medium text-white/70">{fmt(report.cash_collected)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Nuevos</p>
            <p className="text-sm font-semibold text-[#ffde21]">{report.new_clients ?? "—"}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {isAdmin && (
            <button
              onClick={() => onDelete(report.id)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/[0.04] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-all"
              title="Eliminar reporte"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-4 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { label: "Revenue Total", value: fmt(report.total_revenue) },
            { label: "Cash Collected", value: fmt(report.cash_collected) },
            { label: "MRR", value: fmt(report.mrr) },
            { label: "Ad Spend", value: fmt(report.ad_spend) },
            { label: "Nuevos Clientes", value: report.new_clients ?? "—" },
            { label: "Clientes Activos", value: report.active_clients ?? "—" },
            { label: "Llamadas Agendadas", value: report.scheduled_calls ?? "—" },
            { label: "Llamadas Atendidas", value: report.attended_calls ?? "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-sm font-medium text-white/80">{String(value)}</p>
            </div>
          ))}
          {report.biggest_win && (
            <div className="col-span-2 sm:col-span-3 lg:col-span-4">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Mayor logro</p>
              <p className="text-sm text-white/70 leading-relaxed">{report.biggest_win}</p>
            </div>
          )}
          {report.next_focus && (
            <div className="col-span-2 sm:col-span-3 lg:col-span-4">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Próximo foco</p>
              <p className="text-sm text-white/70 leading-relaxed">{report.next_focus}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function ReportHistoryView() {
  const activeClientId = useActiveClient()
  const [reports, setReports] = useState<MonthlyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useMarkPageReady(!loading)
  const [isAdmin, setIsAdmin] = useState(false)
  const [jwt, setJwt] = useState<string | null>(null)

  // Confirm dialog state
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
          id, month, total_revenue, cash_collected, mrr, new_clients,
          active_clients, scheduled_calls, attended_calls, ad_spend,
          biggest_win, next_focus, created_at
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

      setIsAdmin(((prof as any)?.role ?? "").toLowerCase() === "admin")
    }
    init()
  }, [])

  useEffect(() => {
    loadReports()
  }, [loadReports])

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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
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
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111113] px-6 py-5">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#ffde21]/60 via-[#ffde21]/30 to-transparent" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/70 mb-1">
              Datos
            </p>
            <h2 className="text-xl font-bold text-white">Historial de Reportes</h2>
            <p className="text-sm text-white/40 mt-1">
              {loading ? "Cargando…" : `${reports.length} reporte${reports.length !== 1 ? "s" : ""} encontrado${reports.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : !activeClientId ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-white/30">Seleccioná un cliente para ver el historial.</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <FileText className="h-10 w-10 text-white/10" />
          <p className="text-sm text-white/30">No hay reportes cargados para este cliente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deleteError && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 mb-4">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{deleteError}</p>
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

      {/* Confirm Delete Dialog */}
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
