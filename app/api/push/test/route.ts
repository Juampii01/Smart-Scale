import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { sendPushToUser } from "@/lib/push"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST — manda una notificación de prueba al propio celular (verificación) */
export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const sb = createServiceClient()
  const { data: { user }, error } = await sb.auth.getUser(jwt)
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await sendPushToUser(sb, user.id, {
    title: "🔔 Notificaciones activadas",
    body:  "Listo, vas a recibir avisos de Smart Scale en este dispositivo.",
    url:   "/admin/tareas",
  })
  return NextResponse.json({ ok: true })
}
