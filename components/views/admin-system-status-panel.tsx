"use client"

import { useCallback, useEffect, useState } from "react"
import { Cog, MessageCircle, Wand2, Zap, ChevronDown, Bot } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { SectionHeader } from "@/components/ui/section-header"
import { StatusPill, type StatusPillVariant } from "@/components/ui/status-pill"

interface StatusItem {
  key: string
  name: string
  description: string
  trigger: string
  bucket: "asistentes" | "consultores" | "constructores" | "automatizaciones"
  lastRanAt: string | null
  status: "ok" | "error" | "idle" | "warning"
  detail: string | null
  needsDecision: boolean
}

interface StatusPayload {
  asistentes: StatusItem[]
  consultores: StatusItem[]
  constructores: StatusItem[]
  automatizaciones: StatusItem[]
}

const BUCKETS: { key: keyof StatusPayload; title: string; icon: typeof Cog; subtitle: string }[] = [
  { key: "asistentes", title: "Asistentes", icon: Cog, subtitle: "Internos — corren solos, programados o disparados" },
  { key: "consultores", title: "Consultores", icon: MessageCircle, subtitle: "De cara al cliente" },
  { key: "constructores", title: "Constructores", icon: Wand2, subtitle: "Agentes que escriben código" },
  { key: "automatizaciones", title: "Automatizaciones", icon: Zap, subtitle: "Webhooks y notificadores disparados por evento" },
]

function relativeTime(iso: string | null): string {
  if (!iso) return "nunca corrió"
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return "corrió recién"
  if (min < 60) return `corrió hace ${min}m`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `corrió hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `corrió hace ${days}d`
}

function pillVariant(item: StatusItem): StatusPillVariant {
  if (item.needsDecision) return "warning"
  return item.status as StatusPillVariant
}

function pillLabel(item: StatusItem): string {
  if (item.needsDecision) return "necesita decisión"
  if (item.status === "idle" && item.trigger === "próximamente") return "próximamente"
  if (item.status === "idle") return "nunca corrió"
  if (item.status === "ok" && item.trigger.startsWith("a demanda")) return "activo"
  return relativeTime(item.lastRanAt)
}

function StatusCard({ item }: { item: StatusItem }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = item.status === "error" && !!item.detail

  return (
    <div className="rounded-xl border border-foreground/[0.07] bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-foreground truncate">{item.name}</p>
          <p className="text-[11px] text-foreground/40 mt-0.5">{item.trigger}</p>
        </div>
        <button
          type="button"
          onClick={() => hasDetail && setExpanded(v => !v)}
          className={cn("shrink-0", hasDetail && "cursor-pointer")}
        >
          <StatusPill variant={pillVariant(item)}>
            {pillLabel(item)}
            {hasDetail && <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />}
          </StatusPill>
        </button>
      </div>
      <p className="text-[11.5px] text-foreground/55 mt-2 leading-snug">{item.description}</p>
      {expanded && hasDetail && (
        <p className="text-[11px] text-red-700 dark:text-red-400 mt-2 rounded-lg bg-red-50 dark:bg-red-500/[0.06] p-2 break-words">
          {item.detail}
        </p>
      )}
    </div>
  )
}

export function AdminSystemStatusPanel() {
  const [data, setData] = useState<StatusPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Colapsado por default — es una sección larga (4 buckets, ~20+ items) y no
  // debe tapar el acceso a los tabs de abajo (Conversaciones, Comunidad, etc.)
  const [open, setOpen] = useState(false)

  const fetchStatus = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch("/api/admin/system-status", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      setError("No se pudo cargar el estado del sistema.")
      return
    }
    setData(await res.json())
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const allItems = data ? [...data.asistentes, ...data.consultores, ...data.constructores, ...data.automatizaciones] : []
  const needsDecisionCount = allItems.filter(i => i.needsDecision).length
  const errorCount = allItems.filter(i => i.status === "error").length

  return (
    <div className="rounded-2xl border border-foreground/[0.07] bg-card p-5">
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full text-left">
        <SectionHeader
          icon={Bot}
          title="Agentes"
          subtitle="Asistentes, Consultores, Constructores y Automatizaciones — estado del sistema"
          action={
            <div className="flex items-center gap-2.5">
              {data && (
                <span className="text-[11px] text-foreground/40 hidden sm:inline">
                  {allItems.length} procesos
                </span>
              )}
              {errorCount > 0 && <StatusPill variant="error">{errorCount} con error</StatusPill>}
              {needsDecisionCount > 0 && <StatusPill variant="warning">{needsDecisionCount} necesita decisión</StatusPill>}
              <ChevronDown className={cn("h-4 w-4 text-foreground/40 transition-transform shrink-0", open && "rotate-180")} />
            </div>
          }
        />
      </button>

      {open && (
        error ? (
          <p className="text-[12px] text-foreground/40 mt-5">{error}</p>
        ) : !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-foreground/[0.07] bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6 mt-5">
            {BUCKETS.map(({ key, title, icon, subtitle }) => {
              const items = data[key]
              if (items.length === 0) return null
              return (
                <div key={key}>
                  <SectionHeader icon={icon} title={title} subtitle={subtitle} className="mb-3" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map(item => <StatusCard key={item.key} item={item} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
