import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { resolveTeamName } from "@/lib/team"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CreateSchema = z.object({ body: z.string().min(1).max(2000) })

/** GET — comentarios de una tarea (cronológico) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const sb = createServiceClient()
  const { data, error } = await sb
    .from("kanban_comments")
    .select("id, author, body, created_at")
    .eq("task_id", id)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data ?? [] })
}

/** POST — agregar comentario (autor resuelto del usuario logueado) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const email  = (user as { email?: string; id: string }).email ?? user.id
  const author = resolveTeamName(email) ?? "Alguien"

  const sb = createServiceClient()
  const { data, error } = await sb
    .from("kanban_comments")
    .insert({ task_id: id, author, author_id: email, body: parsed.data.body })
    .select("id, author, body, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: data }, { status: 201 })
}

/** DELETE — borrar comentario propio (por id en query) */
export async function DELETE(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const commentId = req.nextUrl.searchParams.get("comment_id")
  if (!commentId) return NextResponse.json({ error: "comment_id requerido" }, { status: 400 })

  const sb = createServiceClient()
  const { error } = await sb.from("kanban_comments").delete().eq("id", commentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
