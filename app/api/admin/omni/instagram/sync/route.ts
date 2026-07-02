/**
 * POST /api/admin/omni/instagram/sync
 *
 * Trae las conversaciones y mensajes recientes de la cuenta de Instagram
 * conectada en Omni y los guarda en omni_conversations / omni_messages.
 * Disparo manual por ahora (botón "Sincronizar" en la vista); el cron llega
 * en una fase posterior del piloto.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"
import { decryptToken } from "@/lib/social/crypto"
import { fetchOmniIgConversations, fetchOmniIgMessages } from "@/lib/omni/instagram"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const { data: conn } = await sb
    .from("omni_instagram_connections")
    .select("account_id, access_token")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return NextResponse.json({ error: "Instagram de Omni no está conectado" }, { status: 400 })
  }

  const accessToken = decryptToken((conn as any).access_token)
  const accountId = (conn as any).account_id as string

  let conversations
  try {
    conversations = await fetchOmniIgConversations(accessToken, accountId)
  } catch (e) {
    console.error("[omni/instagram/sync] conversations error:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "No se pudieron traer las conversaciones" }, { status: 502 })
  }

  let conversationsSynced = 0
  let messagesSynced = 0

  for (const c of conversations) {
    let messages
    try {
      messages = await fetchOmniIgMessages(accessToken, c.id, accountId)
    } catch (e) {
      console.error(`[omni/instagram/sync] messages error (${c.id}):`, e instanceof Error ? e.message : e)
      continue
    }

    const lastMsg = messages[0] // la API devuelve más reciente primero
    const { data: convRow, error: convErr } = await sb
      .from("omni_conversations")
      .upsert({
        ig_conversation_id:   c.id,
        participant_username: c.participantUsername,
        participant_ig_id:    c.participantIgId,
        last_message_at:      lastMsg?.sentAt ?? null,
        last_message_from:    lastMsg?.from ?? null,
        synced_at:            new Date().toISOString(),
      }, { onConflict: "ig_conversation_id" })
      .select("id")
      .single()

    if (convErr || !convRow) {
      console.error(`[omni/instagram/sync] upsert conversation error (${c.id}):`, convErr?.message)
      continue
    }
    conversationsSynced++

    if (messages.length === 0) continue
    const rows = messages.map(m => ({
      conversation_id: (convRow as any).id,
      ig_message_id:   m.id,
      sender:          m.from,
      body:            m.body,
      sent_at:         m.sentAt,
      synced_at:       new Date().toISOString(),
    }))
    const { error: msgErr } = await sb.from("omni_messages").upsert(rows, { onConflict: "ig_message_id" })
    if (msgErr) {
      console.error(`[omni/instagram/sync] upsert messages error (${c.id}):`, msgErr.message)
      continue
    }
    messagesSynced += rows.length
  }

  return NextResponse.json({ conversationsSynced, messagesSynced })
}
