"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Sparkles, MessageCircle, FileText, Megaphone, DollarSign, Cog,
  Instagram, Slack, RefreshCw, Loader2, CheckCircle2, Wand2, Quote, Send, Bot,
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

interface SlackFinding {
  titulo:      string
  descripcion: string
  canales:     string[]
  evidencia:   string
  severidad:   "alta" | "media" | "baja"
}

const SEVERITY_STYLES: Record<SlackFinding["severidad"], string> = {
  alta:  "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  baja:  "bg-foreground/[0.06] text-foreground/50",
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "nunca"
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

/** Formatea un campo `date` (YYYY-MM-DD, sin hora) sin riesgo de correrse de día por timezone. */
function fmtDateOnly(isoDate: string): string {
  const [y, m, d] = isoDate.split("-")
  return `${d}/${m}/${y}`
}

interface DailyBriefing {
  date:              string
  findings:          SlackFinding[]
  messages_analyzed: number
}

interface ChatMessage {
  role:    "user" | "assistant"
  content: string
}

function FindingsSection({ title, subtitle, findings }: { title: string; subtitle?: string; findings: SlackFinding[] }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">
        {title}{subtitle && <span className="ml-2 normal-case font-normal tracking-normal text-foreground/30">{subtitle}</span>}
      </p>
      {findings.length === 0 ? (
        <div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] px-4 py-6 text-center text-sm text-foreground/40">
          No se encontraron patrones relevantes en los mensajes analizados.
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((f, i) => (
            <div key={i} className="rounded-2xl border border-foreground/[0.07] bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-foreground">{f.titulo}</h3>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", SEVERITY_STYLES[f.severidad])}>
                  {f.severidad}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/60">{f.descripcion}</p>
              <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
                <Quote className="h-3 w-3 shrink-0 mt-0.5 text-foreground/30" />
                <p className="text-[12px] italic text-foreground/50">{f.evidencia}</p>
              </div>
              {f.canales.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {f.canales.map(c => (
                    <span key={c} className="rounded-md border border-foreground/[0.10] bg-foreground/[0.03] px-2 py-0.5 text-[11px] text-foreground/50">
                      #{c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
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

  const [slackUserConnected, setSlackUserConnected] = useState<boolean | undefined>(undefined) // undefined = cargando
  const [slackConnecting,    setSlackConnecting]    = useState(false)

  const [communityFindings, setCommunityFindings] = useState<SlackFinding[] | null>(null)
  const [analyzing,         setAnalyzing]         = useState(false)
  const [analyzeMsg,        setAnalyzeMsg]        = useState<string | null>(null)

  const [dailyBriefing, setDailyBriefing] = useState<DailyBriefing | null>(null)
  const [leadsBriefing, setLeadsBriefing] = useState<DailyBriefing | null>(null)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput,    setChatInput]    = useState("")
  const [chatSending,  setChatSending]  = useState(false)
  const [chatLoaded,   setChatLoaded]   = useState(false)

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

  const fetchSlackUserStatus = useCallback(async () => {
    const headers = await getAuthHeader()
    if (!headers) return
    const res = await fetch("/api/admin/omni/slack/user-status", { headers })
    if (!res.ok) return
    const json = await res.json()
    setSlackUserConnected(!!json.connection)
  }, [getAuthHeader])

  const fetchDailyBriefing = useCallback(async () => {
    const headers = await getAuthHeader()
    if (!headers) return
    const res = await fetch("/api/admin/omni/briefing", { headers })
    if (!res.ok) return
    const json = await res.json()
    setDailyBriefing(json.briefing ?? null)
    setLeadsBriefing(json.leadsBriefing ?? null)
  }, [getAuthHeader])

  const fetchChatHistory = useCallback(async () => {
    const headers = await getAuthHeader()
    if (!headers) return
    const res = await fetch("/api/admin/omni/chat", { headers })
    if (res.ok) {
      const json = await res.json()
      setChatMessages(json.messages ?? [])
    }
    setChatLoaded(true)
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
    fetchSlackUserStatus()
    fetchDailyBriefing()
    fetchChatHistory()

    if (searchParams.get("omni_ig_success")) setIgSyncMsg("Instagram conectado — ya podés sincronizar.")
    if (searchParams.get("omni_ig_error"))   setIgSyncMsg(`Error al conectar Instagram (${searchParams.get("omni_ig_error")}).`)
    if (searchParams.get("omni_slack_success")) setSlackSyncMsg("Slack conectado como Ann — ya podés sincronizar.")
    if (searchParams.get("omni_slack_error"))   setSlackSyncMsg(`Error al conectar Slack (${searchParams.get("omni_slack_error")}).`)
  }, [allowed, fetchIgStatus, fetchSlackStatus, fetchSlackUserStatus, fetchDailyBriefing, fetchChatHistory, searchParams])

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

  const connectSlack = async () => {
    setSlackConnecting(true)
    try {
      const headers = await getAuthHeader()
      if (!headers) return
      const res = await fetch("/api/admin/omni/slack/connect", { headers })
      const json = await res.json()
      if (res.ok && json.url) window.location.href = json.url
      else setSlackSyncMsg(json.error ?? "No se pudo iniciar la conexión")
    } finally {
      setSlackConnecting(false)
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

  const analyzeSlack = async () => {
    setAnalyzing(true)
    setAnalyzeMsg(null)
    try {
      const headers = await getAuthHeader()
      if (!headers) return
      const res = await fetch("/api/admin/omni/slack/analyze", { method: "POST", headers })
      const json = await res.json()
      if (res.ok) {
        setCommunityFindings(json.findings)
        setAnalyzeMsg(`Analizados ${json.messagesAnalyzed} mensajes — ${json.findings.length} hallazgos.`)
      } else {
        setAnalyzeMsg(json.error ?? "Error al analizar")
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const sendChatMessage = async () => {
    const text = chatInput.trim()
    if (!text || chatSending) return
    setChatInput("")
    setChatMessages(prev => [...prev, { role: "user", content: text }])
    setChatSending(true)
    try {
      const headers = await getAuthHeader()
      if (!headers) return
      const res = await fetch("/api/admin/omni/chat", {
        method:  "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body:    JSON.stringify({ message: text }),
      })
      const json = await res.json()
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: res.ok ? json.reply : (json.error ?? "Error al responder"),
      }])
    } finally {
      setChatSending(false)
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
                  {!slackUserConnected
                    ? (slackUserConnected === undefined ? "Verificando…" : "No conectado — falta autorizar como Ann")
                    : slackStatus
                    ? `${slackStatus.channels} canales · ${slackStatus.messages} mensajes · última sync: ${fmtDateTime(slackStatus.lastSyncedAt)}`
                    : "Verificando…"}
                </p>
              </div>
              {slackUserConnected && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />}
            </div>
            <div className="mt-3 flex gap-2">
              {!slackUserConnected && (
                <button
                  onClick={connectSlack}
                  disabled={slackConnecting}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-[#ffde21] px-3 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40"
                >
                  {slackConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Conectar como Ann
                </button>
              )}
              {slackUserConnected && (
                <button
                  onClick={syncSlack}
                  disabled={slackSyncing}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-3 text-[12px] font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/25 transition-all disabled:opacity-40"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", slackSyncing && "animate-spin")} />
                  Sincronizar
                </button>
              )}
              {slackUserConnected && !!slackStatus?.messages && (
                <button
                  onClick={analyzeSlack}
                  disabled={analyzing}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-[#ffde21] px-3 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40"
                >
                  {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Analizar
                </button>
              )}
            </div>
            {slackSyncMsg && <p className="mt-2 text-[11.5px] text-foreground/45">{slackSyncMsg}</p>}
            {analyzeMsg && <p className="mt-1 text-[11.5px] text-foreground/45">{analyzeMsg}</p>}
          </div>

        </div>
        <p className="mt-2 text-[12px] text-foreground/35">
          Requiere el permiso de mensajes habilitado en Meta (Instagram) y los scopes de lectura
          agregados al bot de Slack — ver la conversación del setup para el detalle de cada uno.
        </p>
      </div>

      {/* Preguntale a Omni */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">Preguntale a Omni</p>
        <div className="rounded-2xl border border-foreground/[0.07] bg-card">
          <div className="max-h-[420px] min-h-[160px] overflow-y-auto p-4 space-y-3">
            {!chatLoaded ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-foreground/30" />
              </div>
            ) : chatMessages.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-foreground/35">
                Preguntale algo sobre la comunidad — ej: "¿cómo cerró Andrés?" o "qué objeciones aparecieron esta semana".
              </p>
            ) : (
              chatMessages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-[#ffde21] text-black"
                      : "bg-foreground/[0.05] text-foreground/80",
                  )}>
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {chatSending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl bg-foreground/[0.05] px-3.5 py-2 text-foreground/40">
                  <Bot className="h-3.5 w-3.5" />
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-foreground/[0.07] p-3">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
              placeholder="Preguntale a Omni…"
              disabled={chatSending}
              className="flex-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={sendChatMessage}
              disabled={chatSending || !chatInput.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffde21] text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Briefing diario (guardado por el cron) */}
      {dailyBriefing && (
        <FindingsSection
          title="Briefing de hoy — Comunidad"
          subtitle={`${fmtDateOnly(dailyBriefing.date)} · ${dailyBriefing.messages_analyzed} mensajes`}
          findings={dailyBriefing.findings}
        />
      )}

      {/* Briefing diario de leads vs. cierres (guardado por el cron) */}
      {leadsBriefing && (
        <FindingsSection
          title="Briefing de hoy — Leads y cierres"
          subtitle={`${fmtDateOnly(leadsBriefing.date)} · ${leadsBriefing.messages_analyzed} leads`}
          findings={leadsBriefing.findings}
        />
      )}

      {/* Hallazgos de comunidad (análisis manual) */}
      {communityFindings && (
        <FindingsSection title="Hallazgos — Comunidad" findings={communityFindings} />
      )}

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
