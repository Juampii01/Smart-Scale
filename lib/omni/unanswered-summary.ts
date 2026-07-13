// Resumen de conversaciones sin responder — a diferencia de los otros
// motores de Omni, este NO usa IA: es un cálculo directo sobre datos ya
// sincronizados. Corre todas las noches (cron) y también a demanda.
//
// Instagram: usa la señal que ya existe (last_message_from='lead').
// Slack: se limita a los canales 1:1 de cliente (cl-nombre) — son el
// equivalente de una conversación. Los canales de comunidad compartidos NO
// entran, porque no son "una conversación" con una sola contraparte.
// "Sin responder" en Slack = el último mensaje del canal NO lo escribió Ann
// (se resuelve su nombre real vía la API de Slack, comparando contra el
// user_name guardado en cada mensaje).

import { createServiceClient } from "@/lib/supabase-service"
import { decryptToken } from "@/lib/social/crypto"
import { resolveOmniSlackUserNames } from "@/lib/omni/slack-read"

const MAX_ITEMS_PER_SOURCE = 100

export interface UnansweredItem {
  nombre:              string
  last_message_at:     string
  horas_sin_responder: number
}

export interface UnansweredSummary {
  instagram: UnansweredItem[]
  slack:     UnansweredItem[]
}

function hoursSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000)
}

async function getUnansweredInstagram(sb: ReturnType<typeof createServiceClient>): Promise<UnansweredItem[]> {
  const { data } = await sb
    .from("omni_conversations")
    .select("participant_username, last_message_at")
    .eq("last_message_from", "lead")
    .order("last_message_at", { ascending: false })
    .limit(MAX_ITEMS_PER_SOURCE)

  return (data ?? [])
    .filter((c: any) => c.last_message_at)
    .map((c: any) => ({
      nombre:              c.participant_username ?? "desconocido",
      last_message_at:     c.last_message_at,
      horas_sin_responder: hoursSince(c.last_message_at),
    }))
}

async function getUnansweredSlack(sb: ReturnType<typeof createServiceClient>): Promise<UnansweredItem[]> {
  const { data: channels } = await sb
    .from("omni_slack_channels")
    .select("id, name")
    .eq("is_client_channel", true)

  if (!channels || channels.length === 0) return [] // nada que revisar — no llamamos a Slack para nada

  const { data: conn } = await sb
    .from("omni_slack_user_connection")
    .select("slack_user_id, access_token")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conn) return [] // Slack de Omni no conectado — nada que reportar acá

  let annName: string | undefined
  try {
    const token = decryptToken((conn as any).access_token)
    const annNameByUserId = await resolveOmniSlackUserNames(token, [(conn as any).slack_user_id])
    annName = annNameByUserId.get((conn as any).slack_user_id)
  } catch (e) {
    // Si falla la API de Slack (rate limit, token vencido, etc.) no tiramos
    // abajo todo el resumen — devolvemos vacío para Slack y seguimos con
    // Instagram, que es independiente.
    console.error("[omni/unanswered-summary] error resolviendo nombre de Ann en Slack:", e instanceof Error ? e.message : e)
    return []
  }

  // resolveOmniSlackUserNames no tira excepción si Slack responde ok:false
  // (rate limit, user_not_found, etc.) — solo deja el Map vacío. Sin annName
  // no podemos distinguir "Ann respondió" de "no respondió", así que TODOS
  // los canales caerían como falso positivo de "sin responder". Mejor no
  // reportar nada de Slack esa corrida que reportar mal.
  if (annName == null) {
    console.error("[omni/unanswered-summary] no se pudo resolver el nombre de Ann en Slack (users.info no devolvió datos) — se omite Slack en este resumen")
    return []
  }

  const results = await Promise.all(channels.map(async (ch: any) => {
    const { data: lastMsg } = await sb
      .from("omni_slack_messages")
      .select("user_name, posted_at")
      .eq("channel_id", ch.id)
      .not("posted_at", "is", null)
      .order("posted_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastMsg) return null
    const isFromAnn = annName != null && (lastMsg as any).user_name === annName
    if (isFromAnn) return null

    return {
      nombre:              ch.name,
      last_message_at:     (lastMsg as any).posted_at,
      horas_sin_responder: hoursSince((lastMsg as any).posted_at),
    }
  }))

  return results
    .filter((r): r is UnansweredItem => r !== null)
    .sort((a, b) => b.horas_sin_responder - a.horas_sin_responder)
    .slice(0, MAX_ITEMS_PER_SOURCE)
}

export async function getUnansweredSummary(
  sb: ReturnType<typeof createServiceClient>,
): Promise<UnansweredSummary> {
  const [instagram, slack] = await Promise.all([
    getUnansweredInstagram(sb),
    getUnansweredSlack(sb),
  ])
  return { instagram, slack }
}
