"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Star, Instagram, CalendarClock } from "lucide-react"
import type { Lead } from "@/components/views/admin-leads-view"
import { igHref, igLabel } from "@/components/views/admin-leads-view"

interface PipelineCardProps {
  lead: Lead
  onClick: (lead: Lead) => void
  isOverlay?: boolean
}

function followUpTone(dateStr: string) {
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr < today) return { color: "#ef4444", label: "Atrasado" }
  if (dateStr === today) return { color: "#F59E0B", label: "Hoy" }
  return { color: "var(--muted-foreground)", label: null }
}

export function PipelineCard({ lead, onClick, isOverlay = false }: PipelineCardProps) {
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
  const followUp = lead.next_follow_up_at
    ? new Date(lead.next_follow_up_at + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    : null
  const tone = lead.next_follow_up_at ? followUpTone(lead.next_follow_up_at) : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onClick(lead)}
      className="cursor-pointer rounded-xl border border-foreground/[0.08] bg-card p-3 space-y-2 hover:border-foreground/20 transition-all touch-none"
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
          <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: tone.color }}>
            <CalendarClock className="h-3 w-3" />
            {tone.label ?? followUp}
          </span>
        )}
      </div>
    </div>
  )
}
