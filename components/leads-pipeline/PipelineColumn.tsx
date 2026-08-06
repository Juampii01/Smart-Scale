"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { Lead } from "@/components/views/admin-leads-view"
import { PipelineCard } from "./PipelineCard"
import type { PipelineStageId } from "./constants"

interface PipelineColumnProps {
  id:          PipelineStageId
  title:       string
  accentColor: string
  leads:       Lead[]
  onSelect:    (lead: Lead) => void
}

export function PipelineColumn({ id, title, accentColor, leads, onSelect }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div className="flex flex-col min-h-0" style={{ minWidth: 0 }}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full tabular-nums bg-foreground/[0.06] text-foreground/40">
          {leads.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 flex flex-col gap-2 rounded-xl p-2 min-h-[140px] overflow-y-auto transition-colors"
        style={{
          backgroundColor: isOver ? accentColor + "0D" : "var(--muted)",
          border: `1px dashed ${isOver ? accentColor + "66" : "transparent"}`,
        }}
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <PipelineCard key={lead.id} lead={lead} onClick={onSelect} />
          ))}
        </SortableContext>
        {!leads.length && (
          <div className="flex-1 flex items-center justify-center py-6 text-[12px] text-foreground/25">
            Sin leads acá
          </div>
        )}
      </div>
    </div>
  )
}
