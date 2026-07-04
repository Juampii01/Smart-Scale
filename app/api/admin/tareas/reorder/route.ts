import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { zapierTaskEvent } from "@/lib/zapier"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COLUMN_IDS = ["por-hacer", "en-proceso", "en-revision", "listo"] as const

const ReorderSchema = z.object({
  tasks: z.array(z.object({
    id:       z.string().min(1),
    columnId: z.enum(COLUMN_IDS),
    order:    z.number().int().min(0),
  })).min(1).max(200),
})

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const parsed = ReorderSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const sb = createServiceClient()
  const now = new Date().toISOString()

  // Estado anterior para detectar qué tareas cambiaron de COLUMNA (no solo orden)
  const ids = parsed.data.tasks.map(t => t.id)
  const { data: before } = await sb
    .from("kanban_tasks")
    .select("id, title, column_id, assignees, label_text, priority")
    .in("id", ids)
  const beforeById = new Map((before ?? []).map(b => [b.id, b]))

  await Promise.all(
    parsed.data.tasks.map(t =>
      sb.from("kanban_tasks")
        .update({ column_id: t.columnId, order: t.order, updated_at: now })
        .eq("id", t.id)
    )
  )

  // Notificar a Slack solo lo relevante al arrastrar:
  //  · Completar (a Listo)
  //  · Pasar a revisión (a En revisión) → aviso para Ann
  // Los movimientos entre Por hacer / En proceso NO avisan.
  const triggeredBy = (user as { email?: string; id: string }).email ?? user.id
  const joinAssignees = (a: unknown) => Array.isArray(a) ? (a as string[]).join(" y ") || null : null
  try {
    for (const t of parsed.data.tasks) {
      const prev = beforeById.get(t.id)
      if (!prev) continue
      const meta = {
        task_id: t.id, title: prev.title, triggered_by: triggeredBy,
        assigned_to: joinAssignees(prev.assignees),
        label: prev.label_text || null, priority: prev.priority || null,
      }
      if (prev.column_id !== "listo" && t.columnId === "listo") {
        await zapierTaskEvent({ event_type: "task.completed", ...meta })
      } else if (prev.column_id !== "en-revision" && t.columnId === "en-revision") {
        await zapierTaskEvent({ event_type: "task.review", ...meta })
      }
    }
  } catch (e) {
    console.error("[tareas/reorder] zapier error:", e instanceof Error ? e.message : String(e))
  }

  return NextResponse.json({ ok: true })
}
