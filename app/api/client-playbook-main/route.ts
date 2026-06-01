/**
 * Client Playbook Main — UN documento por cliente.
 *
 * Permisos:
 *  - admin / team: CRUD completo. Pueden crear el playbook, editar todo,
 *                  eliminarlo si fuese necesario.
 *  - client:       puede LEER su playbook y ÚNICAMENTE puede modificar el
 *                  estado `checked` de bloques `checkListItem`. Cualquier otro
 *                  cambio (texto, blocks nuevos, headers, etc.) → 403.
 *
 * La validación checkbox-only la hace `isOnlyCheckboxToggleChange(prev, next)`
 * comparando las dos versiones del documento BlockNote. La política RLS
 * permite UPDATE al cliente sobre su propio row, pero el route handler
 * intercepta primero y rechaza cualquier diff fuera del whitelist.
 *
 * Si el cliente intenta saltar el route y va directo a postgrest con su JWT,
 * RLS sí lo dejaría escribir libre — pero la app no expone postgrest crudo
 * para writes desde el cliente. La capa de seguridad real es: app → este
 * route → service role.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"
import { isOnlyCheckboxToggleChange } from "@/lib/playbook-diff"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SELECT_FIELDS = "client_id, content, updated_by, created_at, updated_at, visible_to_client"

interface AuthCtx {
  userId:   string
  role:     "admin" | "team" | "client"
  clientId: string | null
}

async function authenticate(jwt: string | null): Promise<AuthCtx | null> {
  if (!jwt) return null
  const sb = createServiceClient()
  const { data: { user }, error } = await sb.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await sb
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .maybeSingle()
  const role = String((profile as any)?.role ?? "").toLowerCase()
  if (!isAdmin(role) && role !== "team" && role !== "client") return null
  return {
    userId:   user.id,
    role:     role as AuthCtx["role"],
    clientId: (profile as any)?.client_id ?? null,
  }
}

function resolveTargetClientId(ctx: AuthCtx, requested: string | null): string | null {
  if (ctx.role === "client") return ctx.clientId
  if (!requested) return null
  return requested
}

// ─── GET ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await authenticate(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const requested = req.nextUrl.searchParams.get("client_id")
    const targetClientId = resolveTargetClientId(ctx, requested)
    if (!targetClientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 })

    const sb = createServiceClient()
    const { data, error } = await sb
      .from("client_playbook_main")
      .select(SELECT_FIELDS)
      .eq("client_id", targetClientId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ playbook: data ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── PUT — create or update ────────────────────────────────────────────────
//
// admin/team: pueden crear el row si no existe, y mandar cualquier content.
// client:     solo update. El content nuevo debe diferir del actual SOLO en
//             props.checked de checkListItems.

export async function PUT(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await authenticate(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const targetClientId = resolveTargetClientId(ctx, body.client_id ?? null)
    if (!targetClientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 })

    const newContent = body.content
    if (!Array.isArray(newContent)) return NextResponse.json({ error: "content must be an array" }, { status: 400 })

    const sb = createServiceClient()

    // ¿Existe el row?
    const { data: existing } = await sb
      .from("client_playbook_main")
      .select("client_id, content")
      .eq("client_id", targetClientId)
      .maybeSingle()

    if (!existing) {
      // Solo admin/team puede crear el row
      if (ctx.role === "client") {
        return NextResponse.json({ error: "Playbook aún no creado" }, { status: 404 })
      }
      const { data, error } = await sb
        .from("client_playbook_main")
        .insert({
          client_id:   targetClientId,
          content:     newContent,
          updated_by:  ctx.userId,
        })
        .select(SELECT_FIELDS)
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ playbook: data })
    }

    // Update — si es client, validar diff
    if (ctx.role === "client") {
      const prevContent = (existing as any).content
      if (!isOnlyCheckboxToggleChange(prevContent, newContent)) {
        return NextResponse.json(
          { error: "No se puede editar el texto. Solo podés tildar/destildar checkboxes." },
          { status: 403 },
        )
      }
    }

    const { data, error } = await sb
      .from("client_playbook_main")
      .update({ content: newContent, updated_by: ctx.userId })
      .eq("client_id", targetClientId)
      .select(SELECT_FIELDS)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ playbook: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── DELETE — only admin ───────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await authenticate(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!isAdmin(ctx.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
    if (!body.client_id) return NextResponse.json({ error: "client_id is required" }, { status: 400 })

    const sb = createServiceClient()
    const { error } = await sb.from("client_playbook_main").delete().eq("client_id", body.client_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

// ─── PATCH — reveal playbook (client only) ──────────────────────────────────
//
// ?action=reveal — client clicks "Reveal Playbook" button, marks as visible
// Sets visible_to_client = true (idempotent, safe to call multiple times)
// Only clients can reveal their own playbook.

export async function PATCH(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const ctx = await authenticate(jwt)
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (ctx.role !== "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const action = req.nextUrl.searchParams.get("action")
    if (action !== "reveal") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const targetClientId = ctx.clientId
    if (!targetClientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 })

    const sb = createServiceClient()
    const { data, error } = await sb
      .from("client_playbook_main")
      .update({ visible_to_client: true })
      .eq("client_id", targetClientId)
      .select(SELECT_FIELDS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ playbook: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
