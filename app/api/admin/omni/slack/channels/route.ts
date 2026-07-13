/**
 * GET /api/admin/omni/slack/channels
 *
 * Lista TODOS los canales de Slack sincronizados con lo básico (nombre, si
 * es canal 1:1 de cliente, cuántos mensajes tiene) y el último análisis
 * guardado si existe (lib/omni/channel-analysis.ts lo persiste en
 * omni_channel_analyses) — mismo patrón que
 * /api/admin/omni/prospecting/conversations para Instagram.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()

  const { data: channels, error: channelsError } = await sb
    .from("omni_slack_channels")
    .select("id, name, is_client_channel, synced_at")
    .order("name", { ascending: true })

  if (channelsError) return NextResponse.json({ error: channelsError.message }, { status: 500 })

  const channelIds = (channels ?? []).map((c: any) => c.id)

  const [{ data: analyses }, counts] = await Promise.all([
    channelIds.length > 0
      ? sb.from("omni_channel_analyses").select("*").in("channel_id", channelIds)
      : Promise.resolve({ data: [] as any[] }),
    Promise.all(channelIds.map((id: string) =>
      sb.from("omni_slack_messages").select("id", { count: "exact", head: true }).eq("channel_id", id),
    )),
  ])

  const analysisByChannel = new Map((analyses ?? []).map((a: any) => [a.channel_id, a]))
  const countByChannel = new Map(channelIds.map((id: string, i: number) => [id, counts[i].count ?? 0]))

  const result = (channels ?? []).map((c: any) => {
    const analysis = analysisByChannel.get(c.id)
    return {
      id:                c.id,
      name:              c.name,
      is_client_channel: c.is_client_channel,
      message_count:     countByChannel.get(c.id) ?? 0,
      synced_at:         c.synced_at,
      analysis:          analysis ? {
        estado:      analysis.estado,
        situacion:   analysis.situacion,
        principio:   analysis.principio,
        evidencia:   analysis.evidencia,
        accion:      analysis.accion,
        severidad:   analysis.severidad,
        analyzed_at: analysis.analyzed_at,
      } : null,
    }
  })

  return NextResponse.json({ channels: result })
}
