"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { Lead } from "@/components/views/admin-leads-view"
import { PipelineCard } from "./PipelineCard"

interface PipelineColumnProps {
  id:          string
  title:       string
  accentColor: string
  leads:       Lead[]
  onSelect:    (lead: Lead) => void
  onPatch:     (id: string, updates: Partial<Lead>) => void
  // "Sin estrellas" no es una etapa real del pipeline — se puede arrastrar
  // leads AFUERA de ahí (para calificarlas), pero no soltar nada adentro.
  droppable?:  boolean
  readOnly?:   boolean
}

export function PipelineColumn({ id, title, accentColor, leads, onSelect, onPatch, droppable = true, readOnly = false }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable || readOnly })

  return (
    <div className="flex flex-col min-h-0" style={{ minWidth: 0 }}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-[13px] font-medium px-1.5 py-0.5 rounded-full tabular-nums bg-foreground/[0.06] text-text-2">
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
            <PipelineCard key={lead.id} lead={lead} onClick={onSelect} onPatch={onPatch} readOnly={readOnly} />
          ))}
        </SortableContext>
        {!leads.length && (
          <div className="flex-1 flex items-center justify-center py-6 text-[13px] text-text-3">
            Sin leads acá
          </div>
        )}
      </div>
    </div>
  )
}
