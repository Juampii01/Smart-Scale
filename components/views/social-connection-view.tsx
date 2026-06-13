"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { Instagram, Youtube, Loader2, Check, Link2, Unlink, AlertTriangle, RefreshCw, Heart, MessageCircle, Eye, ExternalLink, Flame } from "lucide-react"

const supabase = createClient()

type Platform = "instagram" | "youtube"

interface Status {
  connected: boolean
  tokenExpired?: boolean
  accountName?: string
  accountPic?: string
  connectedAt?: string
  expiresAt?: string | null
}

interface Stat { label: string; value: string; sub?: string }
interface MediaItem {
  id: string; thumbnail: string | null; permalink: string; caption: string
  likes: number; comments: number; views?: number; type: string; timestamp: string | null
}
interface Metrics { overview: Stat[]; detailed: Stat[]; media: MediaItem[]; note?: string }

const BRAND: Record<Platform, { name: string; color: string; Icon: typeof Instagram; desc: string }> = {
  instagram: { name: "Instagram", color: "#E1306C", Icon: Instagram, desc: "Tus métricas de Instagram, en vivo desde tu cuenta conectada." },
  youtube: { name: "YouTube", color: "#FF0000", Icon: Youtube, desc: "Las métricas de tu canal de YouTube, en vivo." },
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return n.toLocaleString("es-AR")
}

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export function SocialConnectionView({ platform }: { platform: Platform }) {
  const brand = BRAND[platform]
  const { Icon } = brand
  const activeClient = useActiveClient()
  const clientQ = activeClient ? `?client_id=${encodeURIComponent(activeClient)}` : ""

  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<{ type: "ok" | "error"; msg: string } | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  const loadStatus = useCallback(async () => {
    const token = await getToken()
    if (!token) { setLoading(false); return }
    try {
      const res = await fetch(`/api/social/${platform}/status${clientQ}`, { headers: { Authorization: `Bearer ${token}` } })
      setStatus(await res.json())
    } finally { setLoading(false) }
  }, [platform, clientQ])

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`/api/social/${platform}/metrics${clientQ}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        if (data.connected) setMetrics({ overview: data.overview ?? [], detailed: data.detailed ?? [], media: data.media ?? [], note: data.note })
      }
    } finally { setMetricsLoading(false) }
  }, [platform, clientQ])

  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => { if (status?.connected) loadMetrics() }, [status?.connected, loadMetrics])

  useEffect(() => {
    if (typeof window === "undefined") return
    const sp = new URLSearchParams(window.location.search)
    const ok = sp.get("connect_success"), err = sp.get("connect_error")
    if (ok === platform) setBanner({ type: "ok", msg: `${brand.name} conectado correctamente.` })
    else if (err === platform) setBanner({ type: "error", msg: `No se pudo conectar ${brand.name}. Probá de nuevo.` })
    if (ok || err) {
      const url = new URL(window.location.href)
      url.searchParams.delete("connect_success"); url.searchParams.delete("connect_error"); url.searchParams.delete("connect_error_reason")
      window.history.replaceState({}, "", url.toString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConnect = async () => {
    if (busy) return
    setBusy(true); setBanner(null)
    try {
      const token = await getToken()
      if (!token) { setBanner({ type: "error", msg: "Sesión expirada, recargá la página." }); return }
      const res = await fetch(`/api/social/${platform}/connect${clientQ}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok && data.url) { window.location.href = data.url; return }
      setBanner({ type: "error", msg: data.error === "not_configured" ? `La conexión con ${brand.name} todavía no está configurada en el servidor.` : (data.error ?? "No se pudo iniciar la conexión.") })
    } finally { setBusy(false) }
  }

  const handleDisconnect = async () => {
    if (busy) return
    if (!window.confirm(`¿Desconectar ${brand.name}?`)) return
    setBusy(true); setBanner(null)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`/api/social/${platform}/disconnect${clientQ}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) { setStatus({ connected: false }); setMetrics(null); setBanner({ type: "ok", msg: `${brand.name} desconectado.` }) }
      else setBanner({ type: "error", msg: "No se pudo desconectar." })
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `color-mix(in srgb, ${brand.color} 14%, transparent)` }}>
          <Icon className="h-6 w-6" style={{ color: brand.color }} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground leading-none">Mi {brand.name}</h1>
          <p className="text-sm text-foreground/50 mt-1">{brand.desc}</p>
        </div>
      </div>

      {banner && (
        <div className={`mt-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          banner.type === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
            : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        }`}>
          {banner.type === "ok" ? <Check className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {banner.msg}
        </div>
      )}

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : !status?.connected ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-foreground/60 mb-4">Tu cuenta de {brand.name} todavía no está conectada.</p>
          <button onClick={handleConnect} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe84d] active:scale-[0.98] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Conectar {brand.name}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {/* Cuenta conectada */}
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            {status.accountPic ? (
              <img src={status.accountPic} alt={status.accountName} referrerPolicy="no-referrer" className="h-11 w-11 rounded-full object-cover border border-border" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${brand.color} 14%, transparent)` }}>
                <Icon className="h-5 w-5" style={{ color: brand.color }} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{status.accountName ?? "Cuenta conectada"}</p>
              <p className="flex items-center gap-1 text-[12px] text-emerald-700 dark:text-emerald-400">
                <Check className="h-3 w-3" /> Conectado{status.connectedAt ? ` · ${new Date(status.connectedAt).toLocaleDateString("es-AR")}` : ""}
              </p>
            </div>
            <button onClick={() => loadMetrics()} disabled={metricsLoading} title="Actualizar" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-foreground/[0.05] transition disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${metricsLoading ? "animate-spin" : ""}`} /> Actualizar
            </button>
            <button onClick={handleDisconnect} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-red-600 dark:text-red-400 hover:bg-foreground/[0.05] transition disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />} Desconectar
            </button>
          </div>

          {status.tokenExpired && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> El acceso venció.
              <button onClick={handleConnect} disabled={busy} className="ml-auto inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="h-3 w-3" /> Reconectar</button>
            </div>
          )}

          {metricsLoading && !metrics ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-12 text-foreground/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Trayendo métricas…
            </div>
          ) : metrics && metrics.overview.length > 0 ? (
            <>
              {/* Overview */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {metrics.overview.map((s, i) => (
                  <div key={s.label} className={`rounded-2xl border p-4 ${i === 0 ? "border-[#ffde21]/30 bg-[#ffde21]/[0.06]" : "border-border bg-card"}`}>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/45">{s.label}</p>
                    <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Métricas detalladas */}
              {metrics.detailed.length > 0 && (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                    <Flame className="h-4 w-4 text-foreground/50" />
                    <span className="text-sm font-semibold text-foreground">Métricas detalladas</span>
                    <span className="ml-auto text-[11px] text-foreground/40">sobre {metrics.media.length} {platform === "youtube" ? "videos" : "reels"} recientes</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                    {metrics.detailed.map((s) => (
                      <div key={s.label} className="rounded-xl border border-border bg-background/40 p-4">
                        <p className="text-xs text-foreground/50">{s.label}</p>
                        <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{s.value}</p>
                        {s.sub && <p className="mt-0.5 text-[11px] text-foreground/40">{s.sub}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : metrics?.note ? (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {metrics.note === "reconnect" ? "El acceso a la API expiró. Reconectá la cuenta para ver las métricas." : "No pudimos traer las métricas ahora. Probá actualizar en un rato."}
            </div>
          ) : null}

          {/* Media reciente */}
          {metrics && metrics.media.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">{platform === "youtube" ? "Videos recientes" : "Publicaciones recientes"}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {metrics.media.slice(0, 12).map((m) => (
                  <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-foreground/20">
                    <div className="relative aspect-square w-full overflow-hidden bg-foreground/[0.04]">
                      {m.thumbnail ? (
                        <img src={m.thumbnail} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><Icon className="h-6 w-6 text-foreground/20" /></div>
                      )}
                      <span className="absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1 opacity-0 transition group-hover:opacity-100">
                        <ExternalLink className="h-3 w-3 text-white" />
                      </span>
                    </div>
                    <div className="p-2.5">
                      {m.caption && <p className="mb-1.5 line-clamp-2 text-[11px] text-foreground/60 leading-snug">{m.caption}</p>}
                      <div className="flex items-center gap-3 text-[11px] text-foreground/50">
                        {typeof m.views === "number" && m.views > 0 && <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {fmt(m.views)}</span>}
                        <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {fmt(m.likes)}</span>
                        <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" /> {fmt(m.comments)}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
