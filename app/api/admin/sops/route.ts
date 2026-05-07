/**
 * SOPs CRUD.
 *  GET    — admin/team/setter (lectura)
 *  POST   — solo admin (crear)
 *  PATCH  — solo admin (editar)
 *  DELETE — solo admin
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin, requireInternal } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SELECT_FIELDS = "id, title, description, frequency, tags, steps, templates, ai_generated, created_by, created_at, updated_at"

interface Step {
  order: number
  label: string
}

interface Template {
  channel: string  // 'skool' | 'slack' | 'email' | 'other' | etc.
  label:   string  // "Aviso post-grabación"
  body:    string  // markdown / plain
}

function isValidStepsArray(v: unknown): v is Step[] {
  if (!Array.isArray(v)) return false
  return v.every(s => typeof s === "object" && s !== null && typeof (s as any).label === "string")
}

function isValidTemplatesArray(v: unknown): v is Template[] {
  if (!Array.isArray(v)) return false
  return v.every(t =>
    typeof t === "object" && t !== null
      && typeof (t as any).channel === "string"
      && typeof (t as any).body === "string"
  )
}

/** GET /api/admin/sops — list all SOPs */
export async function GET(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("sops")
      .select(SELECT_FIELDS)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sops: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** POST /api/admin/sops — create a new SOP */
export async function POST(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { title, description, frequency, tags, steps, templates, ai_generated } = body
    if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 })

    const stepsArr     = isValidStepsArray(steps)         ? steps     : []
    const templatesArr = isValidTemplatesArray(templates) ? templates : []
    const tagsArr      = Array.isArray(tags) ? tags.filter(t => typeof t === "string" && t.trim()) : []

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("sops")
      .insert({
        title:        title.trim(),
        description:  description?.trim() || null,
        frequency:    frequency?.trim()   || null,
        tags:         tagsArr,
        steps:        stepsArr,
        templates:    templatesArr,
        ai_generated: Boolean(ai_generated),
        created_by:   user.id,
      })
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sop: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH /api/admin/sops — partial update */
export async function PATCH(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const allowed: Record<string, any> = {}
    if (typeof rest.title       === "string") allowed.title       = rest.title.trim()
    if (typeof rest.description === "string") allowed.description = rest.description.trim() || null
    if (typeof rest.frequency   === "string") allowed.frequency   = rest.frequency.trim()   || null
    if (Array.isArray(rest.tags))                allowed.tags      = rest.tags.filter((t: any) => typeof t === "string" && t.trim())
    if (isValidStepsArray(rest.steps))           allowed.steps     = rest.steps
    if (isValidTemplatesArray(rest.templates))   allowed.templates = rest.templates

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("sops")
      .update(allowed)
      .eq("id", id)
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sop: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** DELETE /api/admin/sops — by id */
export async function DELETE(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase.from("sops").delete().eq("id", body.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
