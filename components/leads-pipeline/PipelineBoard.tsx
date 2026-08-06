"use client"

import { useEffect, useRef, useState } from "react"
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
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

// Orden totalmente automático en cualquier columna: primero por rating
// (5★ arriba, 4★ abajo) y dentro de cada estrella, de más nueva a más
// vieja. El drag&drop entre columnas sigue funcionando (cambia la etapa),
// pero la posición dentro de una columna ya no se guarda a mano.
function compareLeads(a: Lead, b: Lead) {
  const ar = a.rating ?? 0
  const br = b.rating ?? 0
  if (ar !== br) return br - ar
  return a.created_at < b.created_at ? 1 : -1
}

export function PipelineBoard({ leads, onSelect, onPatch }: PipelineBoardProps) {
  const [items, setItems] = useState<Lead[]>(leads)
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const isDraggingRef = useRef(false)
  const dragStartSnapshotRef = useRef<Lead[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // La mayoría de los mouses solo tienen rueda vertical — con 9 columnas hace
  // falta poder recorrer el tablero sin trackpad. Convertimos scroll vertical
  // en horizontal mientras el puntero está sobre el tablero (no mientras se
  // arrastra una card, para no pelear con el drag).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (isDraggingRef.current) return
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  // Se resincroniza con lo que viene del padre (fetch, ratings editados desde
  // la tabla, etc.) — salvo mientras hay un drag en curso, para no pisar el
  // reorder que el usuario todavía está haciendo.
  useEffect(() => {
    if (!isDraggingRef.current) setItems(leads)
  }, [leads])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const byStage = new Map<PipelineStageId, Lead[]>()
  for (const col of PIPELINE_COLUMNS) byStage.set(col.id, [])
  for (const lead of items) {
    const stage = effectiveStage(lead)
    if (stage) byStage.get(stage)!.push(lead)
  }
  for (const [, group] of byStage) group.sort(compareLeads)

  const handleDragStart = (event: DragStartEvent) => {
    setActiveLead(items.find(l => l.id === event.active.id) ?? null)
    isDraggingRef.current = true
    dragStartSnapshotRef.current = items
  }

  // Mueve la card entre columnas en vivo, para el feedback visual mientras
  // se arrastra (el orden fino dentro de la columna se resuelve al soltar).
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId   = over.id   as string
    const draggedLead = items.find(l => l.id === activeId)
    if (!draggedLead) return
    const overColumn = PIPELINE_COLUMNS.find(c => c.id === overId)
    if (overColumn && effectiveStage(draggedLead) !== overColumn.id) {
      setItems(prev => prev.map(l => l.id === activeId ? { ...l, status: overColumn.id } : l))
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveLead(null)
    isDraggingRef.current = false
    if (!over) return
    const activeId = active.id as string
    const overId   = over.id   as string

    setItems(prev => {
      const draggedLead = prev.find(l => l.id === activeId)
      if (!draggedLead) return prev

      // draggedLead/overLead son siempre cards visibles en el tablero, así que
      // su etapa nunca es null en la práctica (solo los leads fuera del
      // pipeline, que no son arrastrables, dan null acá).
      const overLead   = prev.find(l => l.id === overId)
      const overColumn = PIPELINE_COLUMNS.find(c => c.id === overId)
      const targetStage: PipelineStageId = overLead ? effectiveStage(overLead)! : (overColumn?.id ?? effectiveStage(draggedLead)!)
      // Columna de la que "sale" la card — el estado en vivo justo antes de
      // este drop (dragOver ya pudo haberla cambiado de columna en el medio
      // del gesto), no el snapshot del inicio del drag.
      const sourceStage = effectiveStage(draggedLead)!

      let updated: Lead[]

      if (overLead && targetStage === effectiveStage(draggedLead) && overId !== activeId) {
        // Reorden dentro de la misma columna
        const colLeads  = prev.filter(l => effectiveStage(l) === targetStage).sort(compareLeads)
        const activeIdx = colLeads.findIndex(l => l.id === activeId)
        const overIdx   = colLeads.findIndex(l => l.id === overId)
        const reordered = arrayMove(colLeads, activeIdx, overIdx).map((l, i) => ({ ...l, pipeline_order: i, status: targetStage }))
        updated = [...prev.filter(l => effectiveStage(l) !== targetStage), ...reordered]
      } else {
        // Cross-column, o drop directo sobre la columna (vacía o no)
        const targetColLeads = prev
          .filter(l => effectiveStage(l) === targetStage && l.id !== activeId)
          .sort(compareLeads)
        const overIdx  = overLead ? targetColLeads.findIndex(l => l.id === overId) : -1
        const insertAt = overIdx === -1 ? targetColLeads.length : overIdx
        const reinsertedTarget = [
          ...targetColLeads.slice(0, insertAt),
          { ...draggedLead, status: targetStage },
          ...targetColLeads.slice(insertAt),
        ].map((l, i) => ({ ...l, pipeline_order: i, status: targetStage }))

        // La columna de origen también se re-numera (sacamos una card de ahí)
        const sourceColLeads = sourceStage === targetStage ? [] : prev
          .filter(l => effectiveStage(l) === sourceStage && l.id !== activeId)
          .sort(compareLeads)
          .map((l, i) => ({ ...l, pipeline_order: i }))

        updated = [
          ...prev.filter(l => effectiveStage(l) !== targetStage && effectiveStage(l) !== sourceStage),
          ...sourceColLeads,
          ...reinsertedTarget,
        ]
      }

      // Persistimos solo lo que realmente cambió respecto al snapshot de
      // ANTES del drag (no contra prev, que dragOver ya pudo mutar).
      const original = dragStartSnapshotRef.current
      for (const lead of updated) {
        const orig = original.find(l => l.id === lead.id)
        if (!orig) continue
        const stageChanged = effectiveStage(orig) !== effectiveStage(lead)
        const orderChanged = (orig.pipeline_order ?? null) !== (lead.pipeline_order ?? null)
        if (stageChanged || orderChanged) {
          const updates: Partial<Lead> = { pipeline_order: lead.pipeline_order }
          if (stageChanged) {
            updates.status = lead.status
            if (lead.status === "compraron") updates.purchased = true
            else if (orig.purchased) updates.purchased = false
          }
          onPatch(lead.id, updates)
        }
      }

      return updated
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div ref={scrollRef} className="scrollbar-visible flex gap-4 overflow-x-auto pb-3">
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
