/**
 * GET /api/admin/omni/prospecting-metrics
 *
 * Métricas objetivas de prospección (sin IA, puro SQL) para mostrar en
 * `/admin/omni` sin tener que preguntarle nada a nadie: conversaciones
 * activas/estancadas, tiempo de respuesta de Ann, distribución de leads por
 * rating, y tasa de conversión. Complementa (no reemplaza) al análisis de
 * riesgo por IA de lib/omni/prospecting-risk-analysis.ts.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ACTIVE_WINDOW_DAYS = 30
const STALE_WINDOW_DAYS  = 60
const STALE_AFTER_HOURS  = 24
const LEADS_WINDOW_DAYS  = 60
const TODAY_WINDOW_HOURS = 24

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()

  const now = Date.now()
  const activeSinceIso = new Date(now - ACTIVE_WINDOW_DAYS * 86_400_000).toISOString()
  const staleSinceIso  = new Date(now - STALE_WINDOW_DAYS * 86_400_000).toISOString()
  const staleBeforeIso = new Date(now - STALE_AFTER_HOURS * 3_600_000).toISOString()
  const leadsSinceIso  = new Date(now - LEADS_WINDOW_DAYS * 86_400_000).toISOString()
  const todaySinceIso  = new Date(now - TODAY_WINDOW_HOURS * 3_600_000).toISOString()

  const [
    { count: activeConversations },
    { count: staleConversations },
    { data: conversationsForResponseTime },
    { data: leads },
    { data: leadsToday },
  ] = await Promise.all([
    sb.from("omni_conversations").select("id", { count: "exact", head: true }).gte("last_message_at", activeSinceIso),
    sb.from("omni_conversations").select("id", { count: "exact", head: true })
      .eq("last_message_from", "lead")
      .gte("last_message_at", staleSinceIso)
      .lte("last_message_at", staleBeforeIso),
    sb.from("omni_conversations").select("id").gte("last_message_at", staleSinceIso).limit(60),
    sb.from("leads").select("rating, purchased").gte("created_at", leadsSinceIso),
    sb.from("leads").select("rating").gte("created_at", todaySinceIso),
  ])

  // Tiempo de respuesta promedio de Ann: delta entre un mensaje del lead y el
  // siguiente mensaje de Ann, dentro de cada conversación reciente.
  let avgResponseMinutes: number | null = null
  const conversationIds = (conversationsForResponseTime ?? []).map((c: any) => c.id)
  if (conversationIds.length > 0) {
    const { data: messages } = await sb
      .from("omni_messages")
      .select("conversation_id, sender, sent_at")
      .in("conversation_id", conversationIds)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: true })
      .limit(5000)

    const byConvo = new Map<string, { sender: string; sent_at: string }[]>()
    for (const m of messages ?? []) {
      const list = byConvo.get((m as any).conversation_id) ?? []
      list.push(m as any)
      byConvo.set((m as any).conversation_id, list)
    }

    const deltasMinutes: number[] = []
    for (const msgs of byConvo.values()) {
      for (let i = 0; i < msgs.length - 1; i++) {
        if (msgs[i].sender === "lead" && msgs[i + 1].sender === "ann") {
          const delta = (new Date(msgs[i + 1].sent_at).getTime() - new Date(msgs[i].sent_at).getTime()) / 60_000
          if (delta >= 0) deltasMinutes.push(delta)
        }
      }
    }
    if (deltasMinutes.length > 0) {
      avgResponseMinutes = Math.round(deltasMinutes.reduce((a, b) => a + b, 0) / deltasMinutes.length)
    }
  }

  const ratingDistribution: Record<string, number> = {}
  let purchasedCount = 0
  for (const l of leads ?? []) {
    const rating = (l as any).rating
    if (rating != null) ratingDistribution[String(rating)] = (ratingDistribution[String(rating)] ?? 0) + 1
    if ((l as any).purchased) purchasedCount++
  }
  const leadsAnalyzed = (leads ?? []).length
  const conversionRate = leadsAnalyzed > 0 ? (purchasedCount / leadsAnalyzed) * 100 : null

  const ratingDistributionToday: Record<string, number> = {}
  for (const l of leadsToday ?? []) {
    const rating = (l as any).rating
    if (rating != null) ratingDistributionToday[String(rating)] = (ratingDistributionToday[String(rating)] ?? 0) + 1
  }
  const leadsTodayCount = (leadsToday ?? []).length

  return NextResponse.json({
    activeConversations: activeConversations ?? 0,
    staleConversations:  staleConversations ?? 0,
    avgResponseMinutes,
    ratingDistribution,
    leadsAnalyzed,
    conversionRate,
    ratingDistributionToday,
    leadsToday: leadsTodayCount,
  })
}
