"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Sparkles, MessageCircle, FileText, Megaphone, DollarSign, Cog,
  Instagram, Slack, RefreshCw, Loader2, CheckCircle2, Wand2, Quote,
  Activity, AlertTriangle, Clock, Star, TrendingUp, LayoutDashboard,
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

interface ProspectRisk {
  prospecto: string
  estado:    "en_riesgo" | "irremontable"
  situacion: string
  principio: string
  evidencia: string
  accion:    string
  severidad: "alta" | "media" | "baja"
}

interface ConversationAnalysisData {
  estado:      "sano" | "en_riesgo" | "irremontable"
  situacion:   string
  principio:   string
  evidencia:   string
  accion:      string
  severidad:   "alta" | "media" | "baja"
  analyzed_at: string
}

interface ConversationItem {
  id:                    string
  participant_username:  string | null
  last_message_at:       string | null
  last_message_from:     string | null
  last_message_preview:  string | null
  lead_rating:           number | null
  is_customer:           boolean
  analysis:              ConversationAnalysisData | null
}

const SEVERITY_STYLES: Record<"alta" | "media" | "baja", string> = {
  alta:  "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  baja:  "bg-foreground/[0.06] text-foreground/50",
}

const IRREMONTABLE_STYLE = "bg-foreground/[0.10] text-foreground/60 dark:bg-foreground/[0.08] dark:text-foreground/50"
const SANO_STYLE = "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"

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

interface ProspectingBriefing {
  date:              string
  findings:          ProspectRisk[]
  messages_analyzed: number
}

interface ProspectingMetrics {
  activeConversations:     number
  staleConversations:      number
  avgResponseMinutes:      number | null
  ratingDistribution:      Record<string, number>
  leadsAnalyzed:           number
  conversionRate:          number | null
  ratingDistributionToday: Record<string, number>
  leadsToday:              number
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

function StatCard({ icon: Icon, label, value, sublabel, tone }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sublabel?: string
  tone?: "warn"
}) {
  return (
    <div className="rounded-2xl border border-foreground/[0.07] bg-card p-4">
      <div className="flex items-center gap-2">
        <span className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg",
          tone === "warn" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-foreground/[0.05] text-foreground/50",
        )}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">{label}</p>
      </div>
      <p className="mt-2.5 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {sublabel && <p className="mt-0.5 text-[11.5px] text-foreground/40">{sublabel}</p>}
    </div>
  )
}

function ProspectingMetricsSection({ metrics }: { metrics: ProspectingMetrics | null }) {
  if (!metrics) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-foreground/[0.07] bg-foreground/[0.03]" />
        ))}
      </div>
    )
  }

  const ratings = [5, 4, 3, 2, 1]

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Conversaciones activas"
          value={String(metrics.activeConversations)}
          sublabel="últimos 30 días"
        />
        <StatCard
          icon={AlertTriangle}
          label="Estancadas"
          value={String(metrics.staleConversations)}
          sublabel="el lead escribió y no se le respondió hace +24hs"
          tone={metrics.staleConversations > 0 ? "warn" : undefined}
        />
        <StatCard
          icon={Clock}
          label="Tiempo de respuesta"
          value={metrics.avgResponseMinutes == null ? "—" : metrics.avgResponseMinutes < 60
            ? `${metrics.avgResponseMinutes}m`
            : `${(metrics.avgResponseMinutes / 60).toFixed(1)}h`}
          sublabel="promedio de Ann"
        />
        <StatCard
          icon={TrendingUp}
          label="Conversión"
          value={metrics.conversionRate == null ? "—" : `${metrics.conversionRate.toFixed(0)}%`}
          sublabel={`${metrics.leadsAnalyzed} leads, últimos 60 días`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <RatingBreakdown title="Leads por rating (hoy)" subtitle={`${metrics.leadsToday} leads`} distribution={metrics.ratingDistributionToday} ratings={ratings} />
        <RatingBreakdown title="Leads por rating (60 días)" subtitle={`${metrics.leadsAnalyzed} leads`} distribution={metrics.ratingDistribution} ratings={ratings} />
      </div>
    </div>
  )
}

