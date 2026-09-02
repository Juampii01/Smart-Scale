"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Star, Instagram, CalendarClock, CheckCircle2 } from "lucide-react"
import type { Lead } from "@/components/views/admin-leads-view"
import { igHref, igLabel, fmtDate } from "@/components/views/admin-leads-view"

interface PipelineCardProps {
  lead: Lead
  onClick: (lead: Lead) => void
  onPatch?: (id: string, updates: Partial<Lead>) => void
  isOverlay?: boolean
  readOnly?: boolean
}

function followUpTone(dateStr: string) {
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr < today) return { color: "#ef4444", label: "Atrasado" }
  if (dateStr === today) return { color: "#F59E0B", label: "Hoy" }
  return { color: "var(--muted-foreground)", label: null }
}

export function PipelineCard({ lead, onClick, onPatch, isOverlay = false, readOnly = false }: PipelineCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    disabled: isOverlay || readOnly,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const ig = lead.instagram?.trim()
  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = !!lead.next_follow_up_at && lead.next_follow_up_at < today
  const followUp = lead.next_follow_up_at
    ? new Date(lead.next_follow_up_at + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    : null
  const tone = lead.next_follow_up_at ? followUpTone(lead.next_follow_up_at) : null

  const markFollowUpDone = (e: React.MouseEvent) => {
    e.stopPropagation()
    // El PATCH ya resetea follow_up_alert_sent_at solo con que
    // next_follow_up_at cambie (ver app/api/admin/leads/route.ts).
    onPatch?.(lead.id, { next_follow_up_at: null })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(readOnly ? {} : listeners)}
      {...(readOnly ? {} : attributes)}
      onClick={() => !isDragging && onClick(lead)}
      className={`rounded-xl border p-3 space-y-2 transition-all touch-none ${readOnly ? "cursor-default" : "cursor-pointer"} ${
        isOverdue
          ? "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 hover:border-red-400 dark:hover:border-red-500/60"
          : "border-border bg-card hover:border-border-hover"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-foreground truncate">
          {lead.name ?? <span className="text-text-3">Sin nombre</span>}
        </span>
        {lead.rating ? (
          <span className="inline-flex items-center gap-0.5 shrink-0">
            <Star className="h-3 w-3 fill-accent-ink text-accent-ink" />
            <span className="text-[13px] font-bold text-text-2">{lead.rating}</span>
          </span>
        ) : null}
      </div>

      <span className="block text-[13px] tabular-nums text-text-2">{fmtDate(lead.created_at)}</span>

      {ig && (
        <a
          href={igHref(ig)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 text-[13px] text-accent-ink hover:text-accent-hover transition-colors"
        >
          <Instagram className="h-3 w-3 shrink-0" />
          <span className="min-w-0 truncate">{igLabel(ig)}</span>
        </a>
      )}

      <div className="flex items-center justify-between gap-2">
        {lead.next_follow_up_at && onPatch && !readOnly ? (
          <button
            onClick={markFollowUpDone}
            title="Marcar seguimiento como hecho"
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[13px] font-semibold text-text-2 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <CheckCircle2 className="h-3 w-3" />
            Hecho
          </button>
        ) : <span />}
        {followUp && tone && (
          <span className="inline-flex items-center gap-1 text-[13px] font-medium" style={{ color: tone.color }}>
            <CalendarClock className="h-3 w-3" />
            {tone.label ?? followUp}
          </span>
        )}
      </div>
    </div>
  )
}
