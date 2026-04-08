"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { createClient } from "@/lib/supabase"
import { AiLoading } from "@/components/ui/ai-loading"
import {
  Youtube, Instagram, ExternalLink, Copy, Check, ChevronDown,
  Sparkles, Trash2, Eye, ThumbsUp, MessageCircle, Clock, Search,
  Maximize2, Type, X,
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

interface DetailModalData {
  label: string
  title: string
  content: string
  tone?: "default" | "highlight"
  icon?: "title" | "description" | "transcript" | "analysis"
  meta?: string
}

interface DetailCardProps {
  label: string
  preview: string
  onOpen: () => void
  accent?: "default" | "highlight"
  icon?: "title" | "description" | "transcript" | "analysis"
  meta?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function getDetailIcon(icon?: "title" | "description" | "transcript" | "analysis") {
  switch (icon) {
    case "title":
      return <Type className="h-4 w-4" />
    case "description":
      return <Eye className="h-4 w-4" />
    case "transcript":
      return <Copy className="h-4 w-4" />
    case "analysis":
      return <Sparkles className="h-4 w-4" />
    default:
      return <Eye className="h-4 w-4" />
  }
}

function getDetailPreview(text: string, len = 260): string {
  return text.length > len ? text.slice(0, len).trimEnd() + "…" : text
}

function CopyBtn({ text }: { text: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!text) return <span className="text-white/20 text-xs">—</span>
  return (
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="inline-flex items-start gap-1.5 text-left text-xs text-[#ffde21]/70 hover:text-[#ffde21] transition-colors group"
    >
      <span className="max-w-[150px] leading-relaxed line-clamp-3">
        {text.slice(0, 100)}{text.length > 100 ? "…" : ""}
      </span>
      {copied
        ? <Check className="h-3 w-3 text-emerald-400 flex-shrink-0 mt-0.5" />
        : <Copy className="h-3 w-3 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60" />}
    </button>
  )
}

function DetailCard({
  label,
  preview,
  onOpen,
  accent = "default",
  icon = "description",
  meta,
}: DetailCardProps) {
  const isHighlight = accent === "highlight"

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group w-full rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
        isHighlight
          ? "border-[#ffde21]/12 bg-[#ffde21]/[0.035] hover:border-[#ffde21]/28 hover:bg-[#ffde21]/[0.06]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.035]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border ${
            isHighlight
              ? "border-[#ffde21]/20 bg-[#ffde21]/10 text-[#ffde21]"
              : "border-white/[0.08] bg-white/[0.04] text-white/45"
          }`}>
            {getDetailIcon(icon)}
          </span>
          <div className="min-w-0">
            <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${
              isHighlight ? "text-[#ffde21]/70" : "text-white/35"
            }`}>
              {label}
            </p>
            {meta && <p className="mt-0.5 text-[11px] text-white/25">{meta}</p>}
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-white/35 transition-all group-hover:border-white/[0.16] group-hover:text-white/60">
          <Maximize2 className="h-3 w-3" />
          Ver completo
        </span>
      </div>

      <p className={`text-sm leading-7 ${
        isHighlight ? "text-[#ffde21]/76" : "text-white/58"
      }`}>
        {preview}
      </p>
    </button>
  )
}

