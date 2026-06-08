import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UpdateSchema = z.object({
  title:       z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate:     z.string().optional().nullable(),
  labelText:   z.string().optional(),
  labelColor:  z.string().optional(),
  columnId:    z.string().optional(),
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
        assigned_to: rest.assignedTo,
        order:       rest.order,
      }).filter(([, v]) => v !== undefined)
    ),
    updated_at: new Date().toISOString(),
  }
  if (dueDate !== undefined) updateData.due_date = dueDate ?? null

  const sb = createServiceClient()
  const { data, error } = await sb
    .from("kanban_tasks")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: "Task not found" }, { status: 404 })
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
