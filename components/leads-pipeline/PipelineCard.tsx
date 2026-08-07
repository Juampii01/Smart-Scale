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
}

function followUpTone(dateStr: string) {
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr < today) return { color: "#ef4444", label: "Atrasado" }
  if (dateStr === today) return { color: "#F59E0B", label: "Hoy" }
  return { color: "var(--muted-foreground)", label: null }
}

export function PipelineCard({ lead, onClick, onPatch, isOverlay = false }: PipelineCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    disabled: isOverlay,
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
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onClick(lead)}
      className={`cursor-pointer rounded-xl border p-3 space-y-2 transition-all touch-none ${
        isOverdue
          ? "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 hover:border-red-400 dark:hover:border-red-500/60"
          : "border-foreground/[0.08] bg-card hover:border-foreground/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-foreground truncate">
          {lead.name ?? <span className="text-foreground/30">Sin nombre</span>}
        </span>
        {lead.rating ? (
          <span className="inline-flex items-center gap-0.5 shrink-0">
            <Star className="h-3 w-3 fill-[#dafc69] text-[#dafc69]" />
            <span className="text-[11px] font-bold text-foreground/60">{lead.rating}</span>
          </span>
        ) : null}
      </div>

      <span className="block text-[11px] tabular-nums text-foreground/40">{fmtDate(lead.created_at)}</span>

      {ig && (
        <a
          href={igHref(ig)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 text-[12px] text-[#dafc69] hover:text-[#f2ffc0] transition-colors"
        >
          <Instagram className="h-3 w-3 shrink-0" />
          <span className="min-w-0 truncate">{igLabel(ig)}</span>
        </a>
      )}

      <div className="flex items-center justify-between gap-2">
        {lead.deal_value ? (
          <span className="text-[12px] font-bold text-foreground/70">
            ${lead.deal_value.toLocaleString("es-AR")}
          </span>
        ) : <span />}
        {followUp && tone && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: tone.color }}>
              <CalendarClock className="h-3 w-3" />
              {tone.label ?? followUp}
            </span>
            {onPatch && (
              <button
                onClick={markFollowUpDone}
                title="Marcar seguimiento como hecho"
                className="flex h-4 w-4 items-center justify-center rounded-full text-foreground/25 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
