"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Calendar, CheckCircle2, Circle, AlignLeft } from "lucide-react"
import { LabelBadge } from "./LabelBadge"
import { initials, avatarColor } from "./avatar"
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

  const today            = new Date().toISOString().slice(0, 10)
  const isToday          = !isDone && task.dueDate === today
  const dueDateColor     = isOverdue ? "#ef4444" : isToday ? "#F59E0B" : "var(--muted-foreground)"
  const dueDateFormatted = task.dueDate
    ? new Date(task.dueDate + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    : null

  const hasFooter = Boolean(dueDateFormatted || task.assignedTo || task.description)

  const style = isDragging
    ? {
        backgroundColor: "var(--card)",
        transform:        `${dndTransform ?? ""} scale(1.03) rotate(1.5deg)`.trim(),
        boxShadow:        "0 12px 28px -6px rgba(0,0,0,0.35)",
        borderColor:      "var(--accent)",
        zIndex:           50,
        opacity:          0.97,
      }
    : {
        backgroundColor: "var(--card)",
        transform:        dndTransform || undefined,
        transition,
        borderColor:      "var(--border)",
      }

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      style={style}
      className="group relative rounded-lg border p-2.5 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.18)]"
      onClick={() => onClick(task)}
    >
      {/* Top row: label + completion toggle */}
      <div className="flex items-start justify-between gap-2">
        {task.label
          ? <LabelBadge label={task.label} small />
          : <span />
        }
        <button
          className="shrink-0 -mt-0.5 -mr-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          title={isDone ? "Mover a Por hacer" : "Marcar como listo"}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onComplete(task) }}
        >
          {isDone
            ? <CheckCircle2 size={15} style={{ color: "#22C55E" }} />
            : <Circle      size={15} style={{ color: "var(--muted-foreground)", opacity: 0.35 }} />
          }
        </button>
      </div>

      {/* Title */}
      <p
        className={`text-[13px] font-medium leading-snug ${task.label ? "mt-1.5" : "mt-0.5"}`}
        style={{
          color:          "var(--foreground)",
          textDecoration: isDone ? "line-through" : "none",
          opacity:        isDone ? 0.5 : 1,
        }}
      >
        {task.title}
      </p>

      {/* Footer meta */}
      {hasFooter && (
        <div className="flex items-center gap-2 mt-2.5">
          {dueDateFormatted && (
            <div
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5"
              style={{
                backgroundColor: isOverdue
                  ? "color-mix(in srgb, #ef4444 12%, transparent)"
                  : isToday
                    ? "color-mix(in srgb, #F59E0B 14%, transparent)"
                    : "var(--muted)",
              }}
            >
              <Calendar size={10} style={{ color: dueDateColor }} />
              <span className="text-[10.5px] font-medium" style={{ color: dueDateColor }}>
                {isOverdue ? `${dueDateFormatted} · vencida` : isToday ? "Hoy" : dueDateFormatted}
              </span>
            </div>
          )}

          {/* Description indicator */}
          {task.description && (
            <AlignLeft size={12} style={{ color: "var(--muted-foreground)", opacity: 0.5 }} />
          )}

          {/* Assignee avatar */}
          {task.assignedTo && (
            <div
              className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shrink-0"
              style={{ backgroundColor: avatarColor(task.assignedTo) }}
              title={task.assignedTo}
            >
              {initials(task.assignedTo)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
