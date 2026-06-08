"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Calendar, CheckSquare, Flag, Ban, MessageSquare, Paperclip } from "lucide-react"
import { LabelBadge } from "./LabelBadge"
import { initials, avatarColor } from "./avatar"
import { PRIORITY_BY_ID } from "./constants"
import type { TaskColumnId } from "./constants"

export interface Subtask { text: string; done: boolean }

export interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string
  label?: { text: string; color: string }
  priority: "urgente" | "importante" | "con-tiempo"
  columnId: TaskColumnId
  createdAt: string
  order: number
  assignees: string[]
  subtasks: Subtask[]
  blocked: boolean
  commentsCount?: number
  attachmentsCount?: number
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

  const prio   = PRIORITY_BY_ID[task.priority] ?? PRIORITY_BY_ID["con-tiempo"]
  const subs   = task.subtasks ?? []
  const done   = subs.filter(s => s.done).length
  const total  = subs.length
  const pct    = total ? Math.round((done / total) * 100) : 0
  const people = task.assignees ?? []

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
      className="group relative overflow-hidden rounded-xl border pl-3.5 pr-3 py-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-[0_6px_20px_-6px_rgba(0,0,0,0.3)]"
      onClick={() => onClick(task)}
    >
      {/* Barra de prioridad lateral */}
      <span
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{ backgroundColor: prio.color }}
      />

      {/* Top row: etiqueta + bandera de prioridad */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {task.label
          ? <LabelBadge label={task.label} small />
          : <span />
        }
        <span className="flex items-center gap-1 text-[10.5px] font-semibold shrink-0" style={{ color: prio.color }}>
          <Flag size={11} /> {prio.label}
        </span>
      </div>

      {/* Title (con badge BLOQUEADA) */}
      <p
        className="text-[13.5px] font-medium leading-snug"
        style={{
          color:          "var(--foreground)",
          textDecoration: isDone ? "line-through" : "none",
          opacity:        isDone ? 0.55 : 1,
        }}
      >
        {task.blocked && (
          <span
            className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide rounded mr-1.5 px-1.5 py-0.5 align-middle text-red-700 dark:text-red-400"
            style={{ backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 30%, transparent)" }}
          >
            <Ban size={9} /> Bloqueada
          </span>
        )}
        {task.title}
      </p>

      {/* Progreso de subtareas */}
      {total > 0 && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[10.5px] mb-1" style={{ color: "var(--muted-foreground)" }}>
            <span className="flex items-center gap-1"><CheckSquare size={11} /> {done}/{total}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#22C55E" : "#ffde21" }} />
          </div>
        </div>
      )}

      {/* Footer: fecha + comentarios/adjuntos + avatares */}
      <div className="flex items-center justify-between mt-2.5">
        <div className="flex items-center gap-2.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          {dueDateFormatted && (
            <span className="flex items-center gap-1 font-medium" style={{ color: dueDateColor }}>
              <Calendar size={11} /> {isOverdue ? `${dueDateFormatted}` : isToday ? "Hoy" : dueDateFormatted}
            </span>
          )}
          {!!task.commentsCount && (
            <span className="flex items-center gap-1"><MessageSquare size={11} /> {task.commentsCount}</span>
          )}
          {!!task.attachmentsCount && (
            <span className="flex items-center gap-1"><Paperclip size={11} /> {task.attachmentsCount}</span>
          )}
        </div>

        {/* Avatares apilados */}
        {people.length > 0 && (
          <div className="flex">
            {people.map((p, i) => (
              <div
                key={p}
                className="flex h-5 w-5 items-center justify-center rounded-full text-[8.5px] font-bold text-white"
                style={{ backgroundColor: avatarColor(p), marginLeft: i ? -7 : 0, border: "2px solid var(--card)" }}
                title={p}
              >
                {initials(p)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
