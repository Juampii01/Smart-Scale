"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Sparkles, MessageCircle, FileText, Megaphone, DollarSign, Cog,
  Instagram, Slack, RefreshCw, Loader2, CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { isOmniOwnerEmail } from "@/lib/omni/owner"

// Módulos de Omni. El piloto arranca con el Agente de Conversaciones (DMs de Ann);
// el resto son la expansión natural, mismo molde apuntado a otra fuente.
const MODULES = [
  {
    key:    "conversaciones",
    name:   "Agente de Conversaciones",
    desc:   "Analiza los DMs de Ann: encuentra los mejores leads, qué los convierte y cuáles se enfrían.",
    icon:   MessageCircle,
    status: "piloto" as const,
  },
  {
    key:    "comunidad",
    name:   "Comunidad",
    desc:   "Lee Slack (canales generales + los #cl-nombre) y encuentra dónde están los problemas.",
    icon:   Cog,
    status: "piloto" as const,
  },
  {
    key:    "contenido",
    name:   "Contenido",
    desc:   "Qué posts y reels traen DMs que después cierran — no solo likes.",
    icon:   FileText,
    status: "proximamente" as const,
  },
  {
    key:    "ads",
    name:   "Ads",
    desc:   "Qué anuncio trae prospectos que cierran vs. curiosos, y caídas de calidad.",
    icon:   Megaphone,
    status: "proximamente" as const,
  },
  {
    key:    "revenue",
    name:   "Revenue",
    desc:   "Dónde se cae la plata en el funnel; cash cobrado y proyección.",
    icon:   DollarSign,
    status: "proximamente" as const,
  },
]

interface IgStatus {
  account_name: string
  connected_at: string
}

interface SlackStatus {
  channels: number
  messages: number
  lastSyncedAt: string | null
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "nunca"
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export function AdminOmniView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [allowed, setAllowed] = useState<boolean | null>(null) // null = verificando

  const [igStatus,   setIgStatus]   = useState<IgStatus | null | undefined>(undefined) // undefined = cargando
  const [igLoading,  setIgLoading]  = useState(false)
  const [igSyncing,  setIgSyncing]  = useState(false)
  const [igSyncMsg,  setIgSyncMsg]  = useState<string | null>(null)

  const [slackStatus,  setSlackStatus]  = useState<SlackStatus | null>(null)
  const [slackSyncing, setSlackSyncing] = useState(false)
  const [slackSyncMsg, setSlackSyncMsg] = useState<string | null>(null)

