"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { createClient } from "@/lib/supabase"
import { AiLoading } from "@/components/ui/ai-loading"
import {
  Youtube, Instagram, ExternalLink, Copy, ChevronDown, ChevronUp,
  Trash2, Search, X, Zap, AlertTriangle,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface VideoResult {
  video_id: string
  title: string
  description: string
  thumbnail: string | null
  video_url: string
  views: number
  likes: number
  duration: string
  comments: number
  published_at: string | null
  transcript: string | null
  analysis: string
}

interface HistoryItem {
  id: string
  channel_url: string
  channel_name: string
  channel_avatar?: string | null
  timeframe_days: number
  platform?: string
  videos: VideoResult[]
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Cell Modal ───────────────────────────────────────────────────────────────

function CellModal({ label, content, onClose }: { label: string; content: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl border border-white/[0.1] bg-[#111113] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] flex-shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">{label}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(content)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-white/40 hover:text-white hover:border-white/20 transition-all"
            >
              <Copy className="h-3 w-3" /> Copiar
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-base text-white/75 leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Expandable Cell ──────────────────────────────────────────────────────────

function ExpandCell({ label, content, preview, yellow }: { label: string; content: string | null; preview?: string; yellow?: boolean }) {
  const [open, setOpen] = useState(false)
  if (!content) return <span className="text-sm text-white/20">—</span>
  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        className={`block w-full text-left text-sm leading-snug line-clamp-2 overflow-hidden hover:opacity-80 transition-opacity ${yellow ? "text-[#ffde21]/80 font-medium" : "text-white/60"}`}
      >
        {preview ?? content.slice(0, 90)}{content.length > 90 ? "…" : ""}
      </button>
      {open && <CellModal label={label} content={content} onClose={() => setOpen(false)} />}
    </>
  )
}

// ─── Video Row ────────────────────────────────────────────────────────────────

function VideoRow({ video, channelName, platform }: { video: VideoResult; channelName: string; platform: string }) {
  const isIG = platform === "instagram"
  const hookContent = video.description || video.title || null
  const titleContent = isIG ? null : (video.title || null)
  const descContent  = isIG ? null : (video.description || null)

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      {/* CREATOR */}
      <td className="px-4 py-4 whitespace-nowrap">
        <span className="text-sm font-semibold text-white/80">{channelName || "—"}</span>
      </td>
      {/* URL */}
      <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
        <a href={video.video_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-[#ffde21] hover:text-[#ffe84d] transition-colors">
          Ver <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </td>
      {/* TITLE o HOOK */}
      <td className="px-4 py-4 max-w-[180px] overflow-hidden">
        <ExpandCell label={isIG ? "Hook / Caption" : "Título"} content={isIG ? hookContent : titleContent} />
      </td>
      {/* DESCRIPTION (YouTube) o vacío (Instagram) */}
      <td className="px-4 py-4 max-w-[160px] overflow-hidden">
        <ExpandCell label="Descripción" content={descContent} yellow />
      </td>
      {/* VIEWS */}
      <td className="px-4 py-4 text-right whitespace-nowrap">
        <span className="text-sm font-bold text-[#ffde21] tabular-nums">{fmt(video.views)}</span>
      </td>
      {/* DURATION */}
      <td className="px-4 py-4 text-center whitespace-nowrap">
        <span className="text-sm text-white/40 tabular-nums">{video.duration || "—"}</span>
      </td>
      {/* TRANSCRIPT */}
      <td className="px-4 py-4 max-w-[180px] overflow-hidden">
        <ExpandCell label="Transcript" content={video.transcript || null} yellow />
      </td>
      {/* ANALYSIS */}
      <td className="px-4 py-4 max-w-[180px] overflow-hidden">
        <ExpandCell label="Análisis IA" content={video.analysis || null} yellow />
      </td>
      {/* THUMBNAIL */}
      <td className="px-4 py-4">
        <div className="w-20 h-[45px] rounded-lg overflow-hidden border border-white/[0.07] bg-white/[0.03]">
          {video.thumbnail
            ? <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
            : <div className="flex h-full items-center justify-center"><Youtube className="h-4 w-4 text-white/20" /></div>}
        </div>
      </td>
    </tr>
  )
}

// ─── Results Table ────────────────────────────────────────────────────────────

function ResultsTable({ videos, channelName, platform }: { videos: VideoResult[]; channelName: string; platform: string }) {
  const isIG = platform === "instagram"
  const headers = ["CREATOR", "URL", isIG ? "HOOK" : "TÍTULO", isIG ? "—" : "DESCRIPCIÓN", "VIEWS", "DURACIÓN", "TRANSCRIPT", "ANÁLISIS", "THUMBNAIL"]
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px]">
        <thead>
          <tr className="border-b border-white/[0.06] bg-[#0c0c0d]/40">
            {headers.map((h, i) => (
              <th key={i} className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/25 ${h === "VIEWS" ? "text-right" : h === "DURACIÓN" ? "text-center" : "text-left"} ${h === "—" ? "opacity-0" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {videos.map(v => <VideoRow key={v.video_id} video={v} channelName={channelName} platform={platform} />)}
        </tbody>
      </table>
      <div className="border-t border-white/[0.04] px-6 py-2.5">
        <span className="text-xs text-white/20">{videos.length} video{videos.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  )
}

// ─── Analysis Card ────────────────────────────────────────────────────────────

function AnalysisCard({ item, onDelete, deletingId }: {
  item: HistoryItem
  onDelete: (id: string) => void
  deletingId: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const isInstagram = item.platform === "instagram"

  const dateStr = new Date(item.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#141416]">
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Platform icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#1c1c1f]">
          {isInstagram
            ? <Instagram className="h-[18px] w-[18px] text-[#ffde21]" />
            : <Youtube className="h-[18px] w-[18px] text-[#ffde21]" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-white">
              {isInstagram ? "Instagram" : "Youtube"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
              Completado
            </span>
          </div>
          {item.channel_name && (
            <p className="mt-0.5 text-[13px] font-medium text-white/70 truncate">{item.channel_name}</p>
          )}
          <p className="mt-0.5 text-[12px] text-white/35 truncate">
            {dateStr}
            <span className="mx-1.5">-</span>
            Últimos {item.timeframe_days} días
            {item.videos?.length > 0 && (
              <span className="ml-1.5 text-white/20">· {item.videos.length} videos</span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onDelete(item.id)}
            disabled={deletingId === item.id}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-white/70 hover:bg-white/[0.07] hover:text-white transition-all"
          >
            Ver Resultados
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded: videos table */}
      {expanded && (
        <div className="border-t border-white/[0.05] bg-[#0f0f11]">
          {item.videos?.length > 0
            ? <ResultsTable videos={item.videos} channelName={item.channel_name} platform={item.platform ?? "youtube"} />
            : <div className="px-6 py-8 text-center text-sm text-white/25">No hay videos en este análisis.</div>
          }
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function CompetitorResearchContent() {
  const [platform, setPlatform] = useState<"youtube" | "instagram">("youtube")
  const [channelUrl, setChannelUrl] = useState("")
  const [timeframe, setTimeframe] = useState<30 | 60 | 90>(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState<{ used: number; limit: number; resets_at: string } | null>(null)
  const [cachedNotice, setCachedNotice] = useState(false)
  const [monthUsage, setMonthUsage] = useState<{ used: number; limit: number } | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch("/api/content-research", { headers: { "Authorization": `Bearer ${session.access_token}` } })
      if (!res.ok) return
      const data = await res.json()
      setHistory(data.items ?? [])
    } catch { } finally { setHistoryLoading(false) }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!channelUrl.trim() || loading) return
    setLoading(true)
    setError(null)
    setLimitReached(null)
    setCachedNotice(false)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sesión expirada."); return }
      const res = await fetch("/api/content-research", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ channel_url: channelUrl.trim(), timeframe_days: timeframe, platform }),
      })
      const data = await res.json()

      if (res.status === 429 && data.limit_reached) {
        setLimitReached({ used: data.used, limit: data.limit, resets_at: data.resets_at })
        return
      }

      if (!res.ok) { setError(data.error ?? "Error al investigar."); return }

      // Update monthly usage counter
      if (data.used != null && data.limit != null) {
        setMonthUsage({ used: data.used, limit: data.limit })
      }

      // If result came from cache, show a notice
      if (data.cached) setCachedNotice(true)

      setChannelUrl("")
      fetchHistory()
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado. Intentá de nuevo.")
    } finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setDeletingId(id)
    try {
      await fetch("/api/content-research", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ id }),
      })
      setHistory(prev => prev.filter(i => i.id !== id))
    } finally { setDeletingId(null) }
  }

  return (
    <div className="px-6 py-10 max-w-6xl mx-auto space-y-8">

      {/* ── New Analysis form ── */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141416]">
        <div className="flex items-center gap-3 px-6 py-5">
          <Search className="h-4 w-4 text-white/50 shrink-0" />
          <h2 className="text-[15px] font-bold text-white">Nuevo Análisis</h2>
        </div>

        <div className="border-t border-white/[0.06] px-6 py-6 space-y-5">
          {/* Platform + Timeframe */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-white/50">Plataforma</label>
              <div className="relative">
                <select
                  value={platform}
                  onChange={e => { setPlatform(e.target.value as any); setChannelUrl(""); setError(null) }}
                  disabled={loading}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#1c1c1f] px-4 pr-10 text-sm text-white/80 focus:border-white/20 focus:outline-none appearance-none cursor-pointer disabled:opacity-60"
                >
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-white/50">Período</label>
              <div className="relative">
                <select
                  value={timeframe}
                  onChange={e => setTimeframe(Number(e.target.value) as any)}
                  disabled={loading}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#1c1c1f] px-4 pr-10 text-sm text-white/80 focus:border-white/20 focus:outline-none appearance-none cursor-pointer disabled:opacity-60"
                >
                  <option value={30}>Últimos 30 días</option>
                  <option value={60}>Últimos 60 días</option>
                  <option value={90}>Últimos 90 días</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
            </div>
          </div>

          {/* URL + Submit */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <label className="block text-[13px] font-medium text-white/50">URL del Competidor</label>
              <input
                type="url"
                value={channelUrl}
                onChange={e => { setChannelUrl(e.target.value); setError(null) }}
                placeholder={platform === "youtube" ? "Ingresá la URL del canal de YouTube..." : "Ingresá la URL del perfil de Instagram..."}
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#1c1c1f] px-4 text-sm text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none transition-all"
                disabled={loading}
              />
              <p className="text-[12px] text-white/30">Un perfil de competidor por envío</p>
            </div>

            <button
              type="submit"
              disabled={!channelUrl.trim() || loading}
              className="inline-flex items-center gap-2 h-10 rounded-xl bg-[#ffde21] px-5 text-sm font-bold text-black hover:bg-[#ffe46b] disabled:opacity-40 transition"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  Iniciar análisis
                </>
              )}
            </button>
          </form>

          {/* Usage counter */}
          {monthUsage && !limitReached && (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
              <Zap className="h-3.5 w-3.5 text-[#ffde21]/60 shrink-0" />
              <span className="text-xs text-white/40">
                Análisis este mes: <span className={`font-semibold ${monthUsage.used >= monthUsage.limit ? "text-red-400" : "text-white/70"}`}>{monthUsage.used}</span>
                <span className="text-white/25"> / {monthUsage.limit}</span>
              </span>
            </div>
          )}

          {/* Cache notice */}
          {cachedNotice && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5">
              <Zap className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-300">Resultado del caché — ya analizaste este canal esta semana. No se usaron tokens.</span>
            </div>
          )}

          {/* Limit reached */}
          {limitReached && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-300">Límite mensual alcanzado</p>
                <p className="text-xs text-amber-200/60 mt-0.5">
                  Usaste {limitReached.used} de {limitReached.limit} análisis disponibles este mes.
                  Los análisis se renuevan el{" "}
                  {new Date(limitReached.resets_at).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}.
                </p>
                <p className="text-xs text-amber-200/40 mt-1">Tus análisis anteriores siguen disponibles en el historial.</p>
              </div>
            </div>
          )}

          {/* Generic error */}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        {loading && (
          <div className="border-t border-white/[0.05]">
            <AiLoading
              title="Investigando competidor"
              steps={[
                "Resolviendo canal…",
                "Obteniendo videos recientes…",
                "Analizando métricas…",
                "Seleccionando los mejores resultados…",
                "Generando insights con IA…",
              ]}
            />
          </div>
        )}
      </div>

      {/* ── Your Analyses ── */}
      <div className="space-y-4">
        <h2 className="text-[15px] font-bold text-white px-1">Tus Análisis</h2>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-[24px] border border-white/[0.07] bg-[#111113] px-6 py-16 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
              <Search className="h-5 w-5 text-white/20" />
            </div>
            <p className="text-sm text-white/30">Todavía no hay análisis. Iniciá un análisis de competidor arriba para empezar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(item => (
              <AnalysisCard key={item.id} item={item} onDelete={handleDelete} deletingId={deletingId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CompetitorResearchPage() {
  return (
    <DashboardLayout>
      <CompetitorResearchContent />
    </DashboardLayout>
  )
}
