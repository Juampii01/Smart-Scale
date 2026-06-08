import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CreateSchema = z.object({
  title:       z.string().min(1),
  description: z.string().optional(),
  dueDate:     z.string().optional().nullable(),
  labelText:   z.string().optional(),
  labelColor:  z.string().optional(),
  columnId:    z.string().optional(),
  assignedTo:  z.string().optional().nullable(),
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

  const { title, description, dueDate, labelText, labelColor, columnId, assignedTo, order } = parsed.data
  const resolvedColumnId = columnId ?? "por-hacer"

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
      assigned_to: assignedTo ?? null,
      created_by:  (user as { email?: string; id: string }).email ?? user.id,
      order:       taskOrder,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data }, { status: 201 })
}
