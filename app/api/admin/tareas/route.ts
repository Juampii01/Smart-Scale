import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { zapierTaskEvent } from "@/lib/zapier"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COLUMN_IDS = ["por-hacer", "en-proceso", "en-revision", "listo"] as const

const SubtaskSchema = z.object({ text: z.string(), done: z.boolean() })

const CreateSchema = z.object({
  title:       z.string().min(1).max(300),
  description: z.string().optional(),
  dueDate:     z.string().optional().nullable(),
  labelText:   z.string().optional(),
  labelColor:  z.string().optional(),
  columnId:    z.enum(COLUMN_IDS).optional(),
  priority:    z.enum(["urgente", "importante", "con-tiempo"]).optional(),
  assignees:   z.array(z.string()).optional(),
  subtasks:    z.array(SubtaskSchema).optional(),
  blocked:     z.boolean().optional(),
  order:       z.number().int().optional(),
})

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const { data, error } = await sb
    .from("kanban_tasks")
    .select("*")
    .order("column_id", { ascending: true })
    .order("order", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const { title, description, dueDate, labelText, labelColor, columnId, priority, assignees, subtasks, blocked, order } = parsed.data
  const resolvedColumnId = columnId ?? "por-hacer"
  const resolvedAssignees = assignees ?? []

  const sb = createServiceClient()

  // Get current count in column for order
  const { count } = await sb
    .from("kanban_tasks")
    .select("id", { count: "exact", head: true })
    .eq("column_id", resolvedColumnId)

  const taskOrder = order !== undefined ? order : (count ?? 0)

  const { data, error } = await sb
    .from("kanban_tasks")
    .insert({
      title,
      description: description ?? "",
      due_date:    dueDate ? dueDate : null,
      label_text:  labelText ?? "",
      label_color: labelColor ?? "",
      column_id:   resolvedColumnId,
      priority:    priority ?? "con-tiempo",
      assignees:   resolvedAssignees,
      assigned_to: resolvedAssignees[0] ?? null,  // compat con campo legacy
      subtasks:    subtasks ?? [],
      blocked:     blocked ?? false,
      created_by:  (user as { email?: string; id: string }).email ?? user.id,
      order:       taskOrder,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notificar a Slack vía Zapier (best-effort, no bloquea la respuesta)
  const triggeredBy = (user as { email?: string; id: string }).email ?? user.id
  try {
    // Un solo mensaje: "Nueva tarea" ya incluye a quién está asignada.
    // El evento task.assigned solo se dispara al asignar una tarea existente (PATCH).
    await zapierTaskEvent({
      event_type:   "task.created",
      task_id:      data.id,
      title:        data.title,
      triggered_by: triggeredBy,
      assigned_to:  (data.assignees ?? []).join(" y ") || null,
      to_column:    data.column_id,
      label:        data.label_text || null,
      priority:     data.priority || null,
      due_date:     data.due_date,
    })
  } catch (e) {
    console.error("[tareas/POST] zapier error:", e instanceof Error ? e.message : String(e))
  }

  return NextResponse.json({ task: data }, { status: 201 })
}
