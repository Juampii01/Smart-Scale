"use client"

import { useState, useRef, useEffect } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Plus, X } from "lucide-react"
import type { TaskColumnId } from "./constants"
import { TaskCard } from "./TaskCard"
import type { Task } from "./TaskCard"

interface KanbanColumnProps {
  id:           TaskColumnId
  title:        string
  tasks:        Task[]
  accentColor:  string
  onAddTask:    (columnId: TaskColumnId) => void
  onEditTask:   (task: Task) => void
  onQuickAdd:   (columnId: TaskColumnId, title: string) => void
  onComplete:   (task: Task) => void
}

export function KanbanColumn({
  id, title, tasks, accentColor,
  onAddTask, onEditTask, onQuickAdd, onComplete,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  const [quickAddOpen,  setQuickAddOpen]  = useState(false)
  const [quickAddValue, setQuickAddValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (quickAddOpen) inputRef.current?.focus()
  }, [quickAddOpen])

  function submitQuickAdd() {
    const val = quickAddValue.trim()
    if (val) {
      onQuickAdd(id, val)
      setQuickAddValue("")
      setQuickAddOpen(false)
    }
  }

  return (
    <div className="flex flex-col min-h-0" style={{ minWidth: 0 }}>
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {title}
          </span>
          <span
            className="text-[11px] font-medium px-1.5 py-0.5 rounded-full tabular-nums"
            style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(id)}
          aria-label={`Añadir tarea en ${title}`}
          className="p-1 rounded-lg transition-all hover:opacity-70 hover:rotate-90 duration-200 cursor-pointer"
          title="Añadir tarea (modal)"
        >
          <Plus size={14} style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex-1 flex flex-col gap-1.5 rounded-xl p-1.5 transition-colors min-h-[120px] overflow-y-auto"
        style={{
          backgroundColor: isOver ? accentColor + "0D" : "var(--muted)",
          border: `1px dashed ${isOver ? accentColor + "66" : "transparent"}`,
        }}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onEditTask}
              onComplete={onComplete}
            />
          ))}
        </SortableContext>

        {/* Quick-add input */}
        {quickAddOpen ? (
          <div
            className="rounded-xl p-2.5"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--accent)" }}
            onPointerDown={e => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={quickAddValue}
              onChange={e => setQuickAddValue(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === "Enter")  { e.preventDefault(); submitQuickAdd() }
                if (e.key === "Escape") { e.preventDefault(); setQuickAddOpen(false); setQuickAddValue("") }
              }}
              placeholder="Nombre de la tarea…"
              className="w-full bg-transparent text-sm outline-none placeholder:opacity-40"
              style={{ color: "var(--foreground)" }}
            />
            <div className="flex items-center justify-between mt-2.5 gap-2">
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)", opacity: 0.5 }}>
                ↵ crear · Esc cancelar
              </span>
              <div className="flex gap-1.5">
                <button
                  onPointerDown={e => { e.preventDefault(); setQuickAddOpen(false); setQuickAddValue("") }}
                  className="p-1 rounded-lg cursor-pointer opacity-50 hover:opacity-80 transition-opacity"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <X size={12} />
                </button>
                <button
                  onPointerDown={e => { e.preventDefault(); submitQuickAdd() }}
                  disabled={!quickAddValue.trim()}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-40 cursor-pointer transition-opacity"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                >
                  Crear
                </button>
              </div>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <button
            onClick={() => setQuickAddOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 text-xs rounded-lg transition-all duration-200 py-6 group cursor-pointer"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Plus
              size={16}
              className="transition-all duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
              style={{ color: accentColor, opacity: 0.5 }}
            />
            <span className="transition-all duration-200 group-hover:-translate-y-0.5 group-hover:opacity-100 opacity-60">
              Añadir tarea
            </span>
          </button>
        ) : (
          <button
            onClick={() => setQuickAddOpen(true)}
            className="flex items-center gap-1.5 w-full px-2 py-2 rounded-lg text-xs transition-all cursor-pointer opacity-50 hover:opacity-100"
            style={{ color: "var(--muted-foreground)" }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--foreground) 5%, transparent)" }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent" }}
          >
            <Plus size={12} style={{ color: accentColor }} />
            Agregar tarea
          </button>
        )}
      </div>
    </div>
  )
}
