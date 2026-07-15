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
import { KANBAN_COLUMNS, TEAM_MEMBERS } from "./constants"
import type { TaskColumnId } from "./constants"
import { KanbanColumn } from "./KanbanColumn"
import { TaskCard } from "./TaskCard"
import type { Task } from "./TaskCard"
import { TaskModal } from "./TaskModal"
import { initials, avatarColor } from "./avatar"

interface ApiTask {
  id:          string
  title:       string
  description: string
  due_date:    string | null
  label_text:  string
  label_color: string
  column_id:   string
  priority:    string | null
  assignees:   string[] | null
  assigned_to: string | null
  subtasks:    { text: string; done: boolean }[] | null
  blocked:     boolean | null
  created_by:  string | null
  comments_count?: number
  attachments_count?: number
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
    priority:    (t.priority as Task["priority"]) ?? "con-tiempo",
    createdAt:   t.created_at,
    order:       t.order,
    assignees:   t.assignees ?? (t.assigned_to ? [t.assigned_to] : []),
    subtasks:    t.subtasks ?? [],
    blocked:     t.blocked ?? false,
    commentsCount:    t.comments_count ?? 0,
    attachmentsCount: t.attachments_count ?? 0,
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

  // Filtros
  const [filterDue,      setFilterDue]      = useState<null | "overdue" | "today">(null)
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null) // nombre o "__none__"

  const reorderTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reorderPendingRef   = useRef<Task[] | null>(null)
  // Snapshot del estado al iniciar el drag — para detectar qué cambió de verdad
  // (handleDragOver muta el estado en vivo, así que no podemos comparar contra prev)
  const dragStartSnapshotRef = useRef<Task[]>([])
  // Ref espejo de activeTask para leerlo dentro del callback de Realtime
  const isDraggingRef        = useRef(false)

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

  // Realtime: el tablero se sincroniza en vivo entre los miembros del equipo.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("kanban_tasks_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kanban_tasks" },
        (payload) => {
          // No pisar el estado mientras el usuario arrastra una tarjeta
          if (isDraggingRef.current) return

          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string })?.id
            if (oldId) setTasks(prev => prev.filter(t => t.id !== oldId))
            return
          }

          // INSERT / UPDATE → reconciliar por id
          const row = payload.new as ApiTask
          if (!row?.id) return
          const incoming = apiToUiTask(row)
          setTasks(prev => {
            const exists = prev.some(t => t.id === incoming.id)
            if (exists) return prev.map(t => t.id === incoming.id ? incoming : t)
            return [...prev, incoming]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
    isDraggingRef.current = true
    // Guardar snapshot del estado antes de que dragOver lo mute
    dragStartSnapshotRef.current = tasks
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
    isDraggingRef.current = false
    if (!over) return
    const activeId = active.id as string
    const overId   = over.id   as string

    setTasks(prev => {
      const draggedTask = prev.find(t => t.id === activeId)
      if (!draggedTask) return prev

      const overTask    = prev.find(t => t.id === overId)
      const overColumn  = KANBAN_COLUMNS.find(c => c.id === overId)
      // Columna destino: la de la tarjeta sobre la que soltamos, o la columna
      // directa (drop en zona vacía), o la actual (que dragOver ya pudo cambiar).
      const targetColId = overTask?.columnId ?? overColumn?.id ?? draggedTask.columnId

      let updated: Task[]

      if (overTask && overTask.columnId === draggedTask.columnId && overId !== activeId) {
        // Reorden dentro de la misma columna
        const colTasks  = prev.filter(t => t.columnId === targetColId)
        const activeIdx = colTasks.findIndex(t => t.id === activeId)
        const overIdx   = colTasks.findIndex(t => t.id === overId)
        const reordered = arrayMove(colTasks, activeIdx, overIdx).map((t, i) => ({ ...t, order: i }))
        updated = [...prev.filter(t => t.columnId !== targetColId), ...reordered]
      } else {
        // Cross-column o drop en columna (vacía o no). Insertamos en la posición
        // de overTask, o al final si soltamos sobre la columna.
        const targetColTasks = prev
          .filter(t => t.columnId === targetColId && t.id !== activeId)
          .sort((a, b) => a.order - b.order)
        const overIdx  = overTask ? targetColTasks.findIndex(t => t.id === overId) : -1
        const insertAt = overIdx === -1 ? targetColTasks.length : overIdx
        const reinserted = [
          ...targetColTasks.slice(0, insertAt),
          { ...draggedTask, columnId: targetColId },
          ...targetColTasks.slice(insertAt),
        ].map((t, i) => ({ ...t, order: i }))
        updated = [
          ...prev.filter(t => t.columnId !== targetColId && t.id !== activeId),
          ...reinserted,
        ]
      }

      // Comparar contra el snapshot del INICIO del drag (no contra prev, que
      // dragOver ya mutó) para detectar todos los cambios reales a persistir.
      const original = dragStartSnapshotRef.current
      const changed = updated.filter(t => {
        const orig = original.find(p => p.id === t.id)
        return !orig || orig.columnId !== t.columnId || orig.order !== t.order
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
            priority:    data.priority ?? "con-tiempo",
            assignees:   data.assignees ?? [],
            subtasks:    data.subtasks ?? [],
            blocked:     data.blocked ?? false,
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
            priority:    data.priority ?? "con-tiempo",
            assignees:   data.assignees ?? [],
            subtasks:    data.subtasks ?? [],
            blocked:     data.blocked ?? false,
            order:       colTasks.length,
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { task: apiTask } = await res.json() as { task: ApiTask }
        const real = apiToUiTask(apiTask)
        // Dedupe: por si Realtime ya insertó la misma tarea
        setTasks(prev => [...prev.filter(t => t.id !== real.id), real])
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
    const optimistic: Task = { id: tempId, title: trimmed, columnId, order: colTasks.length, createdAt: new Date().toISOString(), priority: "con-tiempo", assignees: [], subtasks: [], blocked: false }
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
      const real = apiToUiTask(apiTask)
      // Reemplazar la temp y deduplicar por si Realtime ya insertó la real
      setTasks(prev => [...prev.filter(t => t.id !== tempId && t.id !== real.id), real])
    } catch (err) {
      setTasks(prev => prev.filter(t => t.id !== tempId))
      toast.error(`Error al crear: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [tasks])

  const handleComplete = useCallback(async (task: Task) => {
    const targetCol: TaskColumnId = task.columnId === "listo" ? "por-hacer" : "listo"
    // La tarea va al FINAL de la columna destino — orden = cantidad actual ahí
    const newOrder = tasks.filter(t => t.columnId === targetCol).length
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, columnId: targetCol, order: newOrder } : t))
    const token = await getToken()
    try {
      const res = await fetch(`/api/admin/tareas/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ columnId: targetCol, order: newOrder }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, columnId: task.columnId, order: task.order } : t))
      toast.error("Error al actualizar tarea")
    }
  }, [tasks])

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
                priority:    deleted.priority ?? "con-tiempo",
                assignees:   deleted.assignees ?? [],
                subtasks:    deleted.subtasks ?? [],
                blocked:     deleted.blocked ?? false,
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

  // ── Métricas (sobre TODAS las tareas, no filtradas) ────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = (t: Task) => !!t.dueDate && t.dueDate < today && t.columnId !== "listo"
  const isDueToday = (t: Task) => t.dueDate === today && t.columnId !== "listo"
  const metrics = {
    total:      tasks.length,
    overdue:    tasks.filter(isOverdue).length,
    today:      tasks.filter(isDueToday).length,
    unassigned: tasks.filter(t => t.assignees.length === 0 && t.columnId !== "listo").length,
  }

  // ── Tareas visibles según filtros ──────────────────────────────────────────
  const visibleTasks = tasks.filter(t => {
    if (filterDue === "overdue" && !isOverdue(t)) return false
    if (filterDue === "today"   && !isDueToday(t)) return false
    if (filterAssignee === "__none__" && t.assignees.length > 0) return false
    if (filterAssignee && filterAssignee !== "__none__" && !t.assignees.includes(filterAssignee)) return false
    return true
  })

  const anyFilter = filterDue !== null || filterAssignee !== null
  const clearFilters = () => { setFilterDue(null); setFilterAssignee(null) }

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
            <CheckSquare className="h-6 w-6 text-[#dafc69]" />
            Tareas
          </h1>
          <p className="text-sm text-foreground/40 mt-1">Tablero compartido · Ann · Steffano · Juan</p>
        </div>
        <button
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#dafc69] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#f2ffc0] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nueva tarea
        </button>
      </div>

      {/* Barra de filtros + métricas */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Chips de métricas (actúan como filtros rápidos) */}
        <button
          onClick={clearFilters}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            !anyFilter ? "bg-foreground/10 text-foreground" : "text-foreground/40 hover:bg-foreground/[0.05]"
          }`}
        >
          Todas <span className="tabular-nums opacity-60">{metrics.total}</span>
        </button>

        <button
          onClick={() => setFilterDue(d => d === "overdue" ? null : "overdue")}
          disabled={metrics.overdue === 0}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all disabled:opacity-30 ${
            filterDue === "overdue"
              ? "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-500/30"
              : "text-red-700/70 dark:text-red-400/70 hover:bg-red-500/[0.08]"
          }`}
        >
          Vencidas <span className="tabular-nums">{metrics.overdue}</span>
        </button>

        <button
          onClick={() => setFilterDue(d => d === "today" ? null : "today")}
          disabled={metrics.today === 0}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all disabled:opacity-30 ${
            filterDue === "today"
              ? "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/30"
              : "text-amber-700/70 dark:text-amber-400/70 hover:bg-amber-500/[0.08]"
          }`}
        >
          Hoy <span className="tabular-nums">{metrics.today}</span>
        </button>

        <button
          onClick={() => setFilterAssignee(a => a === "__none__" ? null : "__none__")}
          disabled={metrics.unassigned === 0}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all disabled:opacity-30 ${
            filterAssignee === "__none__" ? "bg-foreground/10 text-foreground" : "text-foreground/40 hover:bg-foreground/[0.05]"
          }`}
        >
          Sin asignar <span className="tabular-nums opacity-60">{metrics.unassigned}</span>
        </button>

        {/* Divisor */}
        <div className="h-5 w-px mx-1" style={{ backgroundColor: "var(--border)" }} />

        {/* Avatares para filtrar por persona */}
        {TEAM_MEMBERS.map(m => {
          const active = filterAssignee === m
          return (
            <button
              key={m}
              onClick={() => setFilterAssignee(a => a === m ? null : m)}
              title={`Filtrar por ${m}`}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white transition-all ${
                active ? "ring-2 ring-offset-1 ring-offset-[var(--background)]" : "opacity-50 hover:opacity-100"
              }`}
              style={{ backgroundColor: avatarColor(m), ...(active ? { boxShadow: `0 0 0 2px ${avatarColor(m)}` } : {}) }}
            >
              {initials(m)}
            </button>
          )
        })}

        {anyFilter && (
          <button
            onClick={clearFilters}
            className="ml-1 text-xs text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 flex-1 min-h-0 overflow-x-auto -mx-6 px-6 pb-2">
          {KANBAN_COLUMNS.map(col => {
            const colTasks = visibleTasks.filter(t => t.columnId === col.id).sort((a, b) => a.order - b.order)
            return (
              <div key={col.id} className="flex-1 min-w-[280px] min-h-0 flex flex-col">
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
    <div className="flex gap-4 flex-1 overflow-x-auto">
      {KANBAN_COLUMNS.map(col => (
        <div key={col.id} className="flex-1 min-w-[280px] flex flex-col gap-2">
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
