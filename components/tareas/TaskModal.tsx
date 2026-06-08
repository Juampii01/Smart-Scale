"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { X, Tag } from "lucide-react"
import type { TaskColumnId } from "./constants"
import { KANBAN_COLUMNS, LABEL_PRESETS } from "./constants"
import { LabelBadge } from "./LabelBadge"
import type { Task } from "./TaskCard"

interface TaskModalProps {
  task?:            Task | null
  defaultColumnId:  TaskColumnId
  onSave:           (data: Omit<Task, "id" | "createdAt" | "order"> & { id?: string }) => void
  onDelete?:        (id: string) => void
  onClose:          () => void
}

export function TaskModal({ task, defaultColumnId = "por-hacer", onSave, onDelete, onClose }: TaskModalProps) {
  const [title,         setTitle]         = useState(task?.title ?? "")
  const [description,   setDescription]   = useState(task?.description ?? "")
  const [dueDate,       setDueDate]       = useState(task?.dueDate ?? "")
  const [columnId,      setColumnId]      = useState<TaskColumnId>(task?.columnId ?? defaultColumnId)
  const [selectedLabel, setSelectedLabel] = useState<{ text: string; color: string } | undefined>(task?.label)
  const [assignedTo,    setAssignedTo]    = useState(task?.assignedTo ?? "")
  const [mounted,       setMounted]       = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  const handleSubmit = () => {
    if (!title.trim()) return
    onSave({
      id:          task?.id,
      title:       title.trim(),
      description: description.trim() || undefined,
      dueDate:     dueDate || undefined,
      label:       selectedLabel,
      columnId,
      assignedTo:  assignedTo.trim() || undefined,
    })
    onClose()
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal
        aria-label={task ? "Editar tarea" : "Nueva tarea"}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          className="w-full max-w-md rounded-xl shadow-2xl flex flex-col"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{ opacity: 0,   scale: 0.96, y: 6  }}
          transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.85 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {task ? "Editar tarea" : "Nueva tarea"}
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70 transition-opacity cursor-pointer">
              <X size={16} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 pt-4 pb-4 space-y-4">
            {/* Title */}
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título de la tarea…"
              className="w-full bg-transparent text-sm font-semibold outline-none placeholder:opacity-35 mb-2"
              style={{ color: "var(--foreground)" }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) handleSubmit() }}
            />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Agregar descripción…"
              rows={2}
              className="w-full bg-transparent text-sm outline-none resize-none placeholder:opacity-35"
              style={{ color: "var(--muted-foreground)" }}
            />

            {/* Column + Due date */}
            <div
              className="px-5 py-3.5 flex gap-4"
              style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", margin: "0 -20px" }}
            >
              <div className="flex-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
                  Columna
                </label>
                <select
                  value={columnId}
                  onChange={e => setColumnId(e.target.value as TaskColumnId)}
                  className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                  style={{ backgroundColor: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                >
                  {KANBAN_COLUMNS.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
                  Fecha límite
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full text-xs rounded-lg px-3 py-2 outline-none text-left"
                  style={{ backgroundColor: "var(--muted)", color: dueDate ? "var(--foreground)" : "var(--muted-foreground)", border: "1px solid var(--border)" }}
                />
              </div>
            </div>

            {/* Assigned to */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--muted-foreground)" }}>
                Asignada a
              </label>
              <input
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                placeholder="Ann, Fabri, Juan…"
                className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                style={{ backgroundColor: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              />
            </div>

            {/* Label */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                <Tag size={10} /> Etiqueta
              </label>
              <div className="flex flex-wrap gap-1.5">
                {LABEL_PRESETS.map(preset => {
                  const active = selectedLabel?.text === preset.text
                  return (
                    <button
                      key={preset.text}
                      onClick={() => setSelectedLabel(active ? undefined : preset)}
                      className="transition-all cursor-pointer"
                      style={{
                        outline:       active ? `2px solid ${preset.color}` : "none",
                        outlineOffset: "2px",
                        borderRadius:  "9px",
                      }}
                    >
                      <LabelBadge label={preset} small />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-5 py-4 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            {task && onDelete ? (
              <button
                type="button"
                onClick={() => { onDelete(task.id); onClose() }}
                className="px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors"
                style={{
                  color:           "var(--destructive)",
                  backgroundColor: "color-mix(in srgb, var(--destructive) 12%, transparent)",
                  border:          "1px solid color-mix(in srgb, var(--destructive) 25%, var(--border))",
                }}
              >
                Eliminar
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors"
                style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!title.trim()}
                className="px-4 py-1.5 text-sm font-semibold rounded-lg cursor-pointer transition-colors disabled:opacity-40"
                style={{ backgroundColor: "#ffde21", color: "#000" }}
              >
                {task ? "Guardar" : "Crear tarea"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
