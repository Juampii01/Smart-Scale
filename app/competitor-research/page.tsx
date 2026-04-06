"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { AiLoading } from "@/components/ui/ai-loading"
import {
  Youtube, Instagram, ExternalLink, Copy, Check, ChevronDown, ChevronUp,
  Sparkles, Trash2, Eye, ThumbsUp, MessageCircle, Clock, Search,
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

function CopyBtn({ text }: { text: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!text) return <span className="text-white/20 text-xs">—</span>
  return (
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="inline-flex items-start gap-1.5 text-left text-xs text-white/50 hover:text-white/80 transition-colors group"
    >
      <span className="max-w-[150px] leading-relaxed line-clamp-3 group-hover:text-white/70">
        {text.slice(0, 100)}{text.length > 100 ? "…" : ""}
      </span>
      {copied
        ? <Check className="h-3 w-3 text-emerald-400 flex-shrink-0 mt-0.5" />
        : <Copy className="h-3 w-3 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60" />}
    </button>
  )
}

// ─── Video Row (expandable) ───────────────────────────────────────────────────

function VideoRow({ video }: { video: VideoResult }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <tr
        className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer ${expanded ? "bg-white/[0.02]" : ""}`}
        onClick={() => setExpanded(v => !v)}
      >
        <td className="px-4 py-3.5 whitespace-nowrap">
          <span className="text-sm font-medium text-white/75">{video.title.split(/[-|·]/)[0].trim().slice(0, 18) || "—"}</span>
        </td>
        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
          <a href={video.video_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#ffde21] hover:text-[#ffe84d] transition-colors">
            View <ExternalLink className="h-3 w-3" />
          </a>
        </td>
        <td className="px-4 py-3.5 max-w-[200px]">
          <span className="text-xs text-white/55 line-clamp-2">{video.title}</span>
        </td>
        <td className="px-4 py-3.5 max-w-[140px]">
          <span className="text-xs text-white/30 line-clamp-2">{video.description || "—"}</span>
        </td>
        <td className="px-4 py-3.5 text-right whitespace-nowrap">
          <span className="text-sm font-semibold text-white tabular-nums">{fmt(video.views)}</span>
        </td>
        <td className="px-4 py-3.5 text-center whitespace-nowrap">
          <span className="text-xs text-white/40 tabular-nums">{video.duration || "—"}</span>
        </td>
        <td className="px-4 py-3.5 max-w-[180px]" onClick={e => e.stopPropagation()}>
          <CopyBtn text={video.transcript || null} />
        </td>
        <td className="px-4 py-3.5 max-w-[180px]" onClick={e => e.stopPropagation()}>
          <CopyBtn text={video.analysis || null} />
        </td>
        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
          <div className="w-20 h-[45px] rounded-lg overflow-hidden border border-white/[0.07] bg-white/[0.03]">
            {video.thumbnail
              ? <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
              : <div className="flex h-full items-center justify-center"><Youtube className="h-4 w-4 text-white/20" /></div>}
          </div>
        </td>
        <td className="px-3 py-3.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => setExpanded(v => !v)}
            className="rounded-lg p-1.5 text-white/25 hover:bg-white/[0.06] hover:text-white/60 transition-all">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/[0.06] bg-[#0c0c0d]/60">
          <td colSpan={10} className="px-6 py-5">
            <div className="space-y-5">
              <div className="flex gap-4">
                {video.thumbnail && (
                  <div className="w-36 h-20 rounded-xl overflow-hidden border border-white/[0.07] flex-shrink-0">
                    <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{video.title}</p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-white/40"><Eye className="h-3 w-3" />{fmt(video.views)}</span>
                    <span className="flex items-center gap-1 text-xs text-white/40"><ThumbsUp className="h-3 w-3" />{fmt(video.likes)}</span>
                    <span className="flex items-center gap-1 text-xs text-white/40"><MessageCircle className="h-3 w-3" />{fmt(video.comments)}</span>
                    <span className="flex items-center gap-1 text-xs text-white/40"><Clock className="h-3 w-3" />{video.duration}</span>
                  </div>
                  <a href={video.video_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-[11px] text-[#ffde21]/60 hover:text-[#ffde21] transition-colors">
                    <ExternalLink className="h-3 w-3" /> Ver video
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Transcript</p>
                    {video.transcript && (
                      <button onClick={() => navigator.clipboard.writeText(video.transcript!)}
                        className="ml-auto inline-flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50">
                        <Copy className="h-3 w-3" /> Copiar
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 max-h-48 overflow-y-auto">
                    {video.transcript
                      ? <p className="text-xs text-white/55 leading-relaxed whitespace-pre-wrap">{video.transcript}</p>
                      : <p className="text-xs text-white/25 italic">Transcript no disponible.</p>}
                  </div>
                </div>
                {video.analysis && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="h-3 w-3 text-[#ffde21]/30" />
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/50">Análisis IA</p>
                      <button onClick={() => navigator.clipboard.writeText(video.analysis)}
                        className="ml-auto inline-flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50">
                        <Copy className="h-3 w-3" /> Copiar
                      </button>
                    </div>
                    <div className="rounded-xl border border-[#ffde21]/10 bg-[#ffde21]/[0.03] px-4 py-3 max-h-48 overflow-y-auto">
                      <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{video.analysis}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Results Table ────────────────────────────────────────────────────────────

function ResultsTable({ videos }: { videos: VideoResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px]">
        <thead>
          <tr className="border-b border-white/[0.06] bg-[#0c0c0d]/40">
            {["CREATOR", "URL", "TITLE", "DESCRIPTION", "VIEWS ↕", "DURATION", "TRANSCRIPT", "ANALYSIS", "THUMBNAIL", ""].map((h, i) => (
              <th key={i} className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/25 ${h === "VIEWS ↕" ? "text-right" : h === "DURATION" ? "text-center" : "text-left"}`}>
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
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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
    <div className="px-4 py-8 max-w-5xl mx-auto space-y-6">

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
