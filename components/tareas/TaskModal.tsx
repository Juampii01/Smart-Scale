"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { X, Tag, Flag, Plus, Trash2, Ban, Check } from "lucide-react"
import type { TaskColumnId, TaskPriority } from "./constants"
import { KANBAN_COLUMNS, TEAM_MEMBERS, PRIORITY_LEVELS } from "./constants"
import { labelColor, initials, avatarColor } from "./avatar"
import type { Task, Subtask } from "./TaskCard"

interface TaskModalProps {
  task?:            Task | null
  defaultColumnId:  TaskColumnId
  onSave:           (data: Omit<Task, "id" | "createdAt" | "order"> & { id?: string }) => void
  onDelete?:        (id: string) => void
  onClose:          () => void
}

const labelCls = "text-[10px] font-semibold uppercase tracking-wider mb-2 block"

export function TaskModal({ task, defaultColumnId = "por-hacer", onSave, onDelete, onClose }: TaskModalProps) {
  const [title,       setTitle]       = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")
  const [dueDate,     setDueDate]     = useState(task?.dueDate ?? "")
  const [columnId,    setColumnId]    = useState<TaskColumnId>(task?.columnId ?? defaultColumnId)
  const [labelText,   setLabelText]   = useState(task?.label?.text ?? "")
  const [priority,    setPriority]    = useState<TaskPriority>(task?.priority ?? "con-tiempo")
  const [assignees,   setAssignees]   = useState<string[]>(task?.assignees ?? [])
  const [subtasks,    setSubtasks]    = useState<Subtask[]>(task?.subtasks ?? [])
  const [blocked,     setBlocked]     = useState(task?.blocked ?? false)
  const [newSub,      setNewSub]      = useState("")
  const [mounted,     setMounted]     = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  const toggleAssignee = (m: string) =>
    setAssignees(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const addSubtask = () => {
    const t = newSub.trim()
    if (!t) return
    setSubtasks(prev => [...prev, { text: t, done: false }])
    setNewSub("")
  }
  const toggleSub = (i: number) =>
    setSubtasks(prev => prev.map((s, j) => j === i ? { ...s, done: !s.done } : s))
  const removeSub = (i: number) =>
    setSubtasks(prev => prev.filter((_, j) => j !== i))

  const handleSubmit = () => {
    if (!title.trim()) return
    const lt = labelText.trim()
    onSave({
      id:          task?.id,
      title:       title.trim(),
      description: description.trim() || undefined,
      dueDate:     dueDate || undefined,
      label:       lt ? { text: lt, color: labelColor(lt) } : undefined,
      priority,
      assignees,
      subtasks,
      blocked,
      columnId,
    })
    onClose()
  }

  if (!mounted) return null

  const doneCount = subtasks.filter(s => s.done).length

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100]"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          role="dialog" aria-modal
          className="fixed top-0 right-0 bottom-0 w-[min(460px,94vw)] flex flex-col shadow-2xl"
          style={{ backgroundColor: "var(--card)", borderLeft: "1px solid var(--border)" }}
          initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 32 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {task ? "Detalle de la tarea" : "Nueva tarea"}
            </span>
            <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70 transition-opacity cursor-pointer">
              <X size={18} style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>

          {/* Body (scroll) */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Title + descripción */}
            <div>
              <input
                autoFocus value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Título de la tarea…"
                className="w-full bg-transparent text-lg font-bold outline-none placeholder:opacity-35"
                style={{ color: "var(--foreground)" }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) handleSubmit() }}
              />
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Agregar descripción…" rows={2}
                className="w-full bg-transparent text-sm outline-none resize-none placeholder:opacity-35 mt-1.5"
                style={{ color: "var(--muted-foreground)" }}
              />
            </div>

            {/* Bloqueada toggle */}
            <button
              onClick={() => setBlocked(b => !b)}
              className="flex items-center gap-2 text-xs font-semibold rounded-lg px-3 py-2 transition-all w-full"
              style={{
                backgroundColor: blocked ? "color-mix(in srgb, #ef4444 12%, transparent)" : "var(--muted)",
                color:           blocked ? "#ef4444" : "var(--muted-foreground)",
                border:          `1px solid ${blocked ? "color-mix(in srgb, #ef4444 35%, transparent)" : "var(--border)"}`,
              }}
            >
              <Ban size={13} /> {blocked ? "Tarea bloqueada" : "Marcar como bloqueada"}
            </button>

            {/* Columna + Fecha */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>Columna</label>
                <select
                  value={columnId} onChange={e => setColumnId(e.target.value as TaskColumnId)}
                  className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                  style={{ backgroundColor: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                >
                  {KANBAN_COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>Fecha límite</label>
                <input
                  type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                  style={{ backgroundColor: "var(--muted)", color: dueDate ? "var(--foreground)" : "var(--muted-foreground)", border: "1px solid var(--border)" }}
                />
              </div>
            </div>

            {/* Urgencia */}
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>
                <Flag size={10} className="inline mb-0.5 mr-1" /> Urgencia
              </label>
              <div className="flex gap-1.5">
                {PRIORITY_LEVELS.map(p => {
                  const active = priority === p.id
                  return (
                    <button
                      key={p.id} type="button" onClick={() => setPriority(p.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg px-2 py-2 transition-all"
                      style={{
                        backgroundColor: active ? `color-mix(in srgb, ${p.color} 15%, transparent)` : "var(--muted)",
                        color:           active ? p.color : "var(--muted-foreground)",
                        border:          `1px solid ${active ? p.color : "var(--border)"}`,
                      }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Asignados (múltiples) */}
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>Asignados</label>
              <div className="flex flex-wrap gap-1.5">
                {TEAM_MEMBERS.map(m => {
                  const active = assignees.includes(m)
                  return (
                    <button
                      key={m} type="button" onClick={() => toggleAssignee(m)}
                      className="flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 text-xs font-semibold transition-all"
                      style={{
                        backgroundColor: active ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--muted)",
                        color:           active ? "var(--foreground)" : "var(--muted-foreground)",
                        border:          `1px solid ${active ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--border)"}`,
                      }}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full text-[8.5px] font-bold text-white"
                        style={{ backgroundColor: avatarColor(m) }}>
                        {initials(m)}
                      </span>
                      {m}
                      {active && <Check size={12} />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Etiqueta */}
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>
                <Tag size={10} className="inline mb-0.5 mr-1" /> Etiqueta
              </label>
              <input
                value={labelText} onChange={e => setLabelText(e.target.value)}
                placeholder="De qué se trata (ej: Reel cliente X, Edición…)" maxLength={40}
                className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                style={{ backgroundColor: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              />
            </div>

            {/* Subtareas */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center justify-between" style={{ color: "var(--muted-foreground)" }}>
                <span>Subtareas</span>
                {subtasks.length > 0 && <span style={{ color: "var(--foreground)" }}>{doneCount}/{subtasks.length}</span>}
              </label>
              <div className="space-y-1.5">
                {subtasks.map((s, i) => (
                  <div key={i} className="group/sub flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--muted)" }}>
                    <button onClick={() => toggleSub(i)} className="shrink-0 flex items-center justify-center rounded h-4 w-4"
                      style={{ border: `1.5px solid ${s.done ? "#22C55E" : "var(--border)"}`, backgroundColor: s.done ? "#22C55E" : "transparent" }}>
                      {s.done && <Check size={11} className="text-white" />}
                    </button>
                    <span className="flex-1 text-[13px]" style={{ color: s.done ? "var(--muted-foreground)" : "var(--foreground)", textDecoration: s.done ? "line-through" : "none" }}>
                      {s.text}
                    </span>
                    <button onClick={() => removeSub(i)} className="shrink-0 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                      <Trash2 size={12} style={{ color: "var(--muted-foreground)" }} />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: "1px dashed var(--border)" }}>
                  <Plus size={13} style={{ color: "var(--muted-foreground)" }} />
                  <input
                    value={newSub} onChange={e => setNewSub(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSubtask() } }}
                    placeholder="Agregar subtarea…"
                    className="flex-1 bg-transparent text-[13px] outline-none placeholder:opacity-40"
                    style={{ color: "var(--foreground)" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
            {task && onDelete ? (
              <button
                type="button" onClick={() => { onDelete(task.id); onClose() }}
                className="px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors text-red-700 dark:text-red-400"
                style={{ backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 25%, var(--border))" }}
              >
                Eliminar
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors"
                style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                Cancelar
              </button>
              <button type="button" onClick={handleSubmit} disabled={!title.trim()}
                className="px-4 py-1.5 text-sm font-semibold rounded-lg cursor-pointer transition-colors disabled:opacity-40"
                style={{ backgroundColor: "#ffde21", color: "#000" }}>
                {task ? "Guardar" : "Crear tarea"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
