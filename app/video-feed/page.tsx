"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { AiLoading } from "@/components/ui/ai-loading"
import {
  Youtube, Instagram, ExternalLink, Eye, ThumbsUp, MessageCircle,
  Sparkles, ChevronDown, ChevronUp, Copy, Check, Plus, RefreshCw,
  Trash2, Play, Image as ImageIcon, Film,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Post {
  post_id: string
  type: string
  title: string
  caption: string
  thumbnail: string | null
  post_url: string
  views: number
  likes: number
  comments: number
  duration: string | null
  published_at: string | null
  analysis: string | null
}

interface Account {
  platform: string
  channel_url: string
  channel_name: string
  channel_avatar: string | null
  posts: Post[]
  updated_at: string
}

type Filter = "all" | "top"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function timeAgo(iso: string | null) {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "Hoy"
  if (days === 1) return "Ayer"
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)}sem`
  return `${Math.floor(days / 30)}mes`
}

function avgViews(posts: Post[]) {
  if (!posts.length) return 0
  return posts.reduce((s, p) => s + p.views, 0) / posts.length
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, avg, platform }: { post: Post; avg: number; platform: string }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const mult = avg > 0 ? post.views / avg : 0
  const isTop = mult >= 1.5
  const isVideo = post.type === "Video" || post.type === "Reel" || post.type === "video"
  // Instagram reels/posts are portrait (9:16), YouTube is landscape (16:9)
  const aspectRatio = platform === "instagram" ? "9/16" : "16/9"

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 ${isTop ? "border-[#ffde21]/30 shadow-[0_0_20px_rgba(255,222,33,0.05)]" : "border-white/[0.07]"} bg-[#111113]`}>

      {/* Performance badge */}
      {isTop && (
        <div className="absolute top-2.5 left-2.5 z-10 rounded-lg bg-[#ffde21] px-2 py-0.5 text-[10px] font-bold text-black shadow-sm">
          {mult.toFixed(1)}x
        </div>
      )}

      {/* Type badge */}
      <div className="absolute top-2.5 right-2.5 z-10 rounded-lg bg-black/50 p-1 backdrop-blur-sm">
        {isVideo
          ? <Play className="h-3 w-3 text-white/70" />
          : <ImageIcon className="h-3 w-3 text-white/50" />}
      </div>

      {/* Thumbnail */}
      <a href={post.post_url} target="_blank" rel="noopener noreferrer"
        className="block relative overflow-hidden bg-white/[0.04]" style={{ aspectRatio }}>
        {post.thumbnail
          ? <img src={post.thumbnail} alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="flex h-full items-center justify-center">
              <Film className="h-8 w-8 text-white/10" />
            </div>}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Bottom overlay: views + duration */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-2.5 pb-2">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-white">
            <Eye className="h-3 w-3 opacity-70" />{fmt(post.views)}
          </span>
          {post.duration && (
            <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
              {post.duration}
            </span>
          )}
        </div>
      </a>

      {/* Info */}
      <div className="flex flex-col flex-1 p-3">
        <p className="text-xs font-medium text-white/80 leading-snug line-clamp-2 mb-2">{post.title}</p>

        {/* Metrics */}
        <div className="flex items-center gap-2.5 text-white/35 mb-2">
          <span className="flex items-center gap-0.5 text-[10px]"><ThumbsUp className="h-2.5 w-2.5" />{fmt(post.likes)}</span>
          <span className="flex items-center gap-0.5 text-[10px]"><MessageCircle className="h-2.5 w-2.5" />{fmt(post.comments)}</span>
          {post.published_at && <span className="text-[10px] ml-auto">{timeAgo(post.published_at)}</span>}
        </div>

        {/* AI Analysis toggle */}
        {post.analysis && (
          <div className="border-t border-white/[0.05] pt-2 mt-auto">
            <button onClick={() => setExpanded(v => !v)}
              className="flex w-full items-center gap-1.5 text-left">
              <Sparkles className="h-2.5 w-2.5 text-[#ffde21]/50" />
              <span className="text-[9px] font-semibold uppercase tracking-widest text-[#ffde21]/50 flex-1">Análisis IA</span>
              {expanded ? <ChevronUp className="h-3 w-3 text-white/20" /> : <ChevronDown className="h-3 w-3 text-white/20" />}
            </button>
            {expanded && (
              <div className="mt-2 space-y-2">
                <p className="text-[10px] text-white/55 leading-relaxed">{post.analysis}</p>
                <button onClick={() => { navigator.clipboard.writeText(post.analysis!); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                  className="inline-flex items-center gap-1 text-[9px] text-white/25 hover:text-white/50 transition-colors">
                  {copied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                  Copiar análisis
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Connect Form ─────────────────────────────────────────────────────────────

function ConnectForm({ onConnect }: { onConnect: (account: Account) => void }) {
  const [platform, setPlatform] = useState<"youtube" | "instagram">("instagram")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || loading) return
    setLoading(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sesión expirada."); return }
      const res = await fetch("/api/video-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ channel_url: url.trim(), platform }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Error al conectar."); return }
      onConnect({ platform: data.platform, channel_url: data.channelUrl, channel_name: data.channelName, channel_avatar: data.channelAvatar, posts: data.posts, updated_at: new Date().toISOString() })
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado.")
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
            <Film className="h-7 w-7 text-white/30" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-1">Conectá tu perfil</h2>
        <p className="text-sm text-white/40 text-center mb-8">Ingresá la URL de tu cuenta para ver todos tus videos con métricas y análisis IA.</p>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] overflow-hidden">
          <div className="h-[2px] w-full bg-gradient-to-r from-[#ffde21]/0 via-[#ffde21]/50 to-[#ffde21]/0" />
          <div className="p-6 space-y-4">
            {/* Platform */}
            <div className="flex rounded-xl border border-white/[0.08] bg-[#0c0c0d] overflow-hidden h-11">
              <button type="button" onClick={() => { setPlatform("instagram"); setUrl("") }}
                className={`flex flex-1 items-center justify-center gap-2 text-sm font-medium transition-colors border-r border-white/[0.06] ${platform === "instagram" ? "bg-pink-500/15 text-pink-300" : "text-white/30 hover:text-white/60"}`}>
                <Instagram className="h-4 w-4" /> Instagram
              </button>
              <button type="button" onClick={() => { setPlatform("youtube"); setUrl("") }}
                className={`flex flex-1 items-center justify-center gap-2 text-sm font-medium transition-colors ${platform === "youtube" ? "bg-red-500/15 text-red-300" : "text-white/30 hover:text-white/60"}`}>
                <Youtube className="h-4 w-4" /> YouTube
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                  {platform === "instagram" ? <Instagram className="h-4 w-4 text-pink-400" /> : <Youtube className="h-4 w-4 text-red-400" />}
                </div>
                <input type="url" value={url} onChange={e => { setUrl(e.target.value); setError(null) }}
                  placeholder={platform === "instagram" ? "https://instagram.com/tuperfil/" : "https://youtube.com/@tucanal"}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0c0c0d] pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:border-[#ffde21]/40 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/15 transition-all"
                  disabled={loading} />
              </div>
              <button type="submit" disabled={!url.trim() || loading}
                className="h-11 w-full rounded-xl bg-[#ffde21] text-sm font-bold text-black hover:bg-[#ffe46b] disabled:opacity-40 transition">
                {loading ? "Cargando tu perfil…" : "Conectar cuenta"}
              </button>
            </form>

            {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
          </div>
          {loading && (
            <div className="border-t border-white/[0.05]">
              <AiLoading title="Obteniendo tus publicaciones"
                steps={["Conectando con la plataforma…", "Obteniendo publicaciones…", "Calculando métricas…", "Generando análisis con IA…", "Casi listo…"]} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Feed View ────────────────────────────────────────────────────────────────

function FeedView({ account, onRefresh, onDisconnect }: {
  account: Account
  onRefresh: () => void
  onDisconnect: () => void
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const [refreshing, setRefreshing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const isInstagram = account.platform === "instagram"
  const avg = avgViews(account.posts)

  const filtered = filter === "top"
    ? account.posts.filter(p => avg > 0 && p.views / avg >= 1.2).sort((a, b) => b.views - a.views)
    : [...account.posts].sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime())

  const handleRefresh = async () => {
    setRefreshing(true)
    try { await onRefresh() } finally { setRefreshing(false) }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try { await onDisconnect() } finally { setDisconnecting(false) }
  }

  return (
    <div className="space-y-6">
      {/* Account header */}
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border overflow-hidden ${isInstagram ? "bg-pink-500/10 border-pink-500/20" : "bg-red-500/10 border-red-500/20"}`}>
          {account.channel_avatar
            ? <img src={account.channel_avatar} alt="" className="w-full h-full object-cover" />
            : isInstagram
              ? <Instagram className="h-5 w-5 text-pink-400" />
              : <Youtube className="h-5 w-5 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{account.channel_name}</span>
            <a href={account.channel_url} target="_blank" rel="noopener noreferrer"
              className="text-white/25 hover:text-[#ffde21] transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="text-[11px] text-white/30 mt-0.5">
            {account.posts.length} publicaciones · Actualizado {timeAgo(account.updated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/30 hover:border-white/20 hover:text-white/60 transition-all disabled:opacity-40">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/25 hover:border-red-500/30 hover:bg-red-500/[0.08] hover:text-red-400 transition-all disabled:opacity-40">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {(["all", "top"] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`h-8 rounded-lg px-4 text-xs font-semibold transition-all ${filter === f ? "bg-[#ffde21] text-black" : "border border-white/[0.07] bg-white/[0.03] text-white/40 hover:text-white/70"}`}>
            {f === "all" ? "Todos" : "Top Performing"}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-white/25">{filtered.length} publicaciones</span>
      </div>

      {/* Grid — portrait for Instagram (more columns), landscape for YouTube (fewer) */}
      {filtered.length > 0 ? (
        <div className={`grid gap-3 ${isInstagram
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
          {filtered.map(p => (
            <PostCard key={p.post_id} post={p} avg={avg} platform={account.platform} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-white/30">No hay publicaciones que superen el umbral de rendimiento.</p>
          <button onClick={() => setFilter("all")} className="text-xs text-[#ffde21]/60 hover:text-[#ffde21] transition-colors">
            Ver todas →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function VideoFeedContent() {
  const [account, setAccount] = useState<Account | null>(null)
  const [loadingAccount, setLoadingAccount] = useState(true)

  const getToken = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const loadAccount = useCallback(async () => {
    const token = await getToken()
    if (!token) { setLoadingAccount(false); return }
    try {
      const res = await fetch("/api/video-feed", { headers: { "Authorization": `Bearer ${token}` } })
      const data = await res.json()
      setAccount(data.account ?? null)
    } catch {} finally { setLoadingAccount(false) }
  }, [])

  useEffect(() => { loadAccount() }, [loadAccount])

  const handleRefresh = async () => {
    if (!account) return
    const token = await getToken()
    if (!token) return
    const res = await fetch("/api/video-feed", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ channel_url: account.channel_url, platform: account.platform }),
    })
    const data = await res.json()
    if (res.ok) setAccount({ ...account, posts: data.posts, updated_at: new Date().toISOString() })
  }

  const handleDisconnect = async () => {
    const token = await getToken()
    if (!token) return
    await fetch("/api/video-feed", { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } })
    setAccount(null)
  }

  if (loadingAccount) {
    return (
      <div className="px-4 py-10 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-10 max-w-7xl mx-auto">
      {account
        ? <FeedView account={account} onRefresh={handleRefresh} onDisconnect={handleDisconnect} />
        : <ConnectForm onConnect={setAccount} />}
    </div>
  )
}

export default function VideoFeedPage() {
  return (
    <DashboardLayout>
      <VideoFeedContent />
    </DashboardLayout>
  )
}
