/**
 * Gestión del "Cerebro de Ann" — la base de conocimiento que alimenta a Ann AI.
 * Gateado a admin/developer (requireAdmin incluye developer vía isAdmin).
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FIELDS = "id, title, content, pillar, source_type, sort_order, is_active, created_at, updated_at"

function getJwt(req: NextRequest) {
  return (req.headers.get("authorization") ?? "").replace("Bearer ", "")
}

// ─── GET — listar todo ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(getJwt(req))
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const { data, error } = await sb
    .from("ann_knowledge")
    .select(FIELDS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// ─── POST — crear entrada ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(getJwt(req))
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const title = String(body.title ?? "").trim()
  const content = String(body.content ?? "").trim()
  if (!title || !content) return NextResponse.json({ error: "Título y contenido son obligatorios." }, { status: 400 })

  const sb = createServiceClient()
  const { data, error } = await sb
    .from("ann_knowledge")
    .insert({
      title,
      content,
      pillar:      body.pillar ?? "general",
      source_type: body.source_type ?? "manual",
      sort_order:  Number(body.sort_order) || 0,
      created_by:  admin.id,
    })
    .select(FIELDS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// ─── PATCH — editar / activar-desactivar ──────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(getJwt(req))
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const id = String(body.id ?? "")
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const patch: Record<string, any> = {}
  if (typeof body.title === "string")       patch.title = body.title.trim()
  if (typeof body.content === "string")     patch.content = body.content.trim()
  if (typeof body.pillar === "string")      patch.pillar = body.pillar
  if (typeof body.is_active === "boolean")  patch.is_active = body.is_active
  if (body.sort_order != null)              patch.sort_order = Number(body.sort_order) || 0
  if (Object.keys(patch).length === 0)      return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 })

  const sb = createServiceClient()
  const { data, error } = await sb.from("ann_knowledge").update(patch).eq("id", id).select(FIELDS).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(getJwt(req))
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const id = String(body.id ?? "")
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const sb = createServiceClient()
  const { error } = await sb.from("ann_knowledge").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
