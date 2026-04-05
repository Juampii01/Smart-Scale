"use client"

import { useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  Plus, ExternalLink, Copy, Check, Trash2, ChevronDown, ChevronUp,
  Search, TrendingUp, X, AlertTriangle, Users, Sparkles, Loader2,
  Instagram, Youtube, Link2
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { useRouter } from "next/navigation"
import { AiLoading } from "@/components/ui/ai-loading"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Post {
  id: string
  creator: string
  post_url: string | null
  description: string | null
  views: number | null
  duration: string | null
  likes: number | null
  comments: number | null
  transcript: string | null
  analysis: string | null
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function truncate(str: string | null, len = 80): string {
  if (!str) return "—"
  return str.length > len ? str.slice(0, len) + "…" : str
}

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!text) return <span className="text-white/20">—</span>
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-[#ffde21] transition-colors group"
    >
      <span className="text-white/50 group-hover:text-white/70 text-[11px] leading-tight max-w-[160px] truncate">
        {truncate(text, 60)}
      </span>
      {copied
        ? <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
        : <Copy className="h-3.5 w-3.5 flex-shrink-0" />
      }
    </button>
  )
}

// ─── Add Post Modal ───────────────────────────────────────────────────────────

interface AddModalProps {
  clientId: string
  onClose: () => void
  onSaved: (post: Post) => void
}

interface ResearchResult {
  platform: "instagram" | "youtube"
  creator: string | null
  post_url: string
  description: string | null
  views: number | null
  likes: number | null
  comments: number | null
  duration: string | null
  transcript: string | null
  analysis: string | null
}

