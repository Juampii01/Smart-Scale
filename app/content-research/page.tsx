"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { AiLoading } from "@/components/ui/ai-loading"
import {
  Youtube, ExternalLink, Copy, Check, ChevronDown, ChevronUp,
  Sparkles, Trash2, History, Globe, Clock, Eye, ThumbsUp, MessageCircle,
} from "lucide-react"
import { createPortal } from "react-dom"

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
  analysis: string
}

interface ResearchResult {
  channelName: string
  channelAvatar: string | null
  channelUrl: string
  timeframe_days: number
  videos: VideoResult[]
}

interface HistoryItem {
  id: string
  channel_url: string
  channel_name: string
  timeframe_days: number
  videos: VideoResult[]
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function CopyBtn({ text }: { text: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!text) return <span className="text-white/20 text-xs">—</span>
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-[#ffde21] transition-colors"
    >
      <span className="max-w-[140px] truncate text-white/50">{text.slice(0, 60)}{text.length > 60 ? "…" : ""}</span>
      {copied ? <Check className="h-3 w-3 text-emerald-400 flex-shrink-0" /> : <Copy className="h-3 w-3 flex-shrink-0" />}
    </button>
  )
}

// ─── Video Table Row ──────────────────────────────────────────────────────────

function VideoRow({ video, rank }: { video: VideoResult; rank: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer ${expanded ? "bg-white/[0.02]" : ""}`}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Rank */}
        <td className="px-4 py-3 whitespace-nowrap w-8">
          <span className="text-xs font-bold text-white/20 tabular-nums">#{rank}</span>
        </td>

        {/* Thumbnail */}
        <td className="px-4 py-3 w-24" onClick={e => e.stopPropagation()}>
          <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="block group">
            <div className="relative w-20 h-[45px] rounded-lg overflow-hidden border border-white/[0.07] bg-white/[0.03] flex-shrink-0">
              {video.thumbnail
                ? <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                : <div className="flex h-full items-center justify-center"><Youtube className="h-4 w-4 text-white/20" /></div>
              }
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                <ExternalLink className="h-3 w-3 text-white" />
              </div>
            </div>
          </a>
        </td>

        {/* Title */}
        <td className="px-4 py-3 max-w-[220px]">
          <p className="text-sm font-medium text-white/80 leading-snug line-clamp-2">{video.title}</p>
          {video.published_at && (
            <p className="text-[10px] text-white/25 mt-0.5 tabular-nums">
              {new Date(video.published_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </td>

        {/* Views */}
        <td className="px-4 py-3 whitespace-nowrap text-right">
          <span className="text-sm font-bold text-white tabular-nums">{fmt(video.views)}</span>
        </td>

        {/* Duration */}
        <td className="px-4 py-3 whitespace-nowrap text-center">
          <span className="text-xs text-white/40 tabular-nums">{video.duration}</span>
        </td>

        {/* Likes */}
        <td className="px-4 py-3 whitespace-nowrap text-right">
          <span className="text-sm text-white/60 tabular-nums">{fmt(video.likes)}</span>
        </td>

        {/* Comments */}
        <td className="px-4 py-3 whitespace-nowrap text-right">
          <span className="text-sm text-white/60 tabular-nums">{fmt(video.comments)}</span>
        </td>

        {/* Analysis preview */}
        <td className="px-4 py-3 max-w-[200px]" onClick={e => e.stopPropagation()}>
          <CopyBtn text={video.analysis} />
        </td>

        {/* Expand */}
        <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setExpanded(v => !v)}
            className="rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-all"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </td>
      </tr>

      {/* Expanded panel */}
      {expanded && (
        <tr className="border-b border-white/[0.06] bg-[#0c0c0d]/60">
          <td colSpan={9} className="px-5 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left: thumbnail big + description */}
              <div className="space-y-4">
                <div className="flex gap-4">
                  {video.thumbnail && (
                    <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 group">
                      <div className="relative w-32 h-[72px] rounded-xl overflow-hidden border border-white/[0.07]">
                        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                          <ExternalLink className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </a>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white leading-snug">{video.title}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-white/40"><Eye className="h-3 w-3" />{fmt(video.views)}</span>
                      <span className="flex items-center gap-1 text-xs text-white/40"><ThumbsUp className="h-3 w-3" />{fmt(video.likes)}</span>
                      <span className="flex items-center gap-1 text-xs text-white/40"><MessageCircle className="h-3 w-3" />{fmt(video.comments)}</span>
                      <span className="flex items-center gap-1 text-xs text-white/40"><Clock className="h-3 w-3" />{video.duration}</span>
                    </div>
                  </div>
                </div>
                {video.description && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">Descripción</p>
                    <p className="text-xs text-white/55 leading-relaxed">{video.description}</p>
                  </div>
                )}
              </div>

              {/* Right: analysis */}
              {video.analysis && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/50">Análisis IA</p>
                    <Sparkles className="h-3 w-3 text-[#ffde21]/30" />
                    <button
                      onClick={() => navigator.clipboard.writeText(video.analysis)}
                      className="ml-auto inline-flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors"
                    >
                      <Copy className="h-3 w-3" /> Copiar
                    </button>
                  </div>
                  <div className="rounded-xl border border-[#ffde21]/10 bg-[#ffde21]/[0.03] px-4 py-3">
                    <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{video.analysis}</p>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Results Table ────────────────────────────────────────────────────────────

function ResultsTable({ result }: { result: ResearchResult }) {
  const totalViews = result.videos.reduce((s, v) => s + v.views, 0)
  const totalLikes = result.videos.reduce((s, v) => s + v.likes, 0)
  const totalComments = result.videos.reduce((s, v) => s + v.comments, 0)

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
      {/* Channel header */}
      <div className="flex items-center gap-4 border-b border-white/[0.06] px-6 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 overflow-hidden">
          {result.channelAvatar
            ? <img src={result.channelAvatar} alt={result.channelName} className="w-full h-full object-cover" />
            : <Youtube className="h-5 w-5 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{result.channelName}</p>
            <a href={result.channelUrl} target="_blank" rel="noopener noreferrer"
              className="text-white/30 hover:text-[#ffde21] transition-colors flex-shrink-0">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="text-xs text-white/35 mt-0.5">Top {result.videos.length} videos · Últimos {result.timeframe_days} días</p>
        </div>
        {/* Summary stats */}
        <div className="hidden sm:flex items-center gap-4">
          {[
            { icon: Eye, label: "Views", value: fmt(totalViews) },
            { icon: ThumbsUp, label: "Likes", value: fmt(totalLikes) },
            { icon: MessageCircle, label: "Comentarios", value: fmt(totalComments) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="text-center">
              <p className="text-[10px] text-white/25 uppercase tracking-widest flex items-center gap-1"><Icon className="h-2.5 w-2.5" />{label}</p>
              <p className="text-sm font-bold text-white tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["#", "THUMB", "TÍTULO", "VIEWS", "DURACIÓN", "LIKES", "COMENT.", "ANÁLISIS", ""].map((h, i) => (
                <th key={i} className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 ${i >= 3 && i <= 6 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.videos.map((v, i) => (
              <VideoRow key={v.video_id} video={v} rank={i + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── History Section ──────────────────────────────────────────────────────────

function HistorySection({ items, onSelect, onDelete }: {
  items: HistoryItem[]
  onSelect: (item: HistoryItem) => void
  onDelete: (id: string) => void
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
      onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  if (!items.length) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-[2px] rounded-full bg-[#ffde21]/60" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50">Investigaciones anteriores</h2>
        </div>
        <span className="text-[10px] text-white/25 tabular-nums">{items.length} registros</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-white/[0.015] transition-colors group">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/15">
              <Youtube className="h-3.5 w-3.5 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/80 truncate">{item.channel_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-white/30">Últimos {item.timeframe_days} días</span>
                <span className="text-white/15">·</span>
                <span className="text-[11px] text-white/25">{item.videos?.length ?? 0} videos</span>
                <span className="text-white/15">·</span>
                <span className="text-[11px] text-white/20 tabular-nums">
                  {new Date(item.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onSelect(item)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/50 hover:border-[#ffde21]/30 hover:text-[#ffde21] transition-colors"
              >
                Ver análisis
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] text-white/25 hover:border-red-500/30 hover:bg-red-500/[0.08] hover:text-red-400 transition-all disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ContentResearchContent() {
  const [channelUrl, setChannelUrl] = useState("")
  const [timeframe, setTimeframe] = useState<30 | 60 | 90>(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResearchResult | null>(null)

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const resultsRef = useRef<HTMLDivElement>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch("/api/content-research", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setHistory(data.items ?? [])
    } catch {} finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!channelUrl.trim() || loading) return
    setLoading(true); setError(null); setResult(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sesión expirada."); return }
      const res = await fetch("/api/content-research", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ channel_url: channelUrl.trim(), timeframe_days: timeframe }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Error al investigar el canal."); return }
      setResult(data)
      fetchHistory()
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80)
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectHistory = (item: HistoryItem) => {
    setResult({ channelName: item.channel_name, channelAvatar: null, channelUrl: item.channel_url, timeframe_days: item.timeframe_days, videos: item.videos ?? [] })
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80)
  }

  return (
    <div className="px-4 py-10 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Smart Scale · IA 1.0</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Content Research</h1>
        <p className="text-sm text-white/40">Analizá los top 5 videos de cualquier canal de YouTube por métricas reales.</p>
      </div>

      {/* Form */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
        <div className="h-[2px] w-full bg-gradient-to-r from-[#ffde21]/0 via-[#ffde21]/50 to-[#ffde21]/0" />
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* URL input */}
              <div className="relative flex-1">
                <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                  <Youtube className="h-4 w-4 text-red-400" />
                </div>
                <input
                  type="url"
                  value={channelUrl}
                  onChange={e => { setChannelUrl(e.target.value); setError(null) }}
                  placeholder="https://youtube.com/@canal"
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/15 transition-all"
                  disabled={loading}
                />
              </div>

              {/* Timeframe */}
              <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden shrink-0">
                {([30, 60, 90] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeframe(t)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${timeframe === t ? "bg-[#ffde21] text-black" : "text-white/40 hover:text-white/70"}`}
                  >
                    {t}d
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={!channelUrl.trim() || loading}
                className="h-11 rounded-xl bg-[#ffde21] px-6 text-sm font-bold text-black hover:bg-[#ffe46b] disabled:opacity-40 transition shrink-0"
              >
                {loading ? "Investigando…" : "Investigar"}
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
            )}
          </form>
        </div>

        {loading && (
          <div className="border-t border-white/[0.05]">
            <AiLoading
              title="Investigando canal de YouTube"
              steps={[
                "Resolviendo canal…",
                "Obteniendo videos recientes…",
                "Analizando métricas…",
                "Seleccionando top 5…",
                "Generando análisis con IA…",
                "Casi listo…",
              ]}
            />
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div ref={resultsRef}>
          <ResultsTable result={result} />
        </div>
      )}

      {/* History */}
      {!historyLoading && history.length > 0 && (
        <HistorySection
          items={history}
          onSelect={handleSelectHistory}
          onDelete={id => setHistory(prev => prev.filter(i => i.id !== id))}
        />
      )}
    </div>
  )
}

export default function ContentResearchPage() {
  return (
    <DashboardLayout>
      <ContentResearchContent />
    </DashboardLayout>
  )
}
