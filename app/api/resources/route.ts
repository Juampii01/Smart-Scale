import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET — list all resources
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resources: data ?? [] })
}

// POST — create a resource
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, url, description, category, type } = body

    if (!title?.trim() || !url?.trim()) {
      return NextResponse.json({ error: "title y url son requeridos" }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("resources")
      .insert({
        title:       title.trim(),
        url:         url.trim(),
        description: description?.trim() || null,
        category:    category?.trim() || "General",
        type:        type || "link",
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ resource: data })
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

// PATCH — update content (and optionally other fields) by id
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, title, url, description, content, category, type } = body
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

    const supabase = createServiceClient()
    const updates: Record<string, unknown> = {}
    if (title       !== undefined) updates.title       = title?.trim() || null
    if (url         !== undefined) updates.url         = url?.trim()   || null
    if (description !== undefined) updates.description = description?.trim() || null
    if (content     !== undefined) updates.content     = content       || null
    if (category    !== undefined) updates.category    = category?.trim() || null
    if (type        !== undefined) updates.type        = type

    const { data, error } = await supabase
      .from("resources")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ resource: data })
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

// DELETE — delete by id (?id=...)
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from("resources").delete().eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
