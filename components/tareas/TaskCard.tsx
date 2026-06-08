"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Calendar, CheckCircle2, Circle } from "lucide-react"
import { LabelBadge } from "./LabelBadge"
import type { TaskColumnId } from "./constants"

export interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string
  label?: { text: string; color: string }
  columnId: TaskColumnId
  createdAt: string
  order: number
  assignedTo?: string
}

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
  onComplete: (task: Task) => void
  isOverlay?: boolean
}

export function TaskCard({ task, onClick, onComplete, isOverlay = false }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isOverlay })

  const dndTransform = CSS.Transform.toString(transform)

  const isDone    = task.columnId === "listo"
  const isOverdue = task.dueDate
    ? new Date(task.dueDate) < new Date() && !isDone
    : false

  const today             = new Date().toISOString().slice(0, 10)
  const isToday           = !isDone && task.dueDate === today
  const dueDateColor      = isOverdue ? "#ef4444" : isToday ? "#F59E0B" : "var(--muted-foreground)"
  const dueDateFormatted  = task.dueDate
    ? new Date(task.dueDate + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    : null

  const style = isDragging
    ? {
        backgroundColor: "var(--card)",
        transform:        `${dndTransform ?? ""} scale(1.04) rotate(1.5deg)`.trim(),
        boxShadow:        "var(--shadow-drag)",
        borderColor:      "var(--accent)",
        zIndex:           50,
        opacity:          0.95,
      }
    : {
        backgroundColor: "var(--card)",
        transform:        dndTransform || undefined,
        transition,
      }

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      style={style}
      className="group relative rounded-xl p-3 cursor-grab active:cursor-grabbing"
      onClick={() => onClick(task)}
    >
      {/* Completion toggle */}
      <button
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
        title={isDone ? "Mover a Por hacer" : "Marcar como listo"}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onComplete(task) }}
      >
        {isDone
          ? <CheckCircle2 size={14} style={{ color: "#22C55E" }} />
          : <Circle      size={14} style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
        }
      </button>

      {/* Label */}
      {task.label && (
        <div className="mb-1.5">
          <LabelBadge label={task.label} small />
        </div>
      )}

      {/* Title */}
      <p
        className="text-sm font-medium leading-snug pr-5"
        style={{
          color:          "var(--foreground)",
          textDecoration: isDone ? "line-through" : "none",
          opacity:        isDone ? 0.5 : 1,
        }}
      >
        {task.title}
      </p>

      {/* Description */}
      {task.description && (
        <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          {task.description}
        </p>
      )}

      {/* Footer: due date + assigned */}
      <div className="flex items-center gap-1 mt-2">
        {dueDateFormatted && (
          <div className="flex items-center gap-1">
            <Calendar size={11} style={{ color: dueDateColor }} />
            <span className="text-[11px]" style={{ color: dueDateColor }}>
              {isToday ? "Hoy" : dueDateFormatted}
            </span>
            {isOverdue && (
              <span
                className="text-[9px] font-bold uppercase tracking-wide py-0.5 rounded-full px-1"
                style={{
                  backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)",
                  color: "#ef4444",
                }}
              >
                Vencida
              </span>
            )}
          </div>
        )}
        {task.assignedTo && (
          <span className="ml-auto text-[10px] rounded-full px-1.5 py-0.5" style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}>
            {task.assignedTo}
          </span>
        )}
      </div>
    </div>
  )
}
