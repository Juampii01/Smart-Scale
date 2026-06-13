import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BUCKET = "avatars"
const MAX_BYTES = 2 * 1024 * 1024 // 2MB
const SIGNED_TTL = 60 * 60 * 24 * 7 // 7 días

async function getUser(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  if (!jwt) return null
  const sb = createServiceClient()
  const { data: { user }, error } = await sb.auth.getUser(jwt)
  if (error || !user) return null
  return { user, sb }
}

const extFromType = (t: string) =>
  t === "image/png" ? "png" : t === "image/webp" ? "webp" : t === "image/gif" ? "gif" : "jpg"

/** POST — sube/reemplaza la foto de perfil (FormData "file") */
export async function POST(req: NextRequest) {
  const ctx = await getUser(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { user, sb } = ctx

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: "FormData inválido" }, { status: 400 }) }
  const file = form.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 })
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Tiene que ser una imagen" }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "La imagen supera 2MB" }, { status: 400 })

  // Borrar avatar anterior si existía
  const { data: prev } = await sb.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
  if (prev?.avatar_url) await sb.storage.from(BUCKET).remove([prev.avatar_url]).catch(() => {})

  const path  = `${user.id}/${crypto.randomUUID()}.${extFromType(file.type)}`
  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // profiles solo se puede actualizar con service role
  const { error: updErr } = await sb.from("profiles").update({ avatar_url: path }).eq("id", user.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL)
  return NextResponse.json({ url: signed?.signedUrl ?? null })
}

/** GET — signed URL del avatar actual (si hay) */
export async function GET(req: NextRequest) {
  const ctx = await getUser(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { user, sb } = ctx

  const { data } = await sb.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
  if (!data?.avatar_url) return NextResponse.json({ url: null })
  const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(data.avatar_url, SIGNED_TTL)
  return NextResponse.json({ url: signed?.signedUrl ?? null })
}

/** DELETE — quita la foto de perfil */
export async function DELETE(req: NextRequest) {
  const ctx = await getUser(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { user, sb } = ctx

  const { data } = await sb.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
  if (data?.avatar_url) await sb.storage.from(BUCKET).remove([data.avatar_url]).catch(() => {})
  await sb.from("profiles").update({ avatar_url: null }).eq("id", user.id)
  return NextResponse.json({ ok: true })
}
