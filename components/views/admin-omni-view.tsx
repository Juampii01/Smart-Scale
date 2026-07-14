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

interface ChannelAnalysisData {
  estado:      "sano" | "en_riesgo"
  situacion:   string
  principio:   string
  evidencia:   string
  accion:      string
  severidad:   "alta" | "media" | "baja"
  analyzed_at: string
}

interface ChannelItem {
  id:                string
  name:              string
  is_client_channel: boolean
  message_count:     number
  synced_at:         string | null
  analysis:          ChannelAnalysisData | null
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

interface ProspectingContextData {
  workflow_inbound:  string
  workflow_outbound: string
  notas_generales:   string
  updated_at:        string | null
}

interface ProspectingPattern {
  id:                    string
  conversation_id:       string | null
  participant_username:  string | null
  situacion:             string
  enfoque:               string
  resultado:             "cerro" | "no_cerro" | "pendiente"
  correccion:            string | null
  created_at:            string
}

const RESULTADO_STYLES: Record<ProspectingPattern["resultado"], string> = {
  cerro:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  no_cerro:  "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  pendiente: "bg-foreground/[0.06] text-foreground/50",
}
const RESULTADO_LABELS: Record<ProspectingPattern["resultado"], string> = {
  cerro: "cerró", no_cerro: "no cerró", pendiente: "pendiente",
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

interface UnansweredItem {
  nombre:              string
  last_message_at:     string
  horas_sin_responder: number
}

interface UnansweredBriefing {
  date:              string
  findings:          { instagram: UnansweredItem[]; slack: UnansweredItem[] }
  messages_analyzed: number
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

function ProspectRiskSection({ briefing, analyzing, error, onRefresh }: {
  briefing:  ProspectingBriefing | null
  analyzing: boolean
  error:     string | null
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
      {error && (
        <p className="mb-2 text-[12px] text-red-700 dark:text-red-400">{error}</p>
      )}
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

function fmtHoursSince(h: number): string {
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d ${h % 24}h`
}

function UnansweredSummarySection({ briefing, analyzing, error, onRefresh }: {
  briefing:  UnansweredBriefing | null
  analyzing: boolean
  error:     string | null
  onRefresh: () => void
}) {
  const instagram = briefing?.findings.instagram ?? []
  const slack      = briefing?.findings.slack ?? []

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">
          Conversaciones sin responder
          {briefing && (
            <span className="ml-2 normal-case font-normal tracking-normal text-foreground/30">
              {fmtDateOnly(briefing.date)} · {briefing.messages_analyzed} pendientes
            </span>
          )}
        </p>
        <button
          onClick={onRefresh}
          disabled={analyzing}
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-2.5 text-[11.5px] font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/25 transition-all disabled:opacity-40"
        >
          {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          Hacer resumen
        </button>
      </div>

      {error && (
        <p className="mb-2 text-[12px] text-red-700 dark:text-red-400">{error}</p>
      )}

      {!briefing ? (
        <div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] px-4 py-6 text-center text-sm text-foreground/40">
          Todavía no corrió el resumen — corré "Hacer resumen" o esperá al de las 19hs (hora Miami).
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-foreground/[0.07] bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Instagram className="h-3.5 w-3.5 text-foreground/40" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">Instagram</p>
              <span className="ml-auto text-[11px] text-foreground/30">{instagram.length}</span>
            </div>
            {instagram.length === 0 ? (
              <p className="text-[12.5px] text-foreground/35">Todo respondido.</p>
            ) : (
              <div className="space-y-1.5">
                {instagram.map(item => (
                  <div key={item.nombre} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="truncate text-foreground/70">@{item.nombre}</span>
                    <span className="shrink-0 text-foreground/35">{fmtHoursSince(item.horas_sin_responder)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-foreground/[0.07] bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Slack className="h-3.5 w-3.5 text-foreground/40" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">Slack</p>
              <span className="ml-auto text-[11px] text-foreground/30">{slack.length}</span>
            </div>
            {slack.length === 0 ? (
              <p className="text-[12.5px] text-foreground/35">Todo respondido.</p>
            ) : (
              <div className="space-y-1.5">
                {slack.map(item => (
                  <div key={item.nombre} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="truncate text-foreground/70">#{item.nombre}</span>
                    <span className="shrink-0 text-foreground/35">{fmtHoursSince(item.horas_sin_responder)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ConversationListCard({ conversation, analyzing, onAnalyze, onSubmitCorrection }: {
  conversation: ConversationItem
  analyzing:    boolean
  onAnalyze:    () => void
  onSubmitCorrection: (data: { situacion: string; enfoque: string; resultado: ProspectingPattern["resultado"]; correccion: string }) => Promise<boolean>
}) {
  const a = conversation.analysis
  const badgeStyle = a
    ? a.estado === "irremontable" ? IRREMONTABLE_STYLE : a.estado === "sano" ? SANO_STYLE : SEVERITY_STYLES[a.severidad]
    : ""

  const [correcting,  setCorrecting]  = useState(false)
  const [situacion,   setSituacion]   = useState("")
  const [enfoque,     setEnfoque]     = useState("")
  const [resultado,   setResultado]   = useState<ProspectingPattern["resultado"]>("pendiente")
  const [correccion,  setCorreccion]  = useState("")
  const [submitting,  setSubmitting]  = useState(false)
  const [saved,       setSaved]       = useState(false)

  function openCorrecting() {
    setSituacion(a?.situacion ?? "")
    setEnfoque("")
    setResultado("pendiente")
    setCorreccion("")
    setSaved(false)
    setCorrecting(true)
  }

  async function submitCorrecting() {
    if (!situacion.trim() || !enfoque.trim()) return
    setSubmitting(true)
    const ok = await onSubmitCorrection({ situacion, enfoque, resultado, correccion })
    setSubmitting(false)
    if (ok) {
      setSaved(true)
      setTimeout(() => setCorrecting(false), 1000)
    }
  }

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
        <div className="flex shrink-0 items-center gap-1.5">
          {a && (
            <button
              onClick={() => (correcting ? setCorrecting(false) : openCorrecting())}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-3 text-[12px] font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/25 transition-all"
            >
              Corregir
            </button>
          )}
          <button
            onClick={onAnalyze}
            disabled={analyzing}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[#ffde21] px-3 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40"
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {a ? "Re-analizar" : "Analizar"}
          </button>
        </div>
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

      {correcting && (
        <div className="mt-3 space-y-2.5 rounded-xl border border-foreground/[0.10] bg-foreground/[0.02] p-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">Registrar patrón de prospección</p>
          <div>
            <label className="text-[11px] font-semibold text-foreground/50">Situación</label>
            <textarea
              value={situacion}
              onChange={e => setSituacion(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-foreground/[0.10] bg-background px-2.5 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-[#ffde21]/40"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-foreground/50">Qué enfoque/mensaje se usó</label>
            <textarea
              value={enfoque}
              onChange={e => setEnfoque(e.target.value)}
              rows={2}
              placeholder="Ej: le mandé el offer doc directo sin agendar llamada"
              className="mt-1 w-full rounded-lg border border-foreground/[0.10] bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/40"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-foreground/50">Resultado</label>
            <div className="mt-1 flex gap-1.5">
              {(["cerro", "no_cerro", "pendiente"] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResultado(r)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-all",
                    resultado === r ? RESULTADO_STYLES[r] : "bg-foreground/[0.04] text-foreground/40 hover:text-foreground/60"
                  )}
                >
                  {RESULTADO_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-foreground/50">Corrección para la IA (opcional)</label>
            <textarea
              value={correccion}
              onChange={e => setCorreccion(e.target.value)}
              rows={2}
              placeholder="Ej: acá la IA sugirió esperar 4 semanas, pero este tipo de lead se enfría en días"
              className="mt-1 w-full rounded-lg border border-foreground/[0.10] bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/40"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCorrecting(false)}
              className="h-8 rounded-lg px-3 text-[12px] font-medium text-foreground/50 hover:text-foreground transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitCorrecting}
              disabled={submitting || !situacion.trim() || !enfoque.trim()}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-[#ffde21] px-3 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
              {saved ? "Guardado" : "Guardar patrón"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChannelListCard({ channel, analyzing, onAnalyze }: {
  channel:   ChannelItem
  analyzing: boolean
  onAnalyze: () => void
}) {
  const a = channel.analysis
  const badgeStyle = a ? (a.estado === "sano" ? SANO_STYLE : SEVERITY_STYLES[a.severidad]) : ""

  return (
    <div className="rounded-2xl border border-foreground/[0.07] bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[14px] font-semibold text-foreground">#{channel.name}</h3>
            {channel.is_client_channel && (
              <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                cliente
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-foreground/40">{channel.message_count} mensajes sincronizados</p>
        </div>
        <button
          onClick={onAnalyze}
          disabled={analyzing || channel.message_count === 0}
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

/** Patrón cargado suelto, sin partir de un análisis de conversación puntual. */
function NewPatternForm({ onSubmit, onDone }: {
  onSubmit: (data: { situacion: string; enfoque: string; resultado: ProspectingPattern["resultado"]; correccion?: string }) => Promise<boolean>
  onDone:   () => void
}) {
  const [situacion,  setSituacion]  = useState("")
  const [enfoque,    setEnfoque]    = useState("")
  const [resultado,  setResultado]  = useState<ProspectingPattern["resultado"]>("pendiente")
  const [correccion, setCorreccion] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!situacion.trim() || !enfoque.trim()) return
    setSubmitting(true)
    const ok = await onSubmit({ situacion, enfoque, resultado, correccion: correccion || undefined })
    setSubmitting(false)
    if (ok) onDone()
  }

  return (
    <div className="mb-3 space-y-2.5 rounded-xl border border-foreground/[0.10] bg-foreground/[0.02] p-3">
      <div>
        <label className="text-[11px] font-semibold text-foreground/50">Situación</label>
        <textarea
          value={situacion}
          onChange={e => setSituacion(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-foreground/[0.10] bg-background px-2.5 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-[#ffde21]/40"
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-foreground/50">Qué enfoque/mensaje se usó</label>
        <textarea
          value={enfoque}
          onChange={e => setEnfoque(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-foreground/[0.10] bg-background px-2.5 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-[#ffde21]/40"
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-foreground/50">Resultado</label>
        <div className="mt-1 flex gap-1.5">
          {(["cerro", "no_cerro", "pendiente"] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setResultado(r)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-all",
                resultado === r ? RESULTADO_STYLES[r] : "bg-foreground/[0.04] text-foreground/40 hover:text-foreground/60"
              )}
            >
              {RESULTADO_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-foreground/50">Corrección para la IA (opcional)</label>
        <textarea
          value={correccion}
          onChange={e => setCorreccion(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-foreground/[0.10] bg-background px-2.5 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-[#ffde21]/40"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !situacion.trim() || !enfoque.trim()}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[#ffde21] px-3 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Guardar patrón
        </button>
      </div>
    </div>
  )
}

export function AdminOmniView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [allowed, setAllowed] = useState<boolean | null>(null) // null = verificando
  const [activeTab, setActiveTab] = useState<"resumen" | "conversaciones" | "comunidad" | "prospeccion">("resumen")

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
  const [prospectingError,    setProspectingError]     = useState<string | null>(null)

  const [unansweredBriefing,  setUnansweredBriefing]  = useState<UnansweredBriefing | null>(null)
  const [unansweredAnalyzing, setUnansweredAnalyzing] = useState(false)
  const [unansweredError,     setUnansweredError]     = useState<string | null>(null)

  const [conversations,      setConversations]      = useState<ConversationItem[] | null>(null)
  // Set (no un id único) para soportar analizar varias conversaciones en
  // paralelo sin que el botón de una se "libere" mientras la suya sigue en vuelo.
  const [analyzingConvoIds,  setAnalyzingConvoIds]  = useState<Set<string>>(new Set())
  const [conversationsError, setConversationsError] = useState<string | null>(null)

  const [channels,           setChannels]           = useState<ChannelItem[] | null>(null)
  const [analyzingChannelIds, setAnalyzingChannelIds] = useState<Set<string>>(new Set())
  const [channelsError,      setChannelsError]      = useState<string | null>(null)

  const [prospectingContext,        setProspectingContext]        = useState<ProspectingContextData | null>(null)
  const [prospectingContextSaving,  setProspectingContextSaving]  = useState(false)
  const [prospectingContextMsg,     setProspectingContextMsg]     = useState<string | null>(null)
  const [prospectingContextError,   setProspectingContextError]   = useState<string | null>(null)

  const [patterns,      setPatterns]      = useState<ProspectingPattern[] | null>(null)
  const [patternsError, setPatternsError] = useState<string | null>(null)
  const [newPatternOpen, setNewPatternOpen] = useState(false)

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
    setUnansweredBriefing(json.unansweredBriefing ?? null)
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

  const fetchChannels = useCallback(async () => {
    const headers = await getAuthHeader()
    if (!headers) return
    const res = await fetch("/api/admin/omni/slack/channels", { headers })
    if (!res.ok) return
    const json = await res.json()
    setChannels(json.channels ?? [])
  }, [getAuthHeader])

  const fetchProspectingContext = useCallback(async () => {
    setProspectingContextError(null)
    try {
      const headers = await getAuthHeader()
      if (!headers) { setProspectingContextError("Sesión vencida — recargá la página."); return }
      const res = await fetch("/api/admin/omni/prospecting/context", { headers })
      const json = await res.json()
      if (res.ok) setProspectingContext(json.context)
      else setProspectingContextError(json.error ?? `No se pudo cargar el contexto (${res.status})`)
    } catch (e) {
      setProspectingContextError(e instanceof Error ? e.message : "Error de red")
    }
  }, [getAuthHeader])

  const saveProspectingContext = async () => {
    if (!prospectingContext) return
    setProspectingContextSaving(true)
    setProspectingContextMsg(null)
    setProspectingContextError(null)
    try {
      const headers = await getAuthHeader()
      if (!headers) { setProspectingContextError("Sesión vencida — recargá la página."); return }
      const res = await fetch("/api/admin/omni/prospecting/context", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(prospectingContext),
      })
      const json = await res.json()
      if (res.ok) setProspectingContextMsg("Guardado ✓")
      else setProspectingContextError(json.error ?? `No se pudo guardar (${res.status})`)
    } catch (e) {
      setProspectingContextError(e instanceof Error ? e.message : "Error de red al guardar")
    } finally {
      setProspectingContextSaving(false)
      setTimeout(() => setProspectingContextMsg(null), 2000)
    }
  }

  const fetchPatterns = useCallback(async () => {
    setPatternsError(null)
    try {
      const headers = await getAuthHeader()
      if (!headers) { setPatternsError("Sesión vencida — recargá la página."); return }
      const res = await fetch("/api/admin/omni/prospecting/patterns", { headers })
      const json = await res.json()
      if (res.ok) setPatterns(json.patterns ?? [])
      else setPatternsError(json.error ?? `No se pudieron cargar los patrones (${res.status})`)
    } catch (e) {
      setPatternsError(e instanceof Error ? e.message : "Error de red")
    }
  }, [getAuthHeader])

  const createPattern = async (data: {
    conversation_id?: string | null
    participant_username?: string | null
    situacion: string
    enfoque: string
    resultado: ProspectingPattern["resultado"]
    correccion?: string
  }): Promise<boolean> => {
    try {
      const headers = await getAuthHeader()
      if (!headers) return false
      const res = await fetch("/api/admin/omni/prospecting/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(data),
      })
      if (!res.ok) return false
      await fetchPatterns()
      return true
    } catch {
      return false
    }
  }

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
    fetchChannels()
    fetchProspectingContext()
    fetchPatterns()

    if (searchParams.get("omni_ig_success")) setIgSyncMsg("Instagram conectado — ya podés sincronizar.")
    if (searchParams.get("omni_ig_error"))   setIgSyncMsg(`Error al conectar Instagram (${searchParams.get("omni_ig_error")}).`)
    if (searchParams.get("omni_slack_success")) setSlackSyncMsg("Slack conectado como Ann — ya podés sincronizar.")
    if (searchParams.get("omni_slack_error"))   setSlackSyncMsg(`Error al conectar Slack (${searchParams.get("omni_slack_error")}).`)
  }, [allowed, fetchIgStatus, fetchSlackStatus, fetchSlackUserStatus, fetchDailyBriefing, fetchProspectingMetrics, fetchConversations, fetchChannels, fetchProspectingContext, fetchPatterns, searchParams])

  const connectInstagram = async () => {
    setIgLoading(true)
    try {
      const headers = await getAuthHeader()
      if (!headers) return
      const res = await fetch("/api/admin/omni/instagram/connect", { headers })
      const json = await res.json()
      if (res.ok && json.url) window.location.href = json.url
      else setIgSyncMsg(json.error ?? "No se pudo iniciar la conexión")
    } catch {
      setIgSyncMsg("Error de red al conectar Instagram")
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
    } catch {
      setIgSyncMsg("Error de red al sincronizar Instagram")
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
    } catch {
      setSlackSyncMsg("Error de red al conectar Slack")
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
        fetchChannels()
      } else {
        setSlackSyncMsg(json.error ?? "Error al sincronizar")
      }
    } catch {
      setSlackSyncMsg("Error de red al sincronizar Slack")
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
    } catch {
      setAnalyzeMsg("Error de red al analizar")
    } finally {
      setAnalyzing(false)
    }
  }

  const analyzeProspecting = async () => {
    setProspectingAnalyzing(true)
    setProspectingError(null)
    try {
      const headers = await getAuthHeader()
      if (!headers) { setProspectingError("Sesión vencida — recargá la página e iniciá sesión de nuevo."); return }
      const res = await fetch("/api/admin/omni/prospecting/analyze", { method: "POST", headers })
      const json = await res.json()
      if (res.ok) {
        setProspectingBriefing(json)
      } else {
        setProspectingError(json.error ?? `Error al actualizar (${res.status})`)
      }
    } catch (e) {
      setProspectingError(e instanceof Error ? e.message : "Error de red al actualizar")
    } finally {
      setProspectingAnalyzing(false)
    }
  }

  const analyzeUnanswered = async () => {
    setUnansweredAnalyzing(true)
    setUnansweredError(null)
    try {
      const headers = await getAuthHeader()
      if (!headers) { setUnansweredError("Sesión vencida — recargá la página e iniciá sesión de nuevo."); return }
      const res = await fetch("/api/admin/omni/unanswered-summary/analyze", { method: "POST", headers })
      const json = await res.json()
      if (res.ok) {
        setUnansweredBriefing(json)
      } else {
        setUnansweredError(json.error ?? `Error al hacer el resumen (${res.status})`)
      }
    } catch (e) {
      setUnansweredError(e instanceof Error ? e.message : "Error de red al hacer el resumen")
    } finally {
      setUnansweredAnalyzing(false)
    }
  }

  const analyzeConversation = async (id: string) => {
    setAnalyzingConvoIds(prev => new Set(prev).add(id))
    setConversationsError(null)
    try {
      const headers = await getAuthHeader()
      if (!headers) { setConversationsError("Sesión vencida — recargá la página e iniciá sesión de nuevo."); return }
      const res = await fetch(`/api/admin/omni/prospecting/conversations/${id}/analyze`, { method: "POST", headers })
      const json = await res.json()
      if (res.ok) {
        setConversations(prev => (prev ?? []).map(c => c.id === id ? { ...c, analysis: json } : c))
      } else {
        setConversationsError(json.error ?? `No se pudo analizar (${res.status})`)
      }
    } catch (e) {
      setConversationsError(e instanceof Error ? e.message : "Error de red al analizar")
    } finally {
      setAnalyzingConvoIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  const analyzeChannel = async (id: string) => {
    setAnalyzingChannelIds(prev => new Set(prev).add(id))
    setChannelsError(null)
    try {
      const headers = await getAuthHeader()
      if (!headers) { setChannelsError("Sesión vencida — recargá la página e iniciá sesión de nuevo."); return }
      const res = await fetch(`/api/admin/omni/slack/channels/${id}/analyze`, { method: "POST", headers })
      const json = await res.json()
      if (res.ok) {
        setChannels(prev => (prev ?? []).map(c => c.id === id ? { ...c, analysis: json } : c))
      } else {
        setChannelsError(json.error ?? `No se pudo analizar (${res.status})`)
      }
    } catch (e) {
      setChannelsError(e instanceof Error ? e.message : "Error de red al analizar")
    } finally {
      setAnalyzingChannelIds(prev => { const next = new Set(prev); next.delete(id); return next })
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Ann AI</h1>
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
        <button
          onClick={() => setActiveTab("prospeccion")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-1 pb-2.5 text-[13px] font-semibold transition-all",
            activeTab === "prospeccion" ? "border-[#ffde21] text-foreground" : "border-transparent text-foreground/40 hover:text-foreground/70",
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Prospección
          {patterns && <span className="text-foreground/30">{patterns.length}</span>}
        </button>
      </div>

      {activeTab === "resumen" && (
        <div className="space-y-8">

          {/* Conversaciones sin responder — cron de las 19hs (Miami) o a demanda */}
          <UnansweredSummarySection briefing={unansweredBriefing} analyzing={unansweredAnalyzing} error={unansweredError} onRefresh={analyzeUnanswered} />

          {/* Prospección — métricas visibles, sin preguntar nada */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">Prospección</p>
            <ProspectingMetricsSection metrics={prospectingMetrics} />
          </div>

          {/* Riesgos de prospección — análisis en bloque, cron diario o "Actualizar" */}
          <ProspectRiskSection briefing={prospectingBriefing} analyzing={prospectingAnalyzing} error={prospectingError} onRefresh={analyzeProspecting} />

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
            {conversationsError && (
              <p className="mb-2 text-[12px] text-red-700 dark:text-red-400">{conversationsError}</p>
            )}
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
                    analyzing={analyzingConvoIds.has(c.id)}
                    onAnalyze={() => analyzeConversation(c.id)}
                    onSubmitCorrection={data => createPattern({
                      conversation_id:       c.id,
                      participant_username:  c.participant_username,
                      ...data,
                    })}
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

          {/* Todos los canales — elegís cuál analizar */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">
              Todos los canales
              {channels && <span className="ml-2 normal-case font-normal tracking-normal text-foreground/30">{channels.length}</span>}
            </p>
            {channelsError && (
              <p className="mb-2 text-[12px] text-red-700 dark:text-red-400">{channelsError}</p>
            )}
            {channels === null ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-[70px] animate-pulse rounded-2xl border border-foreground/[0.07] bg-foreground/[0.03]" />
                ))}
              </div>
            ) : channels.length === 0 ? (
              <div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] px-4 py-6 text-center text-sm text-foreground/40">
                No hay canales sincronizados todavía.
              </div>
            ) : (
              <div className="space-y-3">
                {channels.map(c => (
                  <ChannelListCard
                    key={c.id}
                    channel={c}
                    analyzing={analyzingChannelIds.has(c.id)}
                    onAnalyze={() => analyzeChannel(c.id)}
                  />
                ))}
              </div>
            )}
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

      {activeTab === "prospeccion" && (
        <div className="space-y-8">

          {/* Contexto de prospección — workflow propio, separado del Cerebro de Ann */}
          <div className="rounded-2xl border border-foreground/[0.07] bg-card p-4">
            <p className="text-[14px] font-semibold text-foreground">Tu contexto de prospección</p>
            <p className="mt-0.5 text-[12px] text-foreground/40">
              Separado del Cerebro de Ann — esto ajusta cómo se redacta el feedback de cada análisis de conversación (traducido a lenguaje simple, con foco en pasar de conversación a offer doc), sin tocar el criterio base de Ann.
            </p>
            {prospectingContextError && (
              <p className="mt-2 text-[12px] text-red-700 dark:text-red-400">{prospectingContextError}</p>
            )}
            {prospectingContext === null ? (
              <div className="mt-3 h-32 animate-pulse rounded-xl bg-foreground/[0.03]" />
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-foreground/50">Workflow inbound</label>
                  <textarea
                    value={prospectingContext.workflow_inbound}
                    onChange={e => setProspectingContext({ ...prospectingContext, workflow_inbound: e.target.value })}
                    rows={3}
                    placeholder="Cómo trabajás los leads que llegan solos (DMs, formularios, etc.)"
                    className="mt-1 w-full rounded-lg border border-foreground/[0.10] bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground/50">Workflow outbound</label>
                  <textarea
                    value={prospectingContext.workflow_outbound}
                    onChange={e => setProspectingContext({ ...prospectingContext, workflow_outbound: e.target.value })}
                    rows={3}
                    placeholder="Cómo contactás vos a los leads (prospección activa)"
                    className="mt-1 w-full rounded-lg border border-foreground/[0.10] bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-foreground/25 focus:outline-none focus:ring-1 focus:ring-[#ffde21]/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground/50">Notas generales</label>
                  <textarea
                    value={prospectingContext.notas_generales}
                    onChange={e => setProspectingContext({ ...prospectingContext, notas_generales: e.target.value })}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-foreground/[0.10] bg-background px-2.5 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-[#ffde21]/40"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={saveProspectingContext}
                    disabled={prospectingContextSaving}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-[#ffde21] px-3 text-[12px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40"
                  >
                    {prospectingContextSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Guardar
                  </button>
                  {prospectingContextMsg && <span className="text-[12px] text-emerald-700 dark:text-emerald-400">{prospectingContextMsg}</span>}
                </div>
              </div>
            )}
          </div>

          {/* Patrones registrados — corpus estructurado situación → enfoque → resultado */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">
                Patrones registrados
                {patterns && <span className="ml-2 normal-case font-normal tracking-normal text-foreground/30">{patterns.length}</span>}
              </p>
              <button
                onClick={() => setNewPatternOpen(v => !v)}
                className="flex h-7 items-center gap-1.5 rounded-lg border border-foreground/[0.10] px-2.5 text-[11.5px] font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/25 transition-all"
              >
                {newPatternOpen ? "Cancelar" : "+ Nuevo patrón"}
              </button>
            </div>

            {newPatternOpen && (
              <NewPatternForm onSubmit={createPattern} onDone={() => setNewPatternOpen(false)} />
            )}

            {patternsError && (
              <p className="mb-2 text-[12px] text-red-700 dark:text-red-400">{patternsError}</p>
            )}
            {patterns === null ? (
              <div className="space-y-2">
                {[0, 1].map(i => <div key={i} className="h-16 animate-pulse rounded-xl border border-foreground/[0.07] bg-foreground/[0.03]" />)}
              </div>
            ) : patterns.length === 0 ? (
              <div className="rounded-2xl border border-foreground/[0.07] bg-foreground/[0.02] px-4 py-6 text-center text-sm text-foreground/40">
                Todavía no hay patrones registrados — se van sumando desde el botón "Corregir" en cada análisis, o sueltos con "+ Nuevo patrón".
              </div>
            ) : (
              <div className="space-y-2.5">
                {patterns.map(p => (
                  <div key={p.id} className="rounded-xl border border-foreground/[0.07] bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", RESULTADO_STYLES[p.resultado])}>
                        {RESULTADO_LABELS[p.resultado]}
                      </span>
                      <span className="text-[11px] text-foreground/30">{fmtDateTime(p.created_at)}</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] text-foreground/70"><span className="font-semibold text-foreground/50">Situación:</span> {p.situacion}</p>
                    <p className="mt-1 text-[12.5px] text-foreground/70"><span className="font-semibold text-foreground/50">Enfoque:</span> {p.enfoque}</p>
                    {p.correccion && (
                      <p className="mt-1.5 rounded-lg bg-[#ffde21]/[0.06] px-2.5 py-1.5 text-[12px] text-foreground/70">
                        <span className="font-semibold">Corrección:</span> {p.correccion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

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
