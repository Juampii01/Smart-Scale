"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  Youtube, Instagram, Copy, Check, ChevronDown, ChevronUp,
  Sparkles, Link2, Clock, User, FileText, ExternalLink, Trash2, FileVideo, X, Maximize2,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { AiLoading } from "@/components/ui/ai-loading"

// ─── Types ───────────────────────────────────────────────────────────────────

interface TranscriptResult {
  creator: string | null
  title: string | null
  thumbnail: string | null
  duration: string | null
  transcript: string
  summary: string
}

interface HistoryItem {
  id: string
  url: string
  title: string | null
  creator: string | null
  duration: string | null
  summary: string | null
  transcript: string | null
  created_at: string
}

interface TranscriptModalData {
  title: string
  transcript: string
  wordCount: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isYouTubeUrl(url: string) { return /youtube\.com|youtu\.be/.test(url) }
function isInstagramUrl(url: string) { return /instagram\.com/.test(url) }
function isInstagramReel(url: string) { return /instagram\.com\/(reel|reels)\//.test(url) }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ─── Section colors ───────────────────────────────────────────────────────────

const SECTIONS: Record<string, { icon: string; color: string; border: string; bg: string }> = {
  "RESUMEN":      { icon: "📋", color: "text-blue-300",    border: "border-blue-500/20",    bg: "bg-blue-500/[0.06]"   },
  "PUNTOS CLAVE": { icon: "🎯", color: "text-[#ffde21]",   border: "border-[#ffde21]/20",   bg: "bg-[#ffde21]/[0.05]" },
  "CONCLUSIÓN":   { icon: "✅", color: "text-emerald-300", border: "border-emerald-500/20", bg: "bg-emerald-500/[0.06]"},
}

function SummaryBlock({ text }: { text: string }) {
  const clean = text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/#{1,3}\s*/g, "").replace(/^-{3,}$/gm, "").trim()
  const sections = clean.split(/\n{2,}/).map(block => {
    const lines = block.trim().split("\n")
    const firstLine = lines[0].trim()
    const isHeader = /^[A-ZÁÉÍÓÚÑ\s]{3,50}$/.test(firstLine)
    if (isHeader && lines.length > 1) return { header: firstLine, body: lines.slice(1).join("\n").trim() }
    return { header: null, body: block.trim() }
  }).filter(s => s.body)

  if (!sections.length) return <p className="text-sm text-white/60 leading-relaxed">{clean}</p>

  return (
    <div className="grid gap-3">
      {sections.map((s, i) => {
        const cfg = s.header ? SECTIONS[s.header] : null
        return (
          <div key={i} className={`rounded-2xl border overflow-hidden ${cfg ? cfg.border : "border-white/[0.07]"}`}>
            {s.header && cfg && (
              <div className={`flex items-center gap-2.5 px-4 py-3 ${cfg.bg} border-b ${cfg.border}`}>
                <span className="text-base leading-none">{cfg.icon}</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${cfg.color}`}>{s.header}</span>
              </div>
            )}
            <div className="px-4 py-3.5 bg-white/[0.01]">
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{s.body}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CopyBtn({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/40 hover:text-white hover:border-white/20 hover:bg-white/[0.06] transition-all"
    >
      {copied ? <Check className="h-3 w-3 text-[#ffde21]" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : label}
    </button>
  )
}

function HistoryTranscript({
  transcript,
  onOpen,
}: {
  transcript: string
  onOpen: () => void
}) {
  const wordCount = transcript.split(/\s+/).filter(Boolean).length
  const preview = transcript.slice(0, 280).trim()

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-3 w-3 text-white/30" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Transcripción</p>
          <span className="text-[10px] text-white/20">{wordCount.toLocaleString()} palabras</span>
        </div>
        <div className="flex items-center gap-2">
          <CopyBtn text={transcript} label="Copiar" />
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/40 hover:text-white hover:border-white/20 transition-all"
          >
            <ExternalLink className="h-3 w-3" />
            Ver en ventana
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4">
        <p className="text-sm text-white/45 leading-[1.85] whitespace-pre-wrap font-light">{preview}{transcript.length > 280 ? "…" : ""}</p>
      </div>

      <button onClick={onOpen} className="mt-3 text-xs text-[#ffde21]/50 hover:text-[#ffde21] transition-colors">
        Abrir transcripción completa →
      </button>
    </div>
  )
}

function TranscriptModal({
  data,
  onClose,
}: {
  data: TranscriptModalData
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

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
    await navigator.clipboard.writeText(data.transcript)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl h-[90vh] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0b0b0d]/95 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.06] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="relative flex h-full flex-col">
          <div className="border-b border-white/[0.06] bg-[#111113]/90 px-5 py-4 sm:px-7 sm:py-5 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ffde21]/20 bg-[#ffde21]/10">
                    <FileText className="h-4 w-4 text-[#ffde21]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#ffde21]/70">Transcript Viewer</p>
                    <p className="text-[11px] text-white/25">Lectura completa en una vista cómoda</p>
                  </div>
                </div>

                <h3 className="max-w-3xl text-lg font-semibold leading-tight text-white sm:text-[22px]">
                  {data.title}
                </h3>

                <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs text-white/35">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                    <FileText className="h-3 w-3" />
                    {data.wordCount.toLocaleString()} palabras
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                    <Maximize2 className="h-3 w-3" />
                    Vista expandida
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopy}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium text-white/60 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white transition-all"
                >
                  {copied ? <Check className="h-4 w-4 text-[#ffde21]" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
                <button
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/45 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)] px-4 py-4 sm:px-6 sm:py-6">
            <div className="h-full overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#121216] shadow-inner">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/25">
                  <span className="h-2 w-2 rounded-full bg-[#ffde21]/80" />
                  Transcripción completa
                </div>
                <div className="text-[11px] text-white/20">Scroll para leer todo</div>
              </div>

              <div className="h-[calc(100%-53px)] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                <div className="mx-auto max-w-3xl">
                  <p className="text-[15px] leading-8 text-white/72 whitespace-pre-wrap font-light tracking-[0.01em]">
                    {data.transcript}
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

// ─── History Detail Modal ─────────────────────────────────────────────────────

function HistoryDetailModal({ item, onClose }: { item: HistoryItem; onClose: () => void }) {
  const isYT = isYouTubeUrl(item.url)
  const wordCount = item.transcript ? item.transcript.split(/\s+/).filter(Boolean).length : 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-white/[0.1] bg-[#111113] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${isYT ? "bg-red-500/10 border-red-500/15" : "bg-pink-500/10 border-pink-500/15"}`}>
              {isYT ? <Youtube className="h-4 w-4 text-red-400" /> : <Instagram className="h-4 w-4 text-pink-400" />}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-white leading-tight">{item.title ?? "Video sin título"}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {item.creator && <span className="text-xs text-white/40">{item.creator}</span>}
                {item.duration && <span className="flex items-center gap-1 text-xs text-white/30"><Clock className="h-3 w-3" />{item.duration}</span>}
                <span className="text-xs text-white/20">{formatDate(item.created_at)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/30 hover:text-white hover:border-white/20 transition-all">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/30 hover:text-white hover:border-white/20 transition-all">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {item.summary && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3 w-3 text-[#ffde21]/60" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#ffde21]/50">Análisis IA</p>
                <button onClick={() => navigator.clipboard.writeText(item.summary!)}
                  className="ml-auto inline-flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors">
                  <Copy className="h-3 w-3" /> Copiar
                </button>
              </div>
              <SummaryBlock text={item.summary} />
            </div>
          )}
          {item.transcript && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-3 w-3 text-white/30" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Transcripción</p>
                <span className="text-[10px] text-white/20">{wordCount.toLocaleString()} palabras</span>
                <button onClick={() => navigator.clipboard.writeText(item.transcript!)}
                  className="ml-auto inline-flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors">
                  <Copy className="h-3 w-3" /> Copiar
                </button>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-4">
                <p className="text-sm text-white/60 leading-[1.85] whitespace-pre-wrap font-light">{item.transcript}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function TranscriptView() {
  const [url, setUrl] = useState("")
  const [outputType, setOutputType] = useState<"transcript" | "summary" | "both">("both")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TranscriptResult | null>(null)
  const [transcriptModal, setTranscriptModal] = useState<TranscriptModalData | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [modalItem, setModalItem] = useState<HistoryItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isYT = isYouTubeUrl(url)
  const isIG = isInstagramUrl(url)
  const isIGReel = isInstagramReel(url)
  const isIGNonReel = isIG && !isIGReel
  const detectedPlatform = isYT ? "youtube" : isIG ? "instagram" : null

  const fetchHistory = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch("/api/transcript", { headers: { "Authorization": `Bearer ${session.access_token}` } })
      if (!res.ok) return
      const data = await res.json()
      setHistory(data.items ?? [])
    } catch { } finally { setHistoryLoading(false) }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || loading) return
    setLoading(true); setError(null); setResult(null); setTranscriptModal(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sesión expirada."); return }
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Error al procesar el video."); return }
      setResult(data)
      setUrl("")
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
      await fetch("/api/transcript", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ id }),
      })
      setHistory(prev => prev.filter(item => item.id !== id))
      if (modalItem?.id === id) setModalItem(null)
    } finally { setDeletingId(null) }
  }

  const wordCount = result ? result.transcript.split(/\s+/).filter(Boolean).length : 0

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── New Transcription form ── */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
            <FileVideo className="h-4 w-4 text-white/50" />
          </div>
          <h2 className="text-sm font-semibold text-white">Nueva Transcripción</h2>
        </div>

        <div className="p-6 space-y-5">
          {/* Platform + Output type row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Platform (auto-detected) */}
            <div>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Plataforma</label>
              <div className={`flex h-11 items-center gap-2.5 rounded-xl border px-4 text-sm
                ${detectedPlatform === "youtube" ? "border-red-500/30 bg-red-500/[0.06] text-red-300"
                : detectedPlatform === "instagram" ? "border-pink-500/30 bg-pink-500/[0.06] text-pink-300"
                : "border-white/[0.08] bg-white/[0.03] text-white/30"}`}>
                {detectedPlatform === "youtube"
                  ? <Youtube className="h-4 w-4" />
                  : detectedPlatform === "instagram"
                    ? <Instagram className="h-4 w-4" />
                    : <Link2 className="h-4 w-4" />}
                <span className="font-medium">
                  {detectedPlatform === "youtube" ? "YouTube"
                    : detectedPlatform === "instagram" ? "Instagram"
                    : "Pegá un link…"}
                </span>
              </div>
            </div>

            {/* Output type */}
            <div>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Tipo de Salida</label>
              <select
                value={outputType}
                onChange={e => setOutputType(e.target.value as any)}
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0c0c0d] px-4 text-sm text-white/70 focus:border-[#ffde21]/40 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="both">Transcript + Resumen IA</option>
                <option value="transcript">Solo transcript</option>
                <option value="summary">Solo resumen IA</option>
              </select>
            </div>
          </div>

          {/* URL input */}
          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
              URL del Video / Reel
            </label>
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={e => { setUrl(e.target.value); setError(null); setResult(null) }}
                placeholder="https://youtube.com/watch?v=... o https://instagram.com/reel/..."
                className={`h-11 flex-1 rounded-xl border px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 transition-all bg-[#0c0c0d] ${
                  isIGNonReel
                    ? "border-orange-500/40 focus:border-orange-500/60 focus:ring-orange-500/15"
                    : "border-white/[0.08] focus:border-[#ffde21]/40 focus:ring-[#ffde21]/15"
                }`}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!url.trim() || loading || (!isYT && !isIG)}
                className="h-11 rounded-xl px-6 text-sm font-bold transition shrink-0 bg-[#ffde21] text-black hover:bg-[#ffe46b] disabled:bg-white/[0.07] disabled:text-white/25 disabled:cursor-not-allowed"
              >
                {loading ? "Procesando…" : "Transcribir"}
              </button>
            </form>

            {isIGReel && (
              <p className="mt-2 text-xs text-white/25">Solo reels públicos con audio. El proceso puede tardar hasta 2 minutos.</p>
            )}
            {url.trim() && !isYT && !isIG && (
              <p className="mt-2 text-xs text-red-400/70">Solo se aceptan links de YouTube o Instagram.</p>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
          )}
        </div>

        {loading && (
          <div className="border-t border-white/[0.05]">
            <AiLoading
              title="Transcribiendo video…"
              steps={["Conectando con la plataforma…", "Obteniendo subtítulos…", "Procesando audio…", "Generando resumen con IA…", "Casi listo…"]}
            />
          </div>
        )}
      </div>

      {/* ── Result ── */}
      {result && (
        <div className="space-y-4">
          {/* Meta card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
            <div className="h-[2px] w-full bg-gradient-to-r from-red-500/0 via-red-500/50 to-red-500/0" />
            <div className="px-6 py-5 flex flex-wrap items-center gap-5 justify-between">
              <button
                onClick={() => setResult(null)}
                className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/25 hover:text-white/60 hover:border-white/20 transition-all"
                title="Cerrar"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex-shrink-0 w-28 h-16 rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.03]">
                  {result.thumbnail
                    ? <img src={result.thumbnail} alt={result.title ?? ""} className="w-full h-full object-cover" />
                    : <div className="flex h-full items-center justify-center"><Youtube className="h-5 w-5 text-red-400/40" /></div>}
                </div>
                <div className="min-w-0">
                  {result.title && <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{result.title}</p>}
                  {result.creator && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <User className="h-3 w-3 text-white/30" />
                      <p className="text-xs text-white/40">{result.creator}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {result.duration && (
                  <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                    <Clock className="h-3 w-3 text-white/30" />
                    <span className="text-sm font-bold text-white tabular-nums">{result.duration}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                  <FileText className="h-3 w-3 text-white/30" />
                  <span className="text-sm font-bold text-white tabular-nums">{wordCount.toLocaleString()}</span>
                  <span className="text-xs text-white/30">palabras</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          {(outputType === "summary" || outputType === "both") && (
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
              <div className="flex items-center gap-3 border-b border-white/[0.05] px-6 py-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffde21]/10 border border-[#ffde21]/20">
                  <Sparkles className="h-3.5 w-3.5 text-[#ffde21]" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#ffde21]/80">Análisis IA</p>
                  <p className="text-[10px] text-white/25 mt-0.5">Generado por Claude · basado en la transcripción</p>
                </div>
              </div>
              <div className="p-6"><SummaryBlock text={result.summary} /></div>
            </div>
          )}

          {/* Transcript */}
          {(outputType === "transcript" || outputType === "both") && (
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
              <div className="flex items-center justify-between border-b border-white/[0.05] px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08]">
                    <FileText className="h-3.5 w-3.5 text-white/40" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-white/40">Transcripción completa</p>
                    <p className="text-[10px] text-white/20 mt-0.5">{wordCount.toLocaleString()} palabras</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CopyBtn text={result.transcript} label="Copiar texto" />
                  <button
                    onClick={() => setTranscriptModal({
                      title: result.title ?? "Transcripción",
                      transcript: result.transcript,
                      wordCount,
                    })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/40 hover:text-white hover:border-white/20 hover:bg-white/[0.06] transition-all"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver en ventana
                  </button>
                </div>
              </div>
              <div className="px-6 py-5">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4">
                  <p className="text-sm text-white/45 leading-[1.85] whitespace-pre-wrap font-light">
                    {result.transcript.slice(0, 420).trim()}
                    {result.transcript.length > 420 ? "…" : ""}
                  </p>
                </div>
                <button
                  onClick={() => setTranscriptModal({
                    title: result.title ?? "Transcripción",
                    transcript: result.transcript,
                    wordCount,
                  })}
                  className="mt-3 text-xs text-[#ffde21]/60 hover:text-[#ffde21] transition-colors"
                >
                  Abrir transcripción completa →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Your Transcriptions ── */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
          <h2 className="text-sm font-semibold text-white">Your Transcriptions</h2>
          {history.length > 0 && (
            <span className="text-[10px] text-white/25">{history.length} registros</span>
          )}
        </div>

        {historyLoading ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-white/25">Cargando…</p>
          </div>
        ) : history.length === 0 ? (
          <div className="px-6 py-14 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
              <FileText className="h-5 w-5 text-white/20" />
            </div>
            <p className="text-sm text-white/30">No transcriptions yet. Submit a URL above to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {history.map(item => {
              const isExpanded = expandedHistoryId === item.id
              const isYT = isYouTubeUrl(item.url)
              return (
                <div key={item.id}>
                  {/* Row */}
                  <div
                    className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${isYT ? "bg-red-500/10 border-red-500/15" : "bg-pink-500/10 border-pink-500/15"}`}>
                      {isYT
                        ? <Youtube className="h-3.5 w-3.5 text-red-400" />
                        : <Instagram className="h-3.5 w-3.5 text-pink-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{item.title ?? "Video sin título"}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {item.creator && <span className="text-xs text-white/35">{item.creator}</span>}
                        {item.duration && <span className="flex items-center gap-1 text-xs text-white/25"><Clock className="h-2.5 w-2.5" />{item.duration}</span>}
                        <span className="text-xs text-white/20">{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/25 hover:text-white hover:border-white/20 transition-all">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
                        disabled={deletingId === item.id}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-white/25 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/[0.08] transition-all disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-white/25" /> : <ChevronDown className="h-4 w-4 text-white/25" />}
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.04] bg-white/[0.01] divide-y divide-white/[0.04]">
                      {item.summary && (
                        <div className="px-6 py-5">
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="h-3 w-3 text-[#ffde21]/60" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#ffde21]/50">Análisis IA</p>
                          </div>
                          <SummaryBlock text={item.summary} />
                        </div>
                      )}
                      {item.transcript && (
                        <HistoryTranscript
                          transcript={item.transcript}
                          onOpen={() => setTranscriptModal({
                            title: item.title ?? "Transcripción",
                            transcript: item.transcript!,
                            wordCount: item.transcript!.split(/\s+/).filter(Boolean).length,
                          })}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {transcriptModal && (
        <TranscriptModal
          data={transcriptModal}
          onClose={() => setTranscriptModal(null)}
        />
      )}
    </div>
  )
}