function DetailContentModal({
  data,
  onClose,
}: {
  data: DetailModalData
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const isHighlight = data.tone === "highlight"
  const shouldFlattenContent = data.icon === "title" || data.icon === "description"
  const displayContent = shouldFlattenContent
    ? data.content.replace(/\s*\n+\s*/g, " ").replace(/\s{2,}/g, " ").trim()
    : data.content

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(data.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0b0b0d]/95 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.06] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="relative flex h-full flex-col">
          <div className="border-b border-white/[0.06] bg-[#111113]/90 px-5 py-4 backdrop-blur-xl sm:px-7 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex items-center gap-2">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                    isHighlight
                      ? "border-[#ffde21]/20 bg-[#ffde21]/10 text-[#ffde21]"
                      : "border-white/[0.08] bg-white/[0.04] text-white/50"
                  }`}>
                    {getDetailIcon(data.icon)}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${
                      isHighlight ? "text-[#ffde21]/75" : "text-white/35"
                    }`}>
                      {data.label}
                    </p>
                    <p className="text-[11px] text-white/25">Vista expandida del contenido</p>
                  </div>
                </div>

                <h3 className={`max-w-3xl text-lg font-semibold leading-tight sm:text-[22px] ${
                  isHighlight ? "text-[#ffde21]" : "text-white"
                }`}>
                  {data.title}
                </h3>

                <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs text-white/35">
                  {data.meta && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                      <Eye className="h-3 w-3" />
                      {data.meta}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                    <Maximize2 className="h-3 w-3" />
                    Lectura completa
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium text-white/60 transition-all hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white"
                >
                  {copied ? <Check className={`h-4 w-4 ${isHighlight ? "text-[#ffde21]" : "text-emerald-400"}`} /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
                <button
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/45 transition-all hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)] px-4 py-4 sm:px-6 sm:py-6">
            <div className={`h-full overflow-hidden rounded-[24px] border shadow-inner ${
              isHighlight
                ? "border-[#ffde21]/12 bg-[#120f03]"
                : "border-white/[0.07] bg-[#121216]"
            }`}>
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/25">
                  <span className={`h-2 w-2 rounded-full ${isHighlight ? "bg-[#ffde21]/80" : "bg-white/25"}`} />
                  {data.label}
                </div>
                <div className="text-[11px] text-white/20">Scroll para leer todo</div>
              </div>

              <div className="h-[calc(100%-53px)] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                <div className="mx-auto max-w-3xl">
                  <p className={`${shouldFlattenContent ? "whitespace-normal" : "whitespace-pre-wrap"} text-[15px] font-light leading-8 tracking-[0.01em] ${
                    isHighlight ? "text-[#ffde21]/76" : "text-white/72"
                  }`}>
                    {displayContent}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Video Row (expandable) ───────────────────────────────────────────────────

