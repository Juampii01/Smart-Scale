/**
 * Envío de Web Push (notificaciones al celular).
 * Requiere env: VAPID_PRIVATE_KEY (secreta), NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_SUBJECT.
 */
import webpush from "web-push"
import { createServiceClient } from "@/lib/supabase-service"
import { VAPID_PUBLIC_KEY } from "@/lib/push-public"

const PRIVATE = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:juampiacosta158@gmail.com"

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  if (!PRIVATE) return false
  webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC_KEY, PRIVATE)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body:  string
  url?:  string   // a dónde lleva al tocar la noti
}

type SB = ReturnType<typeof createServiceClient>

interface SubRow { id: string; endpoint: string; p256dh: string; auth: string }

async function sendToSubs(sb: SB, subs: SubRow[], payload: PushPayload) {
  if (!ensureConfigured() || subs.length === 0) return
  const data = JSON.stringify(payload)
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        data,
      )
    } catch (err: any) {
      // 404/410 = suscripción muerta → limpiar
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await sb.from("push_subscriptions").delete().eq("id", s.id)
      } else {
        console.error("[push] error enviando:", err?.statusCode, err?.message)
      }
    }
  }))
}

/** Envía push a los celulares de un usuario puntual (por user_id). */
export async function sendPushToUser(sb: SB, userId: string, payload: PushPayload) {
  const { data } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
  await sendToSubs(sb, (data ?? []) as SubRow[], payload)
}

/** Envía push a los miembros del equipo por nombre (Juampi/Fabri/Ann). */
export async function sendPushToNames(sb: SB, names: string[], payload: PushPayload) {
  if (names.length === 0) return
  const { data } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("name", names)
  await sendToSubs(sb, (data ?? []) as SubRow[], payload)
}
