import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { zapierTaskEvent } from "@/lib/zapier"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COLUMN_IDS = ["por-hacer", "en-proceso", "listo"] as const

const UpdateSchema = z.object({
  title:       z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  dueDate:     z.string().optional().nullable(),
  labelText:   z.string().optional(),
  labelColor:  z.string().optional(),
  columnId:    z.enum(COLUMN_IDS).optional(),
  priority:    z.enum(["urgente", "importante", "con-tiempo"]).optional(),
  assignedTo:  z.string().optional().nullable(),
  order:       z.number().int().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const { dueDate, ...rest } = parsed.data
  const updateData: Record<string, unknown> = {
    ...Object.fromEntries(
      Object.entries({
        title:       rest.title,
        description: rest.description,
        label_text:  rest.labelText,
        label_color: rest.labelColor,
        column_id:   rest.columnId,
        priority:    rest.priority,
        assigned_to: rest.assignedTo,
        order:       rest.order,
      }).filter(([, v]) => v !== undefined)
    ),
    updated_at: new Date().toISOString(),
  }
  if (dueDate !== undefined) updateData.due_date = dueDate ?? null

  const sb = createServiceClient()

  // Leer estado anterior para detectar cambios de columna / asignación
  const { data: before } = await sb
    .from("kanban_tasks")
    .select("column_id, assigned_to")
    .eq("id", id)
    .maybeSingle()

  const { data, error } = await sb
    .from("kanban_tasks")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: "Task not found" }, { status: 404 })

  // Notificar SOLO eventos relevantes (no movimientos intermedios — saturan Slack):
  //  · completar (mover a Listo)
  //  · asignar a alguien
  const triggeredBy = (user as { email?: string; id: string }).email ?? user.id
  try {
    const completedNow = before && before.column_id !== "listo" && data.column_id === "listo"
    if (completedNow) {
      await zapierTaskEvent({
        event_type: "task.completed", task_id: data.id, title: data.title,
        triggered_by: triggeredBy, assigned_to: data.assigned_to,
        label: data.label_text || null, priority: data.priority || null,
      })
    }
    // Asignación nueva o cambiada
    const assigneeChanged = before && before.assigned_to !== data.assigned_to && data.assigned_to
    if (assigneeChanged) {
      await zapierTaskEvent({
        event_type: "task.assigned", task_id: data.id, title: data.title,
        triggered_by: triggeredBy, assigned_to: data.assigned_to,
        label: data.label_text || null, priority: data.priority || null,
        due_date: data.due_date,
      })
    }
  } catch (e) {
    console.error("[tareas/PATCH] zapier error:", e instanceof Error ? e.message : String(e))
  }

  return NextResponse.json({ task: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const sb = createServiceClient()

  const { error } = await sb.from("kanban_tasks").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
