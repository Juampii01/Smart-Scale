/**
 * POST /api/admin/omni/slack/sync
 *
 * Sincroniza canales + historial de Slack a omni_slack_channels/omni_slack_messages.
 * Incluye los canales #cl-nombre (1:1 por cliente) y los compartidos de comunidad.
 * Mismo SLACK_BOT_TOKEN ya configurado — requiere los scopes de lectura
 * (channels:read, channels:history, users:read) agregados y la app reinstalada.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"
import { listOmniSlackChannels, fetchOmniSlackHistory, resolveOmniSlackUserNames } from "@/lib/omni/slack-read"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

// Replica el slug que usa lib/slack.ts al crear canales `cl-{slug}` por cliente
// (duplicado a propósito: es una utilidad pura de 10 líneas y este endpoint no
// debe importar del módulo compartido de Slack — ver nota de aislamiento).
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()

  let channels
  try {
    channels = await listOmniSlackChannels()
  } catch (e) {
    console.error("[omni/slack/sync] list channels error:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "No se pudieron listar los canales de Slack" }, { status: 502 })
  }

  const { data: clients } = await sb.from("clients").select("id, name")
  const clientBySlug = new Map((clients ?? []).map((c: any) => [slugify(c.name ?? ""), c.id]))

  let channelsSynced = 0
  let messagesSynced = 0

  for (const ch of channels) {
    const isClientChannel = ch.name.startsWith("cl-")
    const clientId = isClientChannel ? (clientBySlug.get(ch.name.slice(3)) ?? null) : null

    const { data: chRow, error: chErr } = await sb
      .from("omni_slack_channels")
      .upsert({
        slack_channel_id:  ch.id,
        name:              ch.name,
        is_client_channel: isClientChannel,
        client_id:         clientId,
        synced_at:         new Date().toISOString(),
      }, { onConflict: "slack_channel_id" })
      .select("id")
      .single()

    if (chErr || !chRow) {
      console.error(`[omni/slack/sync] upsert channel error (${ch.name}):`, chErr?.message)
      continue
    }
    channelsSynced++

    let history
    try {
      history = await fetchOmniSlackHistory(ch.id)
    } catch (e) {
      console.error(`[omni/slack/sync] history error (${ch.name}):`, e instanceof Error ? e.message : e)
      continue
    }
    if (history.length === 0) continue

    const names = await resolveOmniSlackUserNames(history.map(m => m.userId ?? "").filter(Boolean))
    const rows = history.map(m => ({
      channel_id: (chRow as any).id,
      slack_ts:   m.ts,
      user_name:  m.userId ? (names.get(m.userId) ?? m.userId) : null,
      body:       m.text,
      posted_at:  m.postedAt,
      synced_at:  new Date().toISOString(),
    }))
    const { error: msgErr } = await sb.from("omni_slack_messages").upsert(rows, { onConflict: "channel_id,slack_ts" })
    if (msgErr) {
      console.error(`[omni/slack/sync] upsert messages error (${ch.name}):`, msgErr.message)
      continue
    }
    messagesSynced += rows.length
  }

  return NextResponse.json({ channelsSynced, messagesSynced })
}
