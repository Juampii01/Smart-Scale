/**
 * GET /api/admin/omni/prospecting/conversations
 *
 * Lista TODAS las conversaciones de Instagram sincronizadas (sin filtrar
 * clientes ya cerrados — a diferencia del análisis en bloque, acá el
 * usuario quiere ver todo y elegir qué analizar) con lo básico: usuario,
 * último mensaje, quién escribió último, y el último análisis guardado si
 * existe (lib/omni/conversation-analysis.ts lo persiste en
 * omni_conversation_analyses).
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_CONVERSATIONS = 100

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()

  const { data: conversations, error: convError } = await sb
    .from("omni_conversations")
    .select("id, participant_username, last_message_at, last_message_from")
    .order("last_message_at", { ascending: false })
    .limit(MAX_CONVERSATIONS)

  if (convError) return NextResponse.json({ error: convError.message }, { status: 500 })

  const conversationIds = (conversations ?? []).map((c: any) => c.id)
  const usernames = (conversations ?? []).map((c: any) => c.participant_username).filter(Boolean)

  // Un fetch por conversación (no un límite global compartido): con un solo
  // límite global ordenado por sent_at, una conversación muy activa puede
  // acaparar el buffer y dejar a otras sin preview aunque sean recientes.
  const [lastMessageResults, { data: analyses }, { data: leads }] = await Promise.all([
    Promise.all(conversationIds.map(async (id: string) => {
      const { data } = await sb
        .from("omni_messages")
        .select("body")
        .eq("conversation_id", id)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      return { id, body: (data as any)?.body ?? null }
    })),
    conversationIds.length > 0
      ? sb.from("omni_conversation_analyses").select("*").in("conversation_id", conversationIds)
      : Promise.resolve({ data: [] as any[] }),
    usernames.length > 0
      ? sb.from("leads").select("instagram, rating, purchased").in("instagram", usernames)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const lastMessageByConvo = new Map(lastMessageResults.map(r => [r.id, r.body]))

  const analysisByConvo = new Map((analyses ?? []).map((a: any) => [a.conversation_id, a]))
  const leadByUsername = new Map((leads ?? []).map((l: any) => [String(l.instagram ?? "").toLowerCase(), l]))

  const result = (conversations ?? []).map((c: any) => {
    const lastMessageBody = lastMessageByConvo.get(c.id)
    const analysis = analysisByConvo.get(c.id)
    const lead = c.participant_username ? leadByUsername.get(String(c.participant_username).toLowerCase()) : null

    return {
      id:                  c.id,
      participant_username: c.participant_username,
      last_message_at:     c.last_message_at,
      last_message_from:   c.last_message_from,
      last_message_preview: lastMessageBody ? String(lastMessageBody).slice(0, 140) : null,
      lead_rating:         lead?.rating ?? null,
      is_customer:         !!lead?.purchased,
      analysis:            analysis ? {
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

  return NextResponse.json({ conversations: result })
}
