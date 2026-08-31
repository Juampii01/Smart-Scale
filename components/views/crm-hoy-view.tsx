"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Loader2, ChevronRight, Sparkles, Kanban } from "lucide-react"

interface Prospect {
  id: string
  name: string
  handle: string | null
  estimated_value: number | null
  stage: string
  call_tag: string | null
  archived_at: string | null
  last_movement_at: string
}

type Stat = { month: number; trailing12mo: number }
interface Stats {
  llamadas_agendadas: Stat
  offerdocs_enviados: Stat
  offerdocs_respondidos: Stat
  cierres: Stat
}

const STAGE_LABEL: Record<string, string> = {
  conversacion: "Conversación",
  calificado: "Calificado",
  offerdoc_enviado: "OfferDoc enviado",
  offerdoc_respondido: "OfferDoc respondido",
  cerrado: "Cerrado",
}

// Mismo motivo templado por etapa que usa el diseño aprobado — no hay
// texto libre por prospecto todavía (eso viviría en Conversaciones).
const STAGE_MOTIVO: Record<string, string> = {
  conversacion: "La charla se enfrió antes de calificar.",
  calificado: "Calificaste y no mandaste el OfferDoc.",
  offerdoc_enviado: "Sin respuesta. Toca hacer seguimiento.",
  offerdoc_respondido: "Contestó. Definí si se cierra o se pierde.",
}

// Mismos umbrales que el filete ámbar/rojo del Pipeline — un solo criterio
// de urgencia en toda la app, no dos reglas distintas por pantalla.
function urgency(daysSince: number): "" | "att" | "risk" {
  if (daysSince >= 10) return "risk"
  if (daysSince >= 5) return "att"
  return ""
}
function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}
function fmtAgo(days: number) {
  if (days <= 0) return "hoy"
  if (days === 1) return "ayer"
  return `hace ${days} días`
}
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Buenos días"
  if (h < 19) return "Buenas tardes"
  return "Buenas noches"
}

function WorkRow({ p, signal }: { p: Prospect; signal: "" | "att" | "risk" }) {
  const dotClass = signal === "risk" ? "bg-red-600 dark:bg-red-400" : signal === "att" ? "bg-amber-500 dark:bg-amber-400" : "bg-secondary"
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <span className={`h-2 w-2 shrink-0 rounded-[2px] ${dotClass}`} />
      <span className="w-[130px] shrink-0">
        <span className="block truncate text-[13px] font-semibold text-foreground">{p.name}</span>
        {p.handle && <span className="block truncate text-[13px] text-text-2">@{p.handle}</span>}
      </span>
      <span className="hidden shrink-0 rounded-md border border-border px-2 py-0.5 text-[13px] text-text-2 sm:inline-block">
        {STAGE_LABEL[p.stage]}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-text-2">{STAGE_MOTIVO[p.stage]}</span>
      <span className="shrink-0 text-[13px] tabular-nums text-text-3">{fmtAgo(daysSince(p.last_movement_at))}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-3" />
    </div>
  )
}

function WorkSection({ title, items }: { title: string; items: { p: Prospect; signal: "" | "att" | "risk" }[] }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-2">{title}</span>
        <span className="text-[13px] tabular-nums text-text-3">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-[13px] text-text-3">Nada acá — bien.</p>
      ) : (
        <div>{items.map(({ p, signal }) => <WorkRow key={p.id} p={p} signal={signal} />)}</div>
      )}
    </div>
  )
}

function StatRow({ label, stat }: { label: string; stat: Stat }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="flex-1 text-[13px] text-text-2">{label}</span>
      <span className="text-[18px] font-extrabold tabular-nums text-foreground">{stat.month}</span>
      <span className="w-14 shrink-0 text-right text-[13px] tabular-nums text-text-3">de {stat.trailing12mo}</span>
    </div>
  )
}

