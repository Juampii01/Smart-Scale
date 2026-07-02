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
  const [{ count: channelCount }, { count: messageCount }, { data: lastSynced }] = await Promise.all([
    sb.from("omni_slack_channels").select("id", { count: "exact", head: true }),
    sb.from("omni_slack_messages").select("id", { count: "exact", head: true }),
    sb.from("omni_slack_channels").select("synced_at").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
  ])

  return NextResponse.json({
    channels: channelCount ?? 0,
    messages: messageCount ?? 0,
    lastSyncedAt: (lastSynced as any)?.synced_at ?? null,
  })
}
