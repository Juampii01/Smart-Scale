"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Instagram, Youtube, Loader2, RefreshCw, Check, AlertTriangle, Link2 } from "lucide-react"

const supabase = createClient()

interface Conn {
  clientId: string
  clientName: string
  platform: "instagram" | "youtube"
  accountName: string
  accountPic: string | null
  connectedAt: string
  expiresAt: string | null
  tokenExpired: boolean
}
interface Summary { totalClients: number; instagram: number; youtube: number }

function px(url: string | null): string | undefined {
  if (!url) return undefined
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

async function authFetch(path: string) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(path, { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } })
}

export function AdminSocialView() {
  const [conns, setConns] = useState<Conn[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState<"all" | "instagram" | "youtube">("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/admin/social-connections")
      if (res.ok) { const d = await res.json(); setConns(d.connections ?? []); setSummary(d.summary ?? null) }
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const visible = conns.filter((c) => platform === "all" || c.platform === platform)

  const Brand = ({ p }: { p: "instagram" | "youtube" }) =>
    p === "instagram"
      ? <Instagram className="h-4 w-4" style={{ color: "#E1306C" }} />
      : <Youtube className="h-4 w-4" style={{ color: "#FF0000" }} />

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffde21]/15">
          <Link2 className="h-6 w-6 text-[#ffde21]" />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground leading-none">Conexiones sociales</h1>
          <p className="text-sm text-foreground/50 mt-1">Quién conectó su Instagram / YouTube.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-foreground/[0.05] transition disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {/* Resumen */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wide text-foreground/45">Clientes conectados</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{summary.totalClients}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wide text-foreground/45 flex items-center gap-1"><Instagram className="h-3 w-3" style={{ color: "#E1306C" }} /> Instagram</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{summary.instagram}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wide text-foreground/45 flex items-center gap-1"><Youtube className="h-3 w-3" style={{ color: "#FF0000" }} /> YouTube</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{summary.youtube}</p>
          </div>
        </div>
      )}

      {/* Filtro */}
      <div className="flex gap-2">
        {(["all", "instagram", "youtube"] as const).map((p) => (
          <button key={p} onClick={() => setPlatform(p)}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium capitalize transition ${platform === p ? "border-[#ffde21]/40 bg-[#ffde21]/[0.12] text-foreground" : "border-border bg-card text-foreground/60 hover:bg-foreground/[0.05]"}`}>
            {p === "all" ? "Todas" : p}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-14 text-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-14 text-center text-sm text-foreground/50">
          Todavía no hay cuentas conectadas{platform !== "all" ? ` de ${platform}` : ""}.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {visible.map((c, i) => (
            <div key={`${c.clientId}-${c.platform}-${i}`} className="flex items-center gap-3 px-4 py-3">
              <span className="relative">
                {c.accountPic ? (
                  <img src={px(c.accountPic)} alt="" className="h-9 w-9 rounded-full object-cover border border-border" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/[0.06]"><Brand p={c.platform} /></span>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card"><Brand p={c.platform} /></span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{c.clientName}</p>
                <p className="truncate text-[12px] text-foreground/50">@{c.accountName}</p>
              </div>
              <div className="text-right">
                {c.tokenExpired ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3" /> Reconectar</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400"><Check className="h-3 w-3" /> Activo</span>
                )}
                <p className="text-[11px] text-foreground/35 mt-0.5">{new Date(c.connectedAt).toLocaleDateString("es-AR")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
