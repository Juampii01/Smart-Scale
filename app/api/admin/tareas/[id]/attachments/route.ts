import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BUCKET = "kanban-attachments"
const MAX_BYTES = 4 * 1024 * 1024 // 4MB (límite práctico del body en serverless)
const SIGNED_TTL = 3600           // 1h

function sanitize(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120)
}

/** GET — adjuntos de una tarea, con signed URL para descargar */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const sb = createServiceClient()
  const { data, error } = await sb
    .from("kanban_attachments")
    .select("id, file_name, file_path, size_bytes, uploaded_by, created_at")
    .eq("task_id", id)
    .order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const attachments = await Promise.all((data ?? []).map(async (a: any) => {
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(a.file_path, SIGNED_TTL)
    return { ...a, url: signed?.signedUrl ?? null }
  }))
  return NextResponse.json({ attachments })
}

/** POST — subir archivo (FormData "file") */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: "FormData inválido" }, { status: 400 }) }
  const file = form.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 })
  if (file.size > MAX_BYTES)   return NextResponse.json({ error: "El archivo supera 4MB" }, { status: 400 })

  const email = (user as { email?: string; id: string }).email ?? user.id
  const path  = `${id}/${crypto.randomUUID()}-${sanitize(file.name)}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const sb = createServiceClient()
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data, error } = await sb
    .from("kanban_attachments")
    .insert({ task_id: id, file_name: file.name, file_path: path, size_bytes: file.size, uploaded_by: email })
    .select("id, file_name, file_path, size_bytes, uploaded_by, created_at")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL)
  return NextResponse.json({ attachment: { ...data, url: signed?.signedUrl ?? null } }, { status: 201 })
}

/** DELETE — borra adjunto (registro + archivo) por ?attachment_id= */
export async function DELETE(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireInternal(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const attId = req.nextUrl.searchParams.get("attachment_id")
  if (!attId) return NextResponse.json({ error: "attachment_id requerido" }, { status: 400 })

  const sb = createServiceClient()
  const { data: att } = await sb.from("kanban_attachments").select("file_path").eq("id", attId).maybeSingle()
  if (att?.file_path) await sb.storage.from(BUCKET).remove([att.file_path])
  const { error } = await sb.from("kanban_attachments").delete().eq("id", attId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
