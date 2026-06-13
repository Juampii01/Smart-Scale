"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { Instagram, Youtube, Loader2, Check, Link2, Unlink, AlertTriangle, RefreshCw } from "lucide-react"

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

const BRAND: Record<Platform, { name: string; color: string; Icon: typeof Instagram; desc: string }> = {
  instagram: {
    name: "Instagram",
    color: "#E1306C",
    Icon: Instagram,
    desc: "Conectá tu cuenta de Instagram para traer tus métricas y que se sincronicen con tu reporte.",
  },
  youtube: {
    name: "YouTube",
    color: "#FF0000",
    Icon: Youtube,
    desc: "Conectá tu canal de YouTube para traer tus métricas y que se sincronicen con tu reporte.",
  },
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

  const loadStatus = useCallback(async () => {
    const token = await getToken()
    if (!token) { setLoading(false); return }
    try {
      const res = await fetch(`/api/social/${platform}/status${clientQ}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setStatus(data)
    } finally {
      setLoading(false)
    }
  }, [platform, clientQ])

  useEffect(() => { loadStatus() }, [loadStatus])

  // Banner desde el redirect del callback (?connect_success / ?connect_error)
  useEffect(() => {
    if (typeof window === "undefined") return
    const sp = new URLSearchParams(window.location.search)
    const ok = sp.get("connect_success")
    const err = sp.get("connect_error")
    if (ok === platform) setBanner({ type: "ok", msg: `${brand.name} conectado correctamente.` })
    else if (err === platform) setBanner({ type: "error", msg: `No se pudo conectar ${brand.name}. Probá de nuevo.` })
    if (ok || err) {
      const url = new URL(window.location.href)
      url.searchParams.delete("connect_success")
      url.searchParams.delete("connect_error")
      url.searchParams.delete("connect_error_reason")
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
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      if (data.error === "not_configured") {
        setBanner({ type: "error", msg: `La conexión con ${brand.name} todavía no está configurada en el servidor.` })
      } else {
        setBanner({ type: "error", msg: data.error ?? "No se pudo iniciar la conexión." })
      }
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    if (busy) return
    if (!window.confirm(`¿Desconectar ${brand.name}? Vas a tener que volver a autorizar para sincronizar.`)) return
    setBusy(true); setBanner(null)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`/api/social/${platform}/disconnect${clientQ}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) { setStatus({ connected: false }); setBanner({ type: "ok", msg: `${brand.name} desconectado.` }) }
      else setBanner({ type: "error", msg: "No se pudo desconectar." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `color-mix(in srgb, ${brand.color} 14%, transparent)` }}>
          <Icon className="h-7 w-7" style={{ color: brand.color }} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Mi {brand.name}</h1>
        <p className="text-sm text-foreground/50 mt-2 max-w-md mx-auto">{brand.desc}</p>
      </div>

      {/* Banner */}
      {banner && (
        <div className={`mt-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          banner.type === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
            : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        }`}>
          {banner.type === "ok" ? <Check className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {banner.msg}
        </div>
      )}

      {/* Estado */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-12 text-foreground/50">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : status?.connected ? (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              {status.accountPic ? (
                <img src={status.accountPic} alt={status.accountName} className="h-12 w-12 rounded-full object-cover border border-border" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${brand.color} 14%, transparent)` }}>
                  <Icon className="h-6 w-6" style={{ color: brand.color }} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{status.accountName ?? "Cuenta conectada"}</p>
                <p className="flex items-center gap-1 text-[12px] text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3 w-3" /> Conectado
                  {status.connectedAt ? ` · ${new Date(status.connectedAt).toLocaleDateString("es-AR")}` : ""}
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-red-600 dark:text-red-400 hover:bg-foreground/[0.05] transition disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />} Desconectar
              </button>
            </div>

            {status.tokenExpired && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> El acceso venció. Reconectá para seguir sincronizando.
                <button onClick={handleConnect} disabled={busy} className="ml-auto inline-flex items-center gap-1 font-semibold underline">
                  <RefreshCw className="h-3 w-3" /> Reconectar
                </button>
              </div>
            )}

            <p className="mt-4 text-[12px] text-foreground/40">
              La sincronización de métricas y posts se está terminando de habilitar — vas a verla acá muy pronto.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-foreground/60 mb-4">Tu cuenta de {brand.name} todavía no está conectada.</p>
            <button
              onClick={handleConnect}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe84d] active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Conectar {brand.name}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
