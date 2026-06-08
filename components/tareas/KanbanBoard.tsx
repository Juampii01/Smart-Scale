"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  KeyboardSensor, PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core"
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { AnimatePresence } from "motion/react"
import { Plus, CheckSquare } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import { KANBAN_COLUMNS } from "./constants"
import type { TaskColumnId } from "./constants"
import { KanbanColumn } from "./KanbanColumn"
import { TaskCard } from "./TaskCard"
import type { Task } from "./TaskCard"
import { TaskModal } from "./TaskModal"

interface ApiTask {
  id:          string
  title:       string
  description: string
  due_date:    string | null
  label_text:  string
  label_color: string
  column_id:   string
  assigned_to: string | null
  created_by:  string | null
  order:       number
  created_at:  string
  updated_at:  string
}

function apiToUiTask(t: ApiTask): Task {
  return {
    id:          t.id,
    title:       t.title,
    description: t.description || undefined,
    dueDate:     t.due_date ? t.due_date.slice(0, 10) : undefined,
    label:       t.label_text && t.label_color
                   ? { text: t.label_text, color: t.label_color }
                   : undefined,
    columnId:    t.column_id as TaskColumnId,
    createdAt:   t.created_at,
    order:       t.order,
    assignedTo:  t.assigned_to ?? undefined,
  }
}

async function getToken(): Promise<string> {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? ""
}

