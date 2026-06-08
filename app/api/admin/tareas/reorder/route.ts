import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ReorderSchema = z.object({
  tasks: z.array(z.object({
    id:       z.string().min(1),
    columnId: z.string().min(1),
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

  await Promise.all(
    parsed.data.tasks.map(t =>
      sb.from("tasks")
        .update({ column_id: t.columnId, order: t.order, updated_at: now })
        .eq("id", t.id)
    )
  )

  return NextResponse.json({ ok: true })
}
