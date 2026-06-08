import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { zapierTaskEvent } from "@/lib/zapier"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const COLUMN_IDS = ["por-hacer", "en-proceso", "listo"] as const

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
    .select("id, title, column_id, assigned_to")
    .in("id", ids)
  const beforeById = new Map((before ?? []).map(b => [b.id, b]))

  await Promise.all(
    parsed.data.tasks.map(t =>
      sb.from("kanban_tasks")
        .update({ column_id: t.columnId, order: t.order, updated_at: now })
        .eq("id", t.id)
    )
  )

  // Notificar SOLO completadas (arrastrar a Listo). Los movimientos entre
  // Por hacer / En proceso NO avisan — saturarían Slack.
  const triggeredBy = (user as { email?: string; id: string }).email ?? user.id
  try {
    const completed = parsed.data.tasks.filter(t => {
      const prev = beforeById.get(t.id)
      return prev && prev.column_id !== "listo" && t.columnId === "listo"
    })
    for (const t of completed) {
      const prev = beforeById.get(t.id)!
      await zapierTaskEvent({
        event_type: "task.completed", task_id: t.id, title: prev.title,
        triggered_by: triggeredBy, assigned_to: prev.assigned_to,
      })
    }
  } catch (e) {
    console.error("[tareas/reorder] zapier error:", e instanceof Error ? e.message : String(e))
  }

  return NextResponse.json({ ok: true })
}
