/**
 * Gestión de conversaciones de Ann AI.
 *
 * GET  — lista las conversaciones del usuario (mes actual y anteriores).
 * POST — crea una nueva conversación (chequea límite mensual).
 * DELETE — elimina una conversación propia.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const MAX_CONVERSATIONS_PER_MONTH = 5
export const MAX_MESSAGES_PER_CONVERSATION = 20

function currentMonth() {
  return new Date().toISOString().slice(0, 7) // 'YYYY-MM'
}

async function getUser(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  if (!jwt) return null
  const sb = createServiceClient()
  const { data: { user }, error } = await sb.auth.getUser(jwt)
  if (error || !user) return null
  return { user, sb }
}

/** GET — lista conversaciones o devuelve mensajes de una específica */
export async function GET(req: NextRequest) {
  const ctx = await getUser(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { user, sb } = ctx

  // Si se pasa ?id=... devuelve los mensajes de esa conversación
  const convId = req.nextUrl.searchParams.get("id")
  if (convId) {
    const { data, error } = await sb
      .from("ann_conversations")
      .select("id, title, messages")
      .eq("id", convId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data)  return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    return NextResponse.json({ messages: data.messages ?? [] })
  }

  // Lista completa
  const { data, error } = await sb
    .from("ann_conversations")
    .select("id, title, month, created_at, updated_at, messages")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const month = currentMonth()
  const conversations = (data ?? []).map((c: any) => ({
    id:            c.id,
    title:         c.title,
    month:         c.month,
    created_at:    c.created_at,
    updated_at:    c.updated_at,
    message_count: Array.isArray(c.messages) ? c.messages.length : 0,
  }))

  const usedThisMonth = conversations.filter(c => c.month === month).length

  return NextResponse.json({
    conversations,
    usage: {
      month,
      used:  usedThisMonth,
      limit: MAX_CONVERSATIONS_PER_MONTH,
    },
  })
}

/** POST — crea una nueva conversación */
export async function POST(req: NextRequest) {
  const ctx = await getUser(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { user, sb } = ctx

  const month = currentMonth()

  // Verificar límite mensual
  const { count } = await sb
    .from("ann_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("month", month)

  if ((count ?? 0) >= MAX_CONVERSATIONS_PER_MONTH) {
    return NextResponse.json(
      { error: `Límite mensual alcanzado: ${MAX_CONVERSATIONS_PER_MONTH} conversaciones por mes.`, limitReached: true },
      { status: 429 },
    )
  }

  let body: any = {}
  try { body = await req.json() } catch {}

  // Validar client_id: debe ser UUID válido (36 chars, guiones en posición correcta)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const rawClientId = body.client_id
  const safeClientId =
    typeof rawClientId === "string" && UUID_REGEX.test(rawClientId) ? rawClientId : null

  const { data, error } = await sb
    .from("ann_conversations")
    .insert({
      user_id:   user.id,
      client_id: safeClientId,
      title:     "Nueva conversación",
      messages:  [],
      month,
    })
    .select("id, title, month, created_at, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const remaining = MAX_CONVERSATIONS_PER_MONTH - ((count ?? 0) + 1)
  const response = NextResponse.json({ conversation: { ...data, message_count: 0 } })
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, remaining)))
  return response
}

/** DELETE — elimina una conversación del usuario */
export async function DELETE(req: NextRequest) {
  const ctx = await getUser(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { user, sb } = ctx

  let body: any = {}
  try { body = await req.json() } catch {}
  if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const { error } = await sb
    .from("ann_conversations")
    .delete()
    .eq("id", body.id)
    .eq("user_id", user.id) // solo la propia

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