  const getAuthHeader = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    return { Authorization: `Bearer ${session.access_token}` }
  }, [])

  const fetchIgStatus = useCallback(async () => {
    const headers = await getAuthHeader()
    if (!headers) return
    const res = await fetch("/api/admin/omni/instagram/status", { headers })
    if (!res.ok) return
    const json = await res.json()
    setIgStatus(json.connection ?? null)
  }, [getAuthHeader])

  const fetchSlackStatus = useCallback(async () => {
    const headers = await getAuthHeader()
    if (!headers) return
    const res = await fetch("/api/admin/omni/slack/status", { headers })
    if (!res.ok) return
    setSlackStatus(await res.json())
  }, [getAuthHeader])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then((res: Awaited<ReturnType<typeof supabase.auth.getUser>>) => {
      const email = res.data?.user?.email ?? null
      if (isOmniOwnerEmail(email)) {
        setAllowed(true)
      } else {
        setAllowed(false)
        router.replace("/admin/executive-dashboard")
      }
    })
  }, [router])

  useEffect(() => {
    if (!allowed) return
    fetchIgStatus()
    fetchSlackStatus()

    if (searchParams.get("omni_ig_success")) setIgSyncMsg("Instagram conectado — ya podés sincronizar.")
    if (searchParams.get("omni_ig_error"))   setIgSyncMsg(`Error al conectar Instagram (${searchParams.get("omni_ig_error")}).`)
  }, [allowed, fetchIgStatus, fetchSlackStatus, searchParams])

  const connectInstagram = async () => {
    setIgLoading(true)
    try {
      const headers = await getAuthHeader()
      if (!headers) return
      const res = await fetch("/api/admin/omni/instagram/connect", { headers })
      const json = await res.json()
      if (res.ok && json.url) window.location.href = json.url
      else setIgSyncMsg(json.error ?? "No se pudo iniciar la conexión")
    } finally {
      setIgLoading(false)
    }
  }

  const syncInstagram = async () => {
    setIgSyncing(true)
    setIgSyncMsg(null)
    try {
      const headers = await getAuthHeader()
      if (!headers) return
      const res = await fetch("/api/admin/omni/instagram/sync", { method: "POST", headers })
      const json = await res.json()
      setIgSyncMsg(res.ok
        ? `Listo — ${json.conversationsSynced} conversaciones, ${json.messagesSynced} mensajes.`
        : (json.error ?? "Error al sincronizar"))
    } finally {
      setIgSyncing(false)
    }
  }

  const syncSlack = async () => {
    setSlackSyncing(true)
    setSlackSyncMsg(null)
    try {
      const headers = await getAuthHeader()
      if (!headers) return
      const res = await fetch("/api/admin/omni/slack/sync", { method: "POST", headers })
      const json = await res.json()
      if (res.ok) {
        setSlackSyncMsg(`Listo — ${json.channelsSynced} canales, ${json.messagesSynced} mensajes.`)
        fetchSlackStatus()
      } else {
        setSlackSyncMsg(json.error ?? "Error al sincronizar")
      }
    } finally {
      setSlackSyncing(false)
    }
  }

  if (!allowed) return null

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ffde21]/25 bg-[#ffde21]/[0.12]">
            <Sparkles className="h-5 w-5 text-[#ffde21]" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Omni</h1>
            <p className="text-sm text-foreground/40">Sistema operativo de IA · Piloto con Ann</p>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/60">
          El sector donde vive el sistema de IA de Ann. Mira el negocio todos los días,
          encuentra los mejores leads y dónde se escapa la plata — empezando por donde
          Ann cierra: los DMs, y la comunidad en Slack.
        </p>
      </div>

      {/* Conexiones */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">Conexiones</p>
        <div className="grid gap-3 sm:grid-cols-2">

          {/* Instagram */}
          <div className="rounded-2xl border border-foreground/[0.07] bg-card p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/[0.05] text-foreground/50">
                <Instagram className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-foreground">Instagram DMs</h3>
                <p className="text-[12px] text-foreground/40">
                  {igStatus === undefined ? "Verificando…"
                    : igStatus ? `Conectado como @${igStatus.account_name}`
                    : "No conectado"}
                </p>
              </div>
              {igStatus && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />}
            </div>
            <div className="mt-3 flex gap-2">
              {!igStatus && (
                <button
                  onClick={connectInstagram}
                  disabled={igLoading}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-[#ffde21] px-3 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40"
                >
                  {igLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Conectar Instagram
                </button>
              )}
              {igStatus && (
                <button
                  onClick={syncInstagram}
                  disabled={igSyncing}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-3 text-[12px] font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/25 transition-all disabled:opacity-40"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", igSyncing && "animate-spin")} />
                  Sincronizar
                </button>
              )}
            </div>
            {igSyncMsg && <p className="mt-2 text-[11.5px] text-foreground/45">{igSyncMsg}</p>}
          </div>

          {/* Slack */}
          <div className="rounded-2xl border border-foreground/[0.07] bg-card p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/[0.05] text-foreground/50">
                <Slack className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-foreground">Slack — Comunidad</h3>
                <p className="text-[12px] text-foreground/40">
                  {slackStatus
                    ? `${slackStatus.channels} canales · ${slackStatus.messages} mensajes · última sync: ${fmtDateTime(slackStatus.lastSyncedAt)}`
                    : "Verificando…"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={syncSlack}
                disabled={slackSyncing}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-3 text-[12px] font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/25 transition-all disabled:opacity-40"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", slackSyncing && "animate-spin")} />
                Sincronizar
              </button>
            </div>
            {slackSyncMsg && <p className="mt-2 text-[11.5px] text-foreground/45">{slackSyncMsg}</p>}
          </div>

        </div>
        <p className="mt-2 text-[12px] text-foreground/35">
          Requiere el permiso de mensajes habilitado en Meta (Instagram) y los scopes de lectura
          agregados al bot de Slack — ver la conversación del setup para el detalle de cada uno.
        </p>
      </div>

      {/* Módulos */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">Módulos</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(m => {
            const isPiloto = m.status === "piloto"
            return (
              <div
                key={m.key}
                className={cn(
                  "rounded-2xl border p-4",
                  isPiloto ? "border-[#ffde21]/25 bg-[#ffde21]/[0.04]" : "border-foreground/[0.07] bg-card",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    isPiloto ? "bg-[#ffde21]/[0.12] text-[#ffde21]" : "bg-foreground/[0.05] text-foreground/40",
                  )}>
                    <m.icon className="h-4 w-4" />
                  </span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    isPiloto ? "bg-[#ffde21]/[0.12] text-[#ffde21]" : "bg-foreground/[0.05] text-foreground/40",
                  )}>
                    {isPiloto ? "Piloto" : "Próximamente"}
                  </span>
                </div>
                <h3 className="mt-3 text-[14px] font-semibold text-foreground">{m.name}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/55">{m.desc}</p>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