export function CrmHoyView({ clientId, clientName, readOnly }: { clientId: string | null; clientName?: string | null; readOnly?: boolean }) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const getToken = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const token = await getToken()
        if (!token) return
        const qs = clientId ? `?client_id=${clientId}` : ""
        const [prospRes, statsRes] = await Promise.all([
          fetch(`/api/client/crm/prospects${qs}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/client/crm/stats${qs}`, { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (!active) return
        if (prospRes.ok) setProspects((await prospRes.json()).prospects ?? [])
        if (statsRes.ok) setStats((await statsRes.json()).stats ?? null)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [getToken, clientId])

  const buckets = useMemo(() => {
    const active = prospects.filter((p) => !p.archived_at && p.stage !== "cerrado")
    const atrasados: { p: Prospect; signal: "risk" }[] = []
    const paraHoy: { p: Prospect; signal: "att" }[] = []
    const semana: { p: Prospect; signal: "" }[] = []
    for (const p of active) {
      const u = urgency(daysSince(p.last_movement_at))
      if (u === "risk") atrasados.push({ p, signal: "risk" })
      else if (u === "att") paraHoy.push({ p, signal: "att" })
      else semana.push({ p, signal: "" })
    }
    const byDays = (a: { p: Prospect }, b: { p: Prospect }) => daysSince(b.p.last_movement_at) - daysSince(a.p.last_movement_at)
    atrasados.sort(byDays); paraHoy.sort(byDays); semana.sort(byDays)
    return { atrasados, paraHoy, semana, total: active.length }
  }, [prospects])

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-text-3" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight text-foreground">{greeting()}{clientName ? `, ${clientName}` : ""}</h1>
        <p className="mt-1 text-[15px] text-text-2">
          {buckets.total === 0
            ? "No hay prospectos activos pidiendo algo — cargá el primero desde Pipeline."
            : `${buckets.total} prospecto${buckets.total !== 1 ? "s" : ""} esperan que hagas algo.${buckets.atrasados.length > 0 ? ` ${buckets.atrasados.length} se ${buckets.atrasados.length === 1 ? "está" : "están"} atrasando.` : ""}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-7 lg:border-r lg:border-border lg:pr-8">
          <WorkSection title="Se están atrasando" items={buckets.atrasados} />
          <WorkSection title="Para hoy" items={buckets.paraHoy} />
          <WorkSection title="Esta semana" items={buckets.semana} />
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-ink" />
              <span className="text-[13px] font-semibold text-foreground">Ann AI</span>
            </div>
            {buckets.atrasados.length > 0 || buckets.paraHoy.length > 0 ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-text-2">
                {buckets.atrasados.length > 0 && (
                  <>Tenés <b className="text-foreground">{buckets.atrasados.length} prospecto{buckets.atrasados.length !== 1 ? "s" : ""} atrasado{buckets.atrasados.length !== 1 ? "s" : ""}</b> hace más de una semana sin moverse. </>
                )}
                {buckets.paraHoy.length > 0 && <>{buckets.paraHoy.length} más necesitan algo pronto.</>}
              </p>
            ) : (
              <p className="mt-2.5 text-[13px] leading-relaxed text-text-2">Sin nada urgente pendiente hoy.</p>
            )}
            <a href="/ann-ai" className="mt-3 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] text-text-2 hover:text-foreground hover:border-border-hover transition-colors">
              <Kanban className="h-3.5 w-3.5" /> Preguntale algo sobre tu pipeline…
            </a>
          </div>

          {stats && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-2">Tu mes, hasta ahora</p>
              <div className="rounded-2xl border border-border bg-card px-4">
                <StatRow label="Llamadas agendadas" stat={stats.llamadas_agendadas} />
                <StatRow label="OfferDocs enviados" stat={stats.offerdocs_enviados} />
                <StatRow label="OfferDocs respondidos" stat={stats.offerdocs_respondidos} />
                <StatRow label="Cierres" stat={stats.cierres} />
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-text-3">Estos cuatro campos del reporte mensual se llenan solos con lo que movés en el Pipeline.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
