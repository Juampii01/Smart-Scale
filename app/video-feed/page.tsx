"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { AiLoading } from "@/components/ui/ai-loading"
import {
  Instagram, ExternalLink, Eye, ThumbsUp, MessageCircle,
  Sparkles, ChevronDown, ChevronUp, Copy, Check,
  RefreshCw, Play, Image as ImageIcon, Film,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  post_id:      string
  type:         string
  title:        string
  caption:      string
  thumbnail:    string | null
  post_url:     string
  views:        number
  likes:        number
  comments:     number
  duration:     string | null
  published_at: string | null
  analysis:     string | null
}

interface Account {
  platform:       string
  channel_url:    string
  channel_name:   string
  channel_avatar: string | null
  posts:          Post[]
  updated_at:     string
}

type Filter = "all" | "top"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function timeAgo(iso: string | null) {
  if (!iso) return ""
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "Hoy"
  if (days === 1) return "Ayer"
  if (days < 7)   return `${days}d`
  if (days < 30)  return `${Math.floor(days / 7)}sem`
  return `${Math.floor(days / 30)}mes`
}

function engScore(p: Post) { return (p.views + p.comments) / 2 }
function avgScore(posts: Post[]) {
  if (!posts.length) return 0
  return posts.reduce((s, p) => s + engScore(p), 0) / posts.length
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, avg }: { post: Post; avg: number }) {
  const [expanded,   setExpanded]   = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [thumbError, setThumbError] = useState(false)

  const score  = engScore(post)
  const mult   = avg > 0 ? score / avg : 0
  const isTop  = mult >= 1.5
  const isVideo = post.type === "Video" || post.type === "Reel" || post.type === "video"

  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 ${
      isTop ? "border-[#ffde21]/30 shadow-[0_0_20px_rgba(255,222,33,0.05)]" : "border-white/[0.07]"
    } bg-[#111113]`}>

      {isTop && (
        <div className="absolute top-2.5 left-2.5 z-10 rounded-lg bg-[#ffde21] px-2 py-0.5 text-[10px] font-bold text-black shadow-sm">
          {mult.toFixed(1)}x
        </div>
      )}

      <div className="absolute top-2.5 right-2.5 z-10 rounded-lg bg-black/50 p-1 backdrop-blur-sm">
        {isVideo ? <Play className="h-3 w-3 text-white/70" /> : <ImageIcon className="h-3 w-3 text-white/50" />}
      </div>

      {/* Thumbnail — portrait 9:16 */}
      <a href={post.post_url} target="_blank" rel="noopener noreferrer"
        className="block relative overflow-hidden bg-white/[0.04]" style={{ aspectRatio: "9/16" }}>
        {post.thumbnail && !thumbError
          ? <img
              src={`/api/proxy-image?url=${encodeURIComponent(post.thumbnail)}`}
              alt={post.title}
              onError={() => setThumbError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          : <div className="flex h-full items-center justify-center">
              <Film className="h-8 w-8 text-white/10" />
            </div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-2.5 pb-2">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-white">
            <Eye className="h-3 w-3 opacity-70" />{post.views > 0 ? fmt(post.views) : "—"}
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

        <div className="flex items-center gap-2.5 text-white/35 mb-2">
          <span className="flex items-center gap-0.5 text-[10px]"><ThumbsUp className="h-2.5 w-2.5" />{fmt(post.likes)}</span>
          <span className="flex items-center gap-0.5 text-[10px]"><MessageCircle className="h-2.5 w-2.5" />{fmt(post.comments)}</span>
          {post.published_at && <span className="text-[10px] ml-auto">{timeAgo(post.published_at)}</span>}
        </div>

        {post.analysis && (
          <div className="border-t border-white/[0.05] pt-2 mt-auto">
            <button onClick={() => setExpanded(v => !v)} className="flex w-full items-center gap-1.5 text-left">
              <Sparkles className="h-2.5 w-2.5 text-[#ffde21]/50" />
              <span className="text-[9px] font-semibold uppercase tracking-widest text-[#ffde21]/50 flex-1">Análisis IA</span>
              {expanded ? <ChevronUp className="h-3 w-3 text-white/20" /> : <ChevronDown className="h-3 w-3 text-white/20" />}
            </button>
            {expanded && (
              <div className="mt-2 space-y-2">
                <p className="text-[10px] text-white/55 leading-relaxed">{post.analysis}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(post.analysis!); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                  className="inline-flex items-center gap-1 text-[9px] text-white/25 hover:text-white/50 transition-colors"
                >
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

// ─── Connect Form (Instagram only) ───────────────────────────────────────────

function ConnectForm({ onConnect }: { onConnect: (account: Account) => void }) {
  const [url,     setUrl]     = useState("")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || loading) return
    setLoading(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sesión expirada."); return }
      const res  = await fetch("/api/video-feed", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ channel_url: url.trim(), platform: "instagram" }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Error al conectar."); return }
      onConnect({
        platform:       "instagram",
        channel_url:    data.channelUrl,
        channel_name:   data.channelName,
        channel_avatar: data.channelAvatar,
        posts:          data.posts,
        updated_at:     new Date().toISOString(),
      })
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado.")
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/10">
            <Instagram className="h-7 w-7 text-pink-400" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-1">Conectá tu Instagram</h2>
        <p className="text-sm text-white/40 text-center mb-8">
          Ingresá la URL de tu perfil para ver tus mejores posts de los últimos 30 días con análisis IA.
        </p>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] overflow-hidden">
          <div className="h-[2px] w-full bg-gradient-to-r from-pink-500/0 via-pink-500/40 to-pink-500/0" />
          <div className="p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                  <Instagram className="h-4 w-4 text-pink-400" />
                </div>
                <input
                  type="url"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setError(null) }}
                  placeholder="https://instagram.com/tuperfil/"
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0c0c0d] pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:border-pink-500/40 focus:outline-none focus:ring-1 focus:ring-pink-500/15 transition-all"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={!url.trim() || loading}
                className="h-11 w-full rounded-xl bg-[#ffde21] text-sm font-bold text-black hover:bg-[#ffe46b] disabled:opacity-40 transition"
              >
                {loading ? "Cargando tu perfil…" : "Conectar Instagram"}
              </button>
            </form>
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
            )}
          </div>
          {loading && (
            <div className="border-t border-white/[0.05]">
              <AiLoading
                title="Obteniendo tus publicaciones"
                steps={["Conectando con Instagram…", "Obteniendo publicaciones…", "Calculando métricas…", "Generando análisis IA…", "Casi listo…"]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Feed View ────────────────────────────────────────────────────────────────

function FeedView({ account, onRefresh }: {
  account:   Account
  onRefresh: () => Promise<{ newPostsCount?: number } | void>
}) {
  const [filter,     setFilter]     = useState<Filter>("all")
  const [refreshing, setRefreshing] = useState(false)
  const [lastNew,    setLastNew]    = useState<number | null>(null)

  const avg      = avgScore(account.posts)
  const filtered = filter === "top"
    ? account.posts.filter(p => avg > 0 && engScore(p) / avg >= 1.2)
    : [...account.posts]

  const handleRefresh = async () => {
    setRefreshing(true); setLastNew(null)
    try {
      const result = await onRefresh()
      if (result && typeof result === "object" && "newPostsCount" in result) {
        setLastNew(result.newPostsCount ?? 0)
      }
    } finally { setRefreshing(false) }
  }

  return (
    <div className="space-y-6">
      {/* Account header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pink-500/20 bg-pink-500/10 overflow-hidden">
          {account.channel_avatar
            ? <img src={account.channel_avatar} alt="" className="w-full h-full object-cover" />
            : <Instagram className="h-5 w-5 text-pink-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">@{account.channel_name}</span>
            <a href={account.channel_url} target="_blank" rel="noopener noreferrer"
              className="text-white/25 hover:text-[#ffde21] transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="text-[11px] text-white/30 mt-0.5">
            {account.posts.length} posts · últimos 30 días · Actualizado {timeAgo(account.updated_at)}
            {lastNew !== null && (
              <span className={`ml-2 font-medium ${lastNew > 0 ? "text-emerald-400" : "text-white/25"}`}>
                {lastNew > 0 ? `+${lastNew} nuevo${lastNew > 1 ? "s" : ""}` : "Sin posts nuevos"}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Actualizar — solo procesa posts nuevos"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-white/30 hover:border-white/20 hover:text-white/60 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {(["all", "top"] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`h-8 rounded-lg px-4 text-xs font-semibold transition-all ${
              filter === f
                ? "bg-[#ffde21] text-black"
                : "border border-white/[0.07] bg-white/[0.03] text-white/40 hover:text-white/70"
            }`}>
            {f === "all" ? "Todos" : "Top Performing"}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-white/25">{filtered.length} publicaciones</span>
      </div>

      {/* Grid — portrait 9:16 */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {filtered.map(p => <PostCard key={p.post_id} post={p} avg={avg} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-white/30">No hay publicaciones que superen el umbral.</p>
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
  const [account,        setAccount]        = useState<Account | null>(null)
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
      const res  = await fetch("/api/video-feed", { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setAccount(data.account ?? null)
    } catch {} finally { setLoadingAccount(false) }
  }, [])

  useEffect(() => { loadAccount() }, [loadAccount])

  const handleRefresh = async () => {
    if (!account) return
    const token = await getToken()
    if (!token) return
    const res  = await fetch("/api/video-feed", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ channel_url: account.channel_url, platform: "instagram" }),
    })
    const data = await res.json()
    if (res.ok) {
      setAccount(prev => prev ? { ...prev, posts: data.posts, updated_at: new Date().toISOString() } : prev)
      return { newPostsCount: data.newPostsCount ?? 0 }
    }
  }

  if (loadingAccount) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
      </div>
    )
  }

  return (
    <div className="px-4 py-10 max-w-7xl mx-auto">
      {account
        ? <FeedView account={account} onRefresh={handleRefresh} />
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