export function KanbanBoard() {
  const [tasks,       setTasks]       = useState<Task[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState(false)
  const [activeTask,  setActiveTask]  = useState<Task | null>(null)
  const [modalConfig, setModalConfig] = useState<{
    open: boolean; task?: Task | null; defaultColumnId?: TaskColumnId
  }>({ open: false })

  const reorderTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reorderPendingRef = useRef<Task[] | null>(null)

  // Initial fetch
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getToken().then(token =>
      fetch("/api/admin/tareas", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<{ tasks: ApiTask[] }> })
      .then(({ tasks: apiTasks }) => {
        if (!cancelled) setTasks(apiTasks.map(apiToUiTask))
      })
      .catch(err => {
        if (!cancelled) {
          toast.error(`Error al cargar tareas: ${err instanceof Error ? err.message : String(err)}`)
          setLoadError(true)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    )
    return () => { cancelled = true }
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current) }
  }, [])

  // Debounced batch reorder
  function scheduleBatchReorder(updatedTasks: Task[]) {
    reorderPendingRef.current = updatedTasks
    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current)
    reorderTimerRef.current = setTimeout(async () => {
      const snapshot = reorderPendingRef.current
      reorderPendingRef.current = null
      if (!snapshot) return
      const payload = snapshot.map(t => ({ id: t.id, columnId: t.columnId, order: t.order }))
      const token = await getToken()
      fetch("/api/admin/tareas/reorder", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ tasks: payload }),
      }).catch(() => toast.error("Error al guardar el orden"))
    }, 60)
  }

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    const found = tasks.find(t => t.id === event.active.id)
    setActiveTask(found ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId   = over.id   as string
    const draggedTask = tasks.find(t => t.id === activeId)
    if (!draggedTask) return
    const overColumn = KANBAN_COLUMNS.find(c => c.id === overId)
    if (overColumn && draggedTask.columnId !== overColumn.id) {
      setTasks(prev => prev.map(t => t.id === activeId ? { ...t, columnId: overColumn.id } : t))
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return
    const activeId = active.id as string
    const overId   = over.id   as string
    if (activeId === overId) return

    setTasks(prev => {
      const draggedTask = prev.find(t => t.id === activeId)
      const overTask   = prev.find(t => t.id === overId)
      if (!draggedTask) return prev
      let updated = prev

      if (overTask) {
        const sameCol = draggedTask.columnId === overTask.columnId
        if (sameCol) {
          const colTasks   = prev.filter(t => t.columnId === draggedTask.columnId)
          const activeIdx  = colTasks.findIndex(t => t.id === activeId)
          const overIdx    = colTasks.findIndex(t => t.id === overId)
          const reordered  = arrayMove(colTasks, activeIdx, overIdx).map((t, i) => ({ ...t, order: i }))
          updated = [...prev.filter(t => t.columnId !== draggedTask.columnId), ...reordered]
        } else {
          const targetColTasks = prev.filter(t => t.columnId === overTask.columnId && t.id !== activeId).sort((a, b) => a.order - b.order)
          const overIdx        = targetColTasks.findIndex(t => t.id === overId)
          const insertAt       = overIdx === -1 ? targetColTasks.length : overIdx
          const reinserted = [
            ...targetColTasks.slice(0, insertAt),
            { ...draggedTask, columnId: overTask.columnId },
            ...targetColTasks.slice(insertAt),
          ].map((t, i) => ({ ...t, order: i }))
          updated = [
            ...prev.filter(t => t.columnId !== overTask.columnId && t.id !== activeId),
            ...reinserted,
          ]
        }
      }

      const changed = updated.filter(t => {
        const orig = prev.find(p => p.id === t.id)
        return orig && (orig.columnId !== t.columnId || orig.order !== t.order)
      })
      if (changed.length > 0) scheduleBatchReorder(changed)
      return updated
    })
  }

  // Modal helpers
  const openCreateModal = (columnId: TaskColumnId = "por-hacer") => {
    setModalConfig({ open: true, task: null, defaultColumnId: columnId })
  }
  const openEditModal = useCallback((task: Task) => {
    setModalConfig({ open: true, task })
  }, [])

  // CRUD handlers
  const handleSave = useCallback(async (data: Omit<Task, "id" | "createdAt" | "order"> & { id?: string }) => {
    const token = await getToken()
    if (data.id) {
      // Update
      try {
        const res = await fetch(`/api/admin/tareas/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title:       data.title,
            description: data.description ?? "",
            dueDate:     data.dueDate ? data.dueDate + "T00:00:00" : null,
            labelText:   data.label?.text  ?? "",
            labelColor:  data.label?.color ?? "",
            columnId:    data.columnId,
            assignedTo:  data.assignedTo ?? null,
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { task: apiTask } = await res.json() as { task: ApiTask }
        setTasks(prev => prev.map(t => t.id === data.id ? apiToUiTask(apiTask) : t))
        toast.success("Tarea actualizada")
      } catch (err) {
        toast.error(`Error al actualizar: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else {
      // Create
      const colTasks = tasks.filter(t => t.columnId === data.columnId)
      try {
        const res = await fetch("/api/admin/tareas", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title:       data.title,
            description: data.description ?? "",
            dueDate:     data.dueDate ? data.dueDate + "T00:00:00" : null,
            labelText:   data.label?.text  ?? "",
            labelColor:  data.label?.color ?? "",
            columnId:    data.columnId,
            assignedTo:  data.assignedTo ?? null,
            order:       colTasks.length,
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { task: apiTask } = await res.json() as { task: ApiTask }
        setTasks(prev => [...prev, apiToUiTask(apiTask)])
        toast.success("Tarea creada")
      } catch (err) {
        toast.error(`Error al crear: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }, [tasks])

  const handleQuickAdd = useCallback(async (columnId: TaskColumnId, title: string) => {
    const trimmed  = title.trim()
    if (!trimmed) return
    const colTasks = tasks.filter(t => t.columnId === columnId)
    const tempId   = `temp-${Date.now()}`
    const optimistic: Task = { id: tempId, title: trimmed, columnId, order: colTasks.length, createdAt: new Date().toISOString() }
    setTasks(prev => [...prev, optimistic])
    toast.success("Tarea creada")
    const token = await getToken()
    try {
      const res = await fetch("/api/admin/tareas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: trimmed, description: "", columnId, order: colTasks.length }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { task: apiTask } = await res.json() as { task: ApiTask }
      setTasks(prev => prev.map(t => t.id === tempId ? apiToUiTask(apiTask) : t))
    } catch (err) {
      setTasks(prev => prev.filter(t => !t.id.startsWith("temp-")))
      toast.error(`Error al crear: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [tasks])

  const handleComplete = useCallback(async (task: Task) => {
    const targetCol: TaskColumnId = task.columnId === "listo" ? "por-hacer" : "listo"
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, columnId: targetCol } : t))
    const token = await getToken()
    try {
      const res = await fetch(`/api/admin/tareas/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ columnId: targetCol }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, columnId: task.columnId } : t))
      toast.error("Error al actualizar tarea")
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    const deleted = tasks.find(t => t.id === id)
    setTasks(prev => prev.filter(t => t.id !== id))
    toast.success("Tarea eliminada", {
      action: {
        label: "Deshacer",
        onClick: async () => {
          if (!deleted) return
          const token = await getToken()
          try {
            const res = await fetch("/api/admin/tareas", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                title:       deleted.title,
                description: deleted.description ?? "",
                dueDate:     deleted.dueDate ? deleted.dueDate + "T00:00:00" : null,
                labelText:   deleted.label?.text  ?? "",
                labelColor:  deleted.label?.color ?? "",
                columnId:    deleted.columnId,
                order:       deleted.order,
              }),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const { task: apiTask } = await res.json() as { task: ApiTask }
            setTasks(prev => [...prev, apiToUiTask(apiTask)].sort((a, b) => a.order - b.order))
          } catch { toast.error("No se pudo deshacer") }
        },
      },
    })
    const token = await getToken()
    try {
      const res = await fetch(`/api/admin/tareas/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      if (deleted) setTasks(prev => [...prev, deleted].sort((a, b) => a.order - b.order))
      toast.error(`Error al eliminar: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [tasks])

  if (loading) return <KanbanSkeleton />
  if (loadError && tasks.length === 0) return (
    <div className="flex items-center justify-center py-16 text-sm" style={{ color: "var(--muted-foreground)" }}>
      Error al cargar las tareas. Recargá la página.
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-[#ffde21]" />
            Tareas
          </h1>
          <p className="text-sm text-foreground/40 mt-1">Tablero compartido · Ann · Fabri · Juan</p>
        </div>
        <button
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#ffe46b] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nueva tarea
        </button>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-3 gap-5 flex-1 min-h-0 overflow-x-auto xl:overflow-x-visible -mx-6 px-6 xl:mx-0 xl:px-0">
          {KANBAN_COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.columnId === col.id).sort((a, b) => a.order - b.order)
            return (
              <div key={col.id} className="shrink-0 xl:shrink w-[280px] xl:w-auto min-h-0 flex flex-col">
                <KanbanColumn
                  id={col.id}
                  title={col.label}
                  tasks={colTasks}
                  accentColor={col.color}
                  onAddTask={openCreateModal}
                  onEditTask={openEditModal}
                  onQuickAdd={handleQuickAdd}
                  onComplete={handleComplete}
                />
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <div style={{ transform: "rotate(2deg)", opacity: 0.95 }}>
              <TaskCard task={activeTask} onClick={() => {}} onComplete={() => {}} isOverlay />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {modalConfig.open && (
          <TaskModal
            key="task-modal"
            task={modalConfig.task}
            defaultColumnId={modalConfig.defaultColumnId ?? "por-hacer"}
            onSave={handleSave}
            onDelete={modalConfig.task ? handleDelete : undefined}
            onClose={() => setModalConfig({ open: false })}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-5 flex-1">
      {KANBAN_COLUMNS.map(col => (
        <div key={col.id} className="shrink-0 xl:shrink w-[280px] xl:w-auto flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1 px-1">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: col.color, opacity: 0.4 }} />
            <div className="h-3 w-20 rounded-full animate-pulse" style={{ backgroundColor: "var(--muted)" }} />
            <div className="h-3 w-5 rounded-full animate-pulse" style={{ backgroundColor: "var(--muted)" }} />
          </div>
          <div className="rounded-xl p-2" style={{ backgroundColor: "var(--muted)" }}>
            {[1, 2].map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-3 mb-2 last:mb-0"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="h-2.5 w-16 rounded-full mb-2 animate-pulse" style={{ backgroundColor: "var(--muted)" }} />
                <div className="h-full w-3/4 rounded-full animate-pulse" style={{ backgroundColor: "var(--muted)" }} />
                <div className="h-3 w-1/2 rounded-full mt-1.5 animate-pulse" style={{ backgroundColor: "var(--muted)" }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