function VideoRow({ video }: { video: VideoResult }) {
  const [detailModal, setDetailModal] = useState<DetailModalData | null>(null)

  const transcriptMeta = video.transcript
    ? `${video.transcript.split(/\s+/).filter(Boolean).length.toLocaleString()} palabras`
    : "No disponible"

  const openTitleModal = () => setDetailModal({
    label: "Title",
    title: video.title,
    content: video.title,
    tone: "default",
    icon: "title",
  })

  const openDescriptionModal = () => setDetailModal({
    label: "Description",
    title: video.title,
    content: video.description || "Sin descripción",
    tone: "highlight",
    icon: "description",
  })

  const openTranscriptModal = () => setDetailModal({
    label: "Transcript",
    title: video.title,
    content: video.transcript || "Transcript no disponible.",
    tone: "highlight",
    icon: "transcript",
    meta: transcriptMeta,
  })

  const openAnalysisModal = () => setDetailModal({
    label: "Analysis",
    title: video.title,
    content: video.analysis || "Análisis no disponible.",
    tone: "highlight",
    icon: "analysis",
  })

  return (
    <>
      <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
        <td className="px-4 py-4 whitespace-nowrap">
          <span className="text-[15px] font-medium text-white/82">{video.title.split(/[-|·]/)[0].trim().slice(0, 18) || "—"}</span>
        </td>
        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
          <a href={video.video_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#ffde21] hover:text-[#ffe84d] transition-colors">
            View <ExternalLink className="h-3 w-3" />
          </a>
        </td>
        <td className="px-4 py-4 max-w-[220px]">
          <button
            type="button"
            onClick={openTitleModal}
            className="group inline-flex max-w-full items-start gap-2 text-left"
          >
            <span className="text-[14px] leading-6 text-white/68 line-clamp-2 group-hover:text-white transition-colors">{video.title}</span>
          </button>
        </td>
        <td className="px-4 py-4 max-w-[170px]">
          <button
            type="button"
            onClick={openDescriptionModal}
            className="group inline-flex max-w-full items-start gap-2 text-left"
          >
            <span className="text-[14px] leading-6 text-[#ffde21]/78 line-clamp-2 font-medium group-hover:text-[#ffde21] transition-colors">{video.description || "—"}</span>
          </button>
        </td>
        <td className="px-4 py-4 text-right whitespace-nowrap">
          <span className="text-[16px] font-bold text-[#ffde21] tabular-nums">{fmt(video.views)}</span>
        </td>
        <td className="px-4 py-4 text-center whitespace-nowrap">
          <span className="text-[14px] text-white/48 tabular-nums">{video.duration || "—"}</span>
        </td>
        <td className="px-4 py-4 max-w-[200px]">
          <button
            type="button"
            onClick={openTranscriptModal}
            className="group inline-flex max-w-full items-start gap-2 text-left"
          >
            <span className="text-[14px] leading-6 text-white/52 line-clamp-3 group-hover:text-white/72 transition-colors">
              {video.transcript ? getDetailPreview(video.transcript, 90) : "Transcript no disponible."}
            </span>
          </button>
        </td>
        <td className="px-4 py-4 max-w-[200px]">
          <button
            type="button"
            onClick={openAnalysisModal}
            className="group inline-flex max-w-full items-start gap-2 text-left"
          >
            <span className="text-[14px] leading-6 text-[#ffde21]/78 line-clamp-3 group-hover:text-[#ffde21] transition-colors">
              {video.analysis ? getDetailPreview(video.analysis, 90) : "Análisis no disponible."}
            </span>
          </button>
        </td>
        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
          <div className="w-20 h-[45px] rounded-lg overflow-hidden border border-white/[0.07] bg-white/[0.03]">
            {video.thumbnail
              ? <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
              : <div className="flex h-full items-center justify-center"><Youtube className="h-4 w-4 text-white/20" /></div>}
          </div>
        </td>
        <td className="px-3 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/20">
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
        </td>
      </tr>

      {detailModal && (
        <DetailContentModal
          data={detailModal}
          onClose={() => setDetailModal(null)}
        />
      )}
    </>
  )
}

// ─── Results Table ────────────────────────────────────────────────────────────

function ResultsTable({ videos }: { videos: VideoResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] xl:min-w-0">
        <thead>
          <tr className="border-b border-white/[0.06] bg-[#0c0c0d]/40">
            {["CREATOR", "URL", "TITLE", "DESCRIPTION", "VIEWS ↕", "DURATION", "TRANSCRIPT", "ANALYSIS", "THUMBNAIL", ""].map((h, i) => (
              <th
                key={i}
                className={`px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32 ${h === "VIEWS ↕" ? "text-right" : h === "DURATION" ? "text-center" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {videos.map(v => <VideoRow key={v.video_id} video={v} />)}
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
  const isRunning = false // All saved items are complete

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111113] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Icon */}
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border overflow-hidden ${isInstagram ? "bg-pink-500/10 border-pink-500/15" : "bg-red-500/10 border-red-500/15"}`}>
          {item.channel_avatar
            ? <img src={item.channel_avatar} alt="" className="w-full h-full object-cover" />
            : isInstagram ? <Instagram className="h-4 w-4 text-pink-400" /> : <Youtube className="h-4 w-4 text-red-400" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isInstagram ? "bg-pink-500/10 text-pink-400 border border-pink-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
              {isInstagram ? "Instagram" : "YouTube"}
            </span>
            <span className="text-sm font-semibold text-white truncate">
              {item.channel_name || ""}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
              Complete
            </span>
          </div>
          <p className="text-[11px] text-white/30 mt-0.5 tabular-nums">
            {new Date(item.created_at).toLocaleDateString("es-AR", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {" · "}Last {item.timeframe_days} days
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a href={item.channel_url} target="_blank" rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/25 hover:text-white hover:border-white/20 transition-all">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button onClick={() => onDelete(item.id)} disabled={deletingId === item.id}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/25 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/[0.08] transition-all disabled:opacity-40">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-2 h-8 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-semibold text-white/60 hover:text-white hover:border-white/20 transition-all"
          >
            View Results
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : "rotate-0"}`} />
          </button>
        </div>
      </div>

      {/* Expanded: videos table */}
      {expanded && item.videos?.length > 0 && (
        <div className="border-t border-white/[0.05] bg-[#0c0c0d]/40">
          <ResultsTable videos={item.videos} />
        </div>
      )}
      {expanded && (!item.videos || item.videos.length === 0) && (
        <div className="border-t border-white/[0.05] px-6 py-8 text-center text-sm text-white/25">
          No hay videos en este análisis.
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
    setLoading(true); setError(null)
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
      if (!res.ok) { setError(data.error ?? "Error al investigar."); return }
      setChannelUrl("")
      fetchHistory()
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado.")
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
    <div className="px-4 py-8 max-w-[1500px] mx-auto space-y-6">

      {/* ── New Analysis form ── */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
            <Search className="h-4 w-4 text-white/50" />
          </div>
          <h2 className="text-base font-bold text-white">New Analysis</h2>
        </div>

        <div className="p-6 space-y-5">
          {/* Platform + Timeframe dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-white/55 uppercase tracking-widest mb-2">Platform</label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                  {platform === "youtube" ? <Youtube className="h-4 w-4 text-red-400" /> : <Instagram className="h-4 w-4 text-pink-400" />}
                </div>
                <select value={platform} onChange={e => { setPlatform(e.target.value as any); setChannelUrl(""); setError(null) }}
                  disabled={loading}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0c0c0d] pl-10 pr-10 text-sm text-white/80 focus:border-[#ffde21]/40 focus:outline-none appearance-none cursor-pointer disabled:opacity-60">
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-white/55 uppercase tracking-widest mb-2">Timeframe</label>
              <div className="relative">
                <select value={timeframe} onChange={e => setTimeframe(Number(e.target.value) as any)}
                  disabled={loading}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0c0c0d] px-4 pr-10 text-sm text-white/80 focus:border-[#ffde21]/40 focus:outline-none appearance-none cursor-pointer disabled:opacity-60">
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
            </div>
          </div>

          {/* Competitor URL */}
          <div>
            <label className="block text-xs font-bold text-white/55 uppercase tracking-widest mb-2">Competitor URL</label>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="url"
                value={channelUrl}
                onChange={e => { setChannelUrl(e.target.value); setError(null) }}
                placeholder={platform === "youtube" ? "https://www.youtube.com/@channel" : "https://www.instagram.com/username/"}
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0c0c0d] px-4 text-sm text-white placeholder:text-white/20 focus:border-[#ffde21]/50 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/20 transition-all"
                disabled={loading}
              />
              <p className="text-xs text-white/25">One competitor profile per submission</p>
              <button type="submit" disabled={!channelUrl.trim() || loading}
                className="flex items-center gap-2 h-11 rounded-xl bg-[#ffde21] px-6 text-sm font-bold text-black hover:bg-[#ffe46b] disabled:opacity-40 transition">
                {loading
                  ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Submitting…</>
                  : "Submit"}
              </button>
            </form>
          </div>

          {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        </div>

        {loading && (
          <div className="border-t border-white/[0.05]">
            <AiLoading title="Investigando canal"
              steps={["Resolviendo canal…", "Obteniendo videos recientes…", "Analizando métricas…", "Seleccionando top 5…", "Generando análisis con IA…"]} />
          </div>
        )}
      </div>

      {/* ── Your Analyses ── */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-white px-1">Your Analyses</h2>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111113] px-6 py-14 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
              <Search className="h-5 w-5 text-white/20" />
            </div>
            <p className="text-sm text-white/30">No analyses yet. Submit a competitor URL above to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
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