function RatingBreakdown({ title, subtitle, distribution, ratings }: {
  title: string
  subtitle: string
  distribution: Record<string, number>
  ratings: number[]
}) {
  const maxRating = Math.max(1, ...ratings.map(r => distribution[String(r)] ?? 0))
  return (
    <div className="rounded-2xl border border-foreground/[0.07] bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Star className="h-3.5 w-3.5 text-foreground/40" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">{title}</p>
        <span className="ml-auto text-[11px] text-foreground/30">{subtitle}</span>
      </div>
      <div className="space-y-1.5">
        {ratings.map(r => {
          const count = distribution[String(r)] ?? 0
          const pct = Math.round((count / maxRating) * 100)
          return (
            <div key={r} className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[11px] text-foreground/40">{r}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                <div className="h-full rounded-full bg-[#ffde21]" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-6 shrink-0 text-right text-[11px] text-foreground/40">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProspectRiskSection({ briefing, analyzing, onRefresh }: {
  briefing:  ProspectingBriefing | null
  analyzing: boolean
  onRefresh: () => void
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">
          Riesgos de prospección (en bloque)
          {briefing && (
            <span className="ml-2 normal-case font-normal tracking-normal text-foreground/30">
              {fmtDateOnly(briefing.date)} · {briefing.messages_analyzed} conversaciones analizadas
            </span>
          )}
        </p>
        <button
          onClick={onRefresh}
          disabled={analyzing}
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-2.5 text-[11.5px] font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/25 transition-all disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3 w-3", analyzing && "animate-spin")} />
          Actualizar
        </button>
      </div>
      {!briefing ? (
        <div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] px-4 py-6 text-center text-sm text-foreground/40">
          Todavía no corrió el análisis de riesgo de prospección — corré "Actualizar" o esperá al briefing diario.
        </div>
      ) : briefing.findings.length === 0 ? (
        <div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] px-4 py-6 text-center text-sm text-foreground/40">
          Ningún prospecto activo en riesgo hoy, según los principios de Ann.
        </div>
      ) : (
        <div className="space-y-3">
          {briefing.findings.map((f, i) => (
            <div key={i} className="rounded-2xl border border-foreground/[0.07] bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-foreground">@{f.prospecto}</h3>
                <span className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  f.estado === "irremontable" ? IRREMONTABLE_STYLE : SEVERITY_STYLES[f.severidad],
                )}>
                  {f.estado === "irremontable" ? "irremontable" : f.severidad}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/60">{f.situacion}</p>
              <p className="mt-2 text-[12px] font-semibold text-foreground/50">Principio: <span className="font-normal text-foreground/60">{f.principio}</span></p>
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
                <Quote className="h-3 w-3 shrink-0 mt-0.5 text-foreground/30" />
                <p className="text-[12px] italic text-foreground/50">{f.evidencia}</p>
              </div>
              <div className={cn(
                "mt-2.5 rounded-lg border px-2.5 py-2",
                f.estado === "irremontable" ? "border-foreground/[0.10] bg-foreground/[0.03]" : "border-[#ffde21]/25 bg-[#ffde21]/[0.06]",
              )}>
                <p className="text-[12px] font-semibold text-foreground/80">{f.estado === "irremontable" ? "Aprendizaje: " : ""}{f.accion}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ConversationListCard({ conversation, analyzing, onAnalyze }: {
  conversation: ConversationItem
  analyzing:    boolean
  onAnalyze:    () => void
}) {
  const a = conversation.analysis
  const badgeStyle = a
    ? a.estado === "irremontable" ? IRREMONTABLE_STYLE : a.estado === "sano" ? SANO_STYLE : SEVERITY_STYLES[a.severidad]
    : ""

  return (
    <div className="rounded-2xl border border-foreground/[0.07] bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[14px] font-semibold text-foreground">@{conversation.participant_username ?? "desconocido"}</h3>
            {conversation.is_customer && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                cliente
              </span>
            )}
            {conversation.lead_rating != null && (
              <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-bold text-foreground/50">{conversation.lead_rating}★</span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-foreground/40">
            {conversation.last_message_from === "lead" ? "Último mensaje del prospecto" : "Último mensaje de Ann"} · {fmtDateTime(conversation.last_message_at)}
          </p>
          {conversation.last_message_preview && (
            <p className="mt-1.5 line-clamp-2 text-[12.5px] text-foreground/60">{conversation.last_message_preview}</p>
          )}
        </div>
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#ffde21] px-3 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40"
        >
          {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {a ? "Re-analizar" : "Analizar"}
        </button>
      </div>

      {a && (
        <div className="mt-3 border-t border-foreground/[0.07] pt-3">
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", badgeStyle)}>
              {a.estado === "en_riesgo" ? a.severidad : a.estado}
            </span>
            <span className="text-[11px] text-foreground/30">analizado {fmtDateTime(a.analyzed_at)}</span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/60">{a.situacion}</p>
          <p className="mt-1.5 text-[12px] font-semibold text-foreground/50">Principio: <span className="font-normal text-foreground/60">{a.principio}</span></p>
          <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
            <Quote className="h-3 w-3 shrink-0 mt-0.5 text-foreground/30" />
            <p className="text-[12px] italic text-foreground/50">{a.evidencia}</p>
          </div>
          <div className="mt-1.5 rounded-lg border border-[#ffde21]/25 bg-[#ffde21]/[0.06] px-2.5 py-2">
            <p className="text-[12px] font-semibold text-foreground/80">{a.accion}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminOmniView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [allowed, setAllowed] = useState<boolean | null>(null) // null = verificando
  const [activeTab, setActiveTab] = useState<"resumen" | "conversaciones" | "comunidad">("resumen")

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

  const [dailyBriefing,       setDailyBriefing]       = useState<DailyBriefing | null>(null)
  const [leadsBriefing,       setLeadsBriefing]       = useState<DailyBriefing | null>(null)
  const [prospectingBriefing, setProspectingBriefing] = useState<ProspectingBriefing | null>(null)
  const [prospectingMetrics,  setProspectingMetrics]  = useState<ProspectingMetrics | null>(null)
  const [prospectingAnalyzing, setProspectingAnalyzing] = useState(false)

  const [conversations,     setConversations]     = useState<ConversationItem[] | null>(null)
  const [analyzingConvoId,  setAnalyzingConvoId]  = useState<string | null>(null)

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
    setProspectingBriefing(json.prospectingBriefing ?? null)
  }, [getAuthHeader])

  const fetchProspectingMetrics = useCallback(async () => {
    const headers = await getAuthHeader()
    if (!headers) return
    const res = await fetch("/api/admin/omni/prospecting-metrics", { headers })
    if (!res.ok) return
    setProspectingMetrics(await res.json())
  }, [getAuthHeader])

  const fetchConversations = useCallback(async () => {
    const headers = await getAuthHeader()
    if (!headers) return
    const res = await fetch("/api/admin/omni/prospecting/conversations", { headers })
    if (!res.ok) return
    const json = await res.json()
    setConversations(json.conversations ?? [])
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
    fetchProspectingMetrics()
    fetchConversations()

    if (searchParams.get("omni_ig_success")) setIgSyncMsg("Instagram conectado — ya podés sincronizar.")
    if (searchParams.get("omni_ig_error"))   setIgSyncMsg(`Error al conectar Instagram (${searchParams.get("omni_ig_error")}).`)
    if (searchParams.get("omni_slack_success")) setSlackSyncMsg("Slack conectado como Ann — ya podés sincronizar.")
    if (searchParams.get("omni_slack_error"))   setSlackSyncMsg(`Error al conectar Slack (${searchParams.get("omni_slack_error")}).`)
  }, [allowed, fetchIgStatus, fetchSlackStatus, fetchSlackUserStatus, fetchDailyBriefing, fetchProspectingMetrics, fetchConversations, searchParams])

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
      if (res.ok) fetchConversations()
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

  const analyzeProspecting = async () => {
    setProspectingAnalyzing(true)
    try {
      const headers = await getAuthHeader()
      if (!headers) return
      const res = await fetch("/api/admin/omni/prospecting/analyze", { method: "POST", headers })
      const json = await res.json()
      if (res.ok) {
        setProspectingBriefing(json)
      }
    } finally {
      setProspectingAnalyzing(false)
    }
  }

  const analyzeConversation = async (id: string) => {
    setAnalyzingConvoId(id)
    try {
      const headers = await getAuthHeader()
      if (!headers) return
      const res = await fetch(`/api/admin/omni/prospecting/conversations/${id}/analyze`, { method: "POST", headers })
      const json = await res.json()
      if (res.ok) {
        setConversations(prev => (prev ?? []).map(c => c.id === id ? { ...c, analysis: json } : c))
      }
    } finally {
      setAnalyzingConvoId(null)
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-foreground/[0.07]">
        <button
          onClick={() => setActiveTab("resumen")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-1 pb-2.5 text-[13px] font-semibold transition-all",
            activeTab === "resumen" ? "border-[#ffde21] text-foreground" : "border-transparent text-foreground/40 hover:text-foreground/70",
          )}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Resumen
        </button>
        <button
          onClick={() => setActiveTab("conversaciones")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-1 pb-2.5 text-[13px] font-semibold transition-all",
            activeTab === "conversaciones" ? "border-[#ffde21] text-foreground" : "border-transparent text-foreground/40 hover:text-foreground/70",
          )}
        >
          <Instagram className="h-3.5 w-3.5" />
          Conversaciones
          {conversations && <span className="text-foreground/30">{conversations.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab("comunidad")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-1 pb-2.5 text-[13px] font-semibold transition-all",
            activeTab === "comunidad" ? "border-[#ffde21] text-foreground" : "border-transparent text-foreground/40 hover:text-foreground/70",
          )}
        >
          <Slack className="h-3.5 w-3.5" />
          Comunidad
        </button>
      </div>

      {activeTab === "resumen" && (
        <div className="space-y-8">

          {/* Prospección — métricas visibles, sin preguntar nada */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">Prospección</p>
            <ProspectingMetricsSection metrics={prospectingMetrics} />
          </div>

          {/* Riesgos de prospección — análisis en bloque, cron diario o "Actualizar" */}
          <ProspectRiskSection briefing={prospectingBriefing} analyzing={prospectingAnalyzing} onRefresh={analyzeProspecting} />

          {/* Briefing diario de leads vs. cierres (guardado por el cron) */}
          {leadsBriefing && (
            <FindingsSection
              title="Briefing de hoy — Leads y cierres"
              subtitle={`${fmtDateOnly(leadsBriefing.date)} · ${leadsBriefing.messages_analyzed} leads`}
              findings={leadsBriefing.findings}
            />
          )}

        </div>
      )}

      {activeTab === "conversaciones" && (
        <div className="space-y-8">

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
            <p className="mt-2 text-[12px] text-foreground/35">
              Requiere el permiso de mensajes habilitado en Meta (Instagram) — ver la conversación del setup para el detalle.
            </p>
          </div>

          {/* Todas las conversaciones — elegís cuál analizar */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">
              Todas las conversaciones
              {conversations && <span className="ml-2 normal-case font-normal tracking-normal text-foreground/30">{conversations.length}</span>}
            </p>
            {conversations === null ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-[84px] animate-pulse rounded-2xl border border-foreground/[0.07] bg-foreground/[0.03]" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] px-4 py-6 text-center text-sm text-foreground/40">
                No hay conversaciones sincronizadas todavía.
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map(c => (
                  <ConversationListCard
                    key={c.id}
                    conversation={c}
                    analyzing={analyzingConvoId === c.id}
                    onAnalyze={() => analyzeConversation(c.id)}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === "comunidad" && (
        <div className="space-y-8">

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
            <p className="mt-2 text-[12px] text-foreground/35">
              Requiere los scopes de lectura agregados al bot de Slack — ver la conversación del setup para el detalle.
            </p>
          </div>

          {/* Briefing diario (guardado por el cron) */}
          {dailyBriefing && (
            <FindingsSection
              title="Briefing de hoy — Comunidad"
              subtitle={`${fmtDateOnly(dailyBriefing.date)} · ${dailyBriefing.messages_analyzed} mensajes`}
              findings={dailyBriefing.findings}
            />
          )}

          {/* Hallazgos de comunidad (análisis manual) */}
          {communityFindings && (
            <FindingsSection title="Hallazgos — Comunidad" findings={communityFindings} />
          )}

        </div>
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
