"use client"

import { useState } from "react"
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners } from "@dnd-kit/core"
import type { Lead } from "@/components/views/admin-leads-view"
import { PipelineColumn } from "./PipelineColumn"
import { PipelineCard } from "./PipelineCard"
import { PIPELINE_COLUMNS, effectiveStage } from "./constants"
import type { PipelineStageId } from "./constants"

interface PipelineBoardProps {
  leads:    Lead[]
  onSelect: (lead: Lead) => void
  onPatch:  (id: string, updates: Partial<Lead>) => void
}

export function PipelineBoard({ leads, onSelect, onPatch }: PipelineBoardProps) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const byStage = new Map<PipelineStageId, Lead[]>()
  for (const col of PIPELINE_COLUMNS) byStage.set(col.id, [])
  for (const lead of leads) {
    const stage = effectiveStage(lead)
    if (stage) byStage.get(stage)!.push(lead)
  }
  for (const [, group] of byStage) {
    group.sort((a, b) => (a.next_follow_up_at ?? "9999") < (b.next_follow_up_at ?? "9999") ? -1 : 1)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveLead(leads.find(l => l.id === event.active.id) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null)
    const { active, over } = event
    if (!over) return
    const targetStage = over.id as PipelineStageId
    const lead = leads.find(l => l.id === active.id)
    if (!lead) return
    if (effectiveStage(lead) === targetStage) return

    const updates: Partial<Lead> = { status: targetStage }
    if (targetStage === "compraron") updates.purchased = true
    else if (lead.purchased) updates.purchased = false

    onPatch(lead.id, updates)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {PIPELINE_COLUMNS.map(col => (
          <div key={col.id} className="flex-1 min-w-[240px]">
            <PipelineColumn
              id={col.id}
              title={col.label}
              accentColor={col.color}
              leads={byStage.get(col.id) ?? []}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeLead && (
          <div style={{ transform: "rotate(2deg)", opacity: 0.95 }}>
            <PipelineCard lead={activeLead} onClick={() => {}} isOverlay />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
