import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function authorize(jwt: string | null, requestedClientId: string) {
  if (!jwt) return { ok: false as const, status: 401, message: "Unauthorized" }

  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return { ok: false as const, status: 401, message: "Unauthorized" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .maybeSingle()

  const role = String(profile?.role ?? "").toLowerCase()
  const ownClientId = (profile as any)?.client_id ?? null

  // Admin → puede ver/editar cualquier cliente
  if (isAdmin(role)) {
    return { ok: true as const, user, role, ownClientId }
  }

  // No-admin → solo su propio client_id
  if (!ownClientId || ownClientId !== requestedClientId) {
    return { ok: false as const, status: 403, message: "Forbidden" }
  }

  return { ok: true as const, user, role, ownClientId }
}

// ─── GET — task_keys completos del cliente ───────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get("client_id")
    if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 })

    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const auth = await authorize(jwt, clientId)
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("client_checklist_progress")
      .select("task_key")
      .eq("client_id", clientId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      tasks: (data ?? []).map((r: any) => r.task_key),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── POST — toggle (upsert si completed=true, delete si completed=false) ─────

export async function POST(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { client_id, task_key, completed } = body ?? {}
    if (!client_id || !task_key || typeof completed !== "boolean") {
      return NextResponse.json({ error: "client_id, task_key, completed required" }, { status: 400 })
    }

    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const auth = await authorize(jwt, client_id)
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

    const supabase = createServiceClient()

    if (completed) {
      const { error } = await supabase
        .from("client_checklist_progress")
        .upsert({
          client_id,
          task_key,
          completed: true,
          updated_at: new Date().toISOString(),
          updated_by: auth.user.id,
        }, { onConflict: "client_id,task_key" })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase
        .from("client_checklist_progress")
        .delete()
        .eq("client_id", client_id)
        .eq("task_key", task_key)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