function AddPostModal({ clientId, onClose, onSaved }: AddModalProps) {
  const [urlInput, setUrlInput] = useState("")
  const [researching, setResearching] = useState(false)
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [researchErr, setResearchErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const isInstagram = urlInput.includes("instagram.com") || result?.platform === "instagram"
  const isYouTube   = urlInput.includes("youtube.com") || urlInput.includes("youtu.be") || result?.platform === "youtube"

  async function handleResearch() {
    if (!urlInput.trim()) return
    setResearching(true); setResearchErr(null); setResult(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch("/api/competitor-research/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Error investigando")
      setResult(json)
    } catch (e: any) {
      setResearchErr(e?.message ?? "Error investigando")
    } finally {
      setResearching(false)
    }
  }

  async function handleSave() {
    if (!result) return
    setSaving(true); setSaveErr(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch("/api/competitor-research", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          client_id:   clientId,
          creator:     result.creator,
          post_url:    result.post_url,
          description: result.description,
          views:       result.views,
          duration:    result.duration,
          likes:       result.likes,
          comments:    result.comments,
          transcript:  result.transcript,
          analysis:    result.analysis,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Error guardando")
      onSaved(json.post)
      onClose()
    } catch (e: any) {
      setSaveErr(e?.message ?? "Error guardando")
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full rounded-xl border border-white/[0.08] bg-[#0c0c0d] px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffde21]/50 focus:ring-1 focus:ring-[#ffde21]/20 transition-all"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#111113] shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#111113] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/80">Investigar Post</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* URL input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2">
                {isInstagram ? <Instagram className="h-4 w-4 text-pink-400" />
                  : isYouTube ? <Youtube className="h-4 w-4 text-red-400" />
                  : <Link2 className="h-4 w-4 text-white/25" />}
              </span>
              <input
                className={inputCls + " pl-10"}
                placeholder="https://www.instagram.com/reel/..."
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setResult(null); setResearchErr(null) }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleResearch() } }}
                disabled={researching}
              />
            </div>
            <button
              type="button"
              onClick={handleResearch}
              disabled={!urlInput.trim() || researching}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {researching
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Investigando…</>
                : <><Sparkles className="h-4 w-4" /> Investigar</>}
            </button>
          </div>

          {/* Loading */}
          {researching && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <AiLoading
                title="Investigando contenido"
                steps={[
                  "Conectando con Instagram…",
                  "Obteniendo métricas…",
                  "Transcribiendo audio del video…",
                  "Generando análisis con IA…",
                  "Casi listo…",
                ]}
              />
            </div>
          )}

          {/* Error */}
          {researchErr && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{researchErr}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Success header */}
              <div className="flex items-center gap-2.5 rounded-xl border border-[#ffde21]/20 bg-[#ffde21]/[0.06] px-4 py-3">
                <Sparkles className="h-4 w-4 text-[#ffde21] flex-shrink-0" />
                <p className="text-sm font-medium text-[#ffde21]">
                  Investigación completa — {result.platform === "instagram" ? "Instagram" : "YouTube"}
                </p>
              </div>

              {/* Creator + metrics row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Creador",   value: result.creator   ? `@${result.creator}` : "—" },
                  { label: "Views",     value: result.views     != null ? fmt(result.views)    : "—" },
                  { label: "Likes",     value: result.likes     != null ? fmt(result.likes)    : "—" },
                  { label: "Comments",  value: result.comments  != null ? fmt(result.comments) : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{label}</p>
                    <p className="text-sm font-semibold text-white mt-0.5 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              {result.description && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1.5">Descripción</p>
                  <p className="text-xs text-white/60 leading-relaxed line-clamp-4">{result.description}</p>
                </div>
              )}

              {/* Transcript */}
              {result.transcript && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/60 mb-1.5">Transcript</p>
                  <p className="text-xs text-white/50 leading-relaxed line-clamp-5">{result.transcript}</p>
                </div>
              )}

              {/* Analysis */}
              {result.analysis && (
                <div className="rounded-xl border border-[#ffde21]/10 bg-[#ffde21]/[0.03] px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffde21]/60">Análisis IA</p>
                    <Sparkles className="h-3 w-3 text-[#ffde21]/40" />
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{result.analysis}</p>
                </div>
              )}

              {/* Save error */}
              {saveErr && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-400">{saveErr}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-[#ffde21] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Guardando…" : "Guardar Post"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Confirm Delete ───────────────────────────────────────────────────────────

function ConfirmDeleteDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#111113] p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-5">
          <span className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
            <Trash2 className="h-4 w-4 text-red-400" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">¿Eliminar este post?</h3>
            <p className="text-xs text-white/40 mt-1">Esta acción no se puede deshacer.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-red-500/20 border border-red-500/30 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition-all">
            Eliminar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Table Row ────────────────────────────────────────────────────────────────

interface RowProps {
  post: Post
  isAdmin: boolean
  onDelete: (id: string) => void
}

const SECTION_ICONS: Record<string, string> = {
  "TEMA PRINCIPAL": "🎯",
  "HOOK": "🪝",
  "ESTRUCTURA": "📐",
  "MENSAJE CLAVE": "💡",
  "POR QUÉ FUNCIONA": "⚡",
}

function AnalysisBlock({ text }: { text: string }) {
  // Strip any remaining markdown symbols
  const clean = text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/#{1,3}\s*/g, "")
    .replace(/^-{3,}$/gm, "")
    .trim()

  const sections = clean.split(/\n{2,}/).map(block => {
    const lines = block.trim().split("\n")
    const firstLine = lines[0].trim()
    const isHeader = /^[A-ZÁÉÍÓÚÑ\s]{4,50}$/.test(firstLine)
    if (isHeader && lines.length > 1) {
      return { header: firstLine, body: lines.slice(1).join("\n").trim() }
    }
    return { header: null, body: block.trim() }
  }).filter(s => s.body)

  if (sections.length === 0) {
    return <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{clean}</p>
  }

  return (
    <div className="space-y-2">
      {sections.map((s, i) => {
        const icon = s.header ? (SECTION_ICONS[s.header] ?? "▸") : null
        return (
          <div key={i} className="rounded-xl overflow-hidden border border-white/[0.05]">
            {s.header && (
              <div className="flex items-center gap-2 bg-[#ffde21]/[0.06] border-b border-white/[0.04] px-3 py-2">
                {icon && <span className="text-sm">{icon}</span>}
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#ffde21]/70">{s.header}</p>
              </div>
            )}
            <div className="px-3 py-2.5 bg-white/[0.01]">
              <p className="text-xs text-white/65 leading-relaxed">{s.body}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PostRow({ post, isAdmin, onDelete }: RowProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      {confirmDelete && (
        <ConfirmDeleteDialog
          onConfirm={() => { onDelete(post.id); setConfirmDelete(false) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      <div className={`rounded-2xl border transition-all duration-200 bg-[#111113] ${expanded ? "border-[#ffde21]/20" : "border-white/[0.07]"}`}>
        {/* Card header — always visible */}
        <div
          className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-2xl"
          onClick={() => setExpanded(v => !v)}
        >
          <div className="flex items-center gap-4 min-w-0">
            {/* Creator */}
            <p className="text-base font-semibold text-white whitespace-nowrap">{post.creator}</p>

            {/* Metrics */}
            <div className="hidden sm:flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-sm text-white/60">
                <TrendingUp className="h-3.5 w-3.5 text-[#ffde21]/50" />
                <span className="font-semibold text-white">{fmt(post.views)}</span>
                <span className="text-white/30">views</span>
              </span>
              {post.likes != null && (
                <span className="text-sm text-white/40">{fmt(post.likes)} likes</span>
              )}
              {post.comments != null && (
                <span className="text-sm text-white/40">{fmt(post.comments)} comentarios</span>
              )}
              {post.duration && (
                <span className="rounded-lg bg-white/[0.06] px-2 py-0.5 text-xs text-white/40 tabular-nums">{post.duration}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-4" onClick={e => e.stopPropagation()}>
            {post.post_url && (
              <a href={post.post_url} target="_blank" rel="noopener noreferrer"
                className="rounded-lg p-1.5 text-white/30 hover:text-[#ffde21] hover:bg-[#ffde21]/10 transition-all">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {isAdmin && (
              <button onClick={() => setConfirmDelete(true)}
                className="rounded-lg p-1.5 text-white/20 hover:bg-red-500/10 hover:text-red-400 transition-all">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setExpanded(v => !v)}
              className="rounded-lg p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-all">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-white/[0.06] px-5 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Left: Description + Transcript */}
              <div className="space-y-4">
                {post.description && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Descripción</p>
                    <p className="text-sm text-white/60 leading-relaxed">{post.description}</p>
                  </div>
                )}
                {post.transcript && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#ffde21]/50">Transcript</p>
                      <button onClick={() => navigator.clipboard.writeText(post.transcript!)}
                        className="inline-flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </button>
                    </div>
                    <p className="text-sm text-white/50 leading-relaxed">{post.transcript}</p>
                  </div>
                )}
              </div>

              {/* Right: Analysis */}
              {post.analysis && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#ffde21]/50">Análisis IA</p>
                      <Sparkles className="h-3.5 w-3.5 text-[#ffde21]/30" />
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(post.analysis!)}
                      className="inline-flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </button>
                  </div>
                  <AnalysisBlock text={post.analysis} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.04]">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-3 rounded-md" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

type SortKey = "views" | "likes" | "comments" | "creator" | null

export function CompetitorResearchView() {
  const activeClientId = useActiveClient()
  const router = useRouter()

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("views")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [deleting, setDeleting] = useState<string | null>(null)

  // Load user role
  useEffect(() => {
    async function checkRole() {
      const { createClient } = await import("@/lib/supabase")
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle()
      setIsAdmin(((prof as any)?.role ?? "").toLowerCase() === "admin")
    }
    checkRole()
  }, [])

  // Load posts
  const loadPosts = useCallback(async () => {
    if (!activeClientId) return
    setLoading(true); setError(null)
    try {
      const { createClient } = await import("@/lib/supabase")
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`/api/competitor-research?client_id=${activeClientId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Error cargando")
      setPosts(json.posts ?? [])
    } catch (e: any) {
      setError(e?.message ?? "Error cargando posts")
    } finally {
      setLoading(false)
    }
  }, [activeClientId])

  useEffect(() => { loadPosts() }, [loadPosts])

  // Delete
  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const { createClient } = await import("@/lib/supabase")
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      await fetch("/api/competitor-research/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id }),
      })
      setPosts(prev => prev.filter(p => p.id !== id))
      router.refresh()
    } finally {
      setDeleting(null)
    }
  }

  // Filter + sort
  const filtered = posts
    .filter(p => {
      const q = search.toLowerCase()
      if (!q) return true
      return (
        p.creator.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.transcript ?? "").toLowerCase().includes(q) ||
        (p.analysis ?? "").toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (!sortKey) return 0
      const av = sortKey === "creator" ? a.creator : (a[sortKey] ?? 0)
      const bv = sortKey === "creator" ? b.creator : (b[sortKey] ?? 0)
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className={`ml-1 inline-block transition-opacity ${sortKey === k ? "opacity-100 text-[#ffde21]" : "opacity-30"}`}>
      {sortKey === k && sortDir === "asc" ? "↑" : "↓"}
    </span>
  )

  const COL_HDR = "px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/35 whitespace-nowrap select-none"

  // Summary stats
  const totalViews   = posts.reduce((s, p) => s + (p.views ?? 0), 0)
  const totalLikes   = posts.reduce((s, p) => s + (p.likes ?? 0), 0)
  const uniqueCreators = new Set(posts.map(p => p.creator)).size

  return (
    <div className="space-y-6">
      {showModal && activeClientId && (
        <AddPostModal
          clientId={activeClientId}
          onClose={() => setShowModal(false)}
          onSaved={post => setPosts(prev => [post, ...prev])}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <h1 className="text-sm font-semibold uppercase tracking-widest text-white/70">Competitor Research</h1>
          </div>
          <p className="text-xs text-white/30 ml-[18px]">
            Análisis de contenido de la competencia
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#ffe84d] transition-all shadow-lg shadow-[#ffde21]/10"
        >
          <Plus className="h-4 w-4" />
          Agregar Post
        </button>
      </div>

      {/* Stats Bar */}
      {!loading && posts.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Posts", value: posts.length, icon: Search },
            { label: "Total Views", value: fmt(totalViews), icon: TrendingUp },
            { label: "Creadores", value: uniqueCreators, icon: Users },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.03),transparent_60%)]" />
              <div className="relative flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffde21]/10">
                  <Icon className="h-4 w-4 text-[#ffde21]" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">{label}</p>
                  <p className="text-xl font-bold text-white tabular-nums">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
        <input
          className="w-full rounded-xl border border-white/[0.07] bg-[#111113] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffde21]/40 focus:ring-1 focus:ring-[#ffde21]/10 transition-all"
          placeholder="Buscar por creador, descripción, transcript…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.07] bg-[#111113] p-5 space-y-3">
                {[80, 60, 40].map((w, j) => (
                  <div key={j} className="skeleton h-3 rounded-md" style={{ width: `${w}%` }} />
                ))}
              </div>
            ))
          : filtered.length === 0
            ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                  <Search className="h-5 w-5 text-white/20" />
                </span>
                <p className="text-sm text-white/30">
                  {search ? "No hay resultados para tu búsqueda" : "No hay posts todavía. ¡Agrega el primero!"}
                </p>
              </div>
            )
            : filtered.map(post => (
              <PostRow
                key={post.id}
                post={post}
                isAdmin={isAdmin}
                onDelete={handleDelete}
              />
            ))
        }
        {!loading && filtered.length > 0 && (
          <p className="text-[11px] text-white/25 px-1">
            {filtered.length} de {posts.length} post{posts.length !== 1 ? "s" : ""}
            {search ? ` · filtrando por "${search}"` : ""}
          </p>
        )}
      </div>
    </div>
  )
}
