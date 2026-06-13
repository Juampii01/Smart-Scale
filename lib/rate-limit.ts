import { NextRequest, NextResponse } from "next/server"

/**
 * Rate limiting liviano EN MEMORIA (por instancia de lambda).
 *
 * Mitiga ráfagas y loops accidentales contra los endpoints caros de IA.
 * NO es una garantía dura: en serverless multi-instancia cada lambda tiene su
 * propio contador. Para un límite estricto y global haría falta un store
 * compartido (ej. Upstash Redis). Para el volumen actual del portal alcanza.
 */

type Hit = { count: number; resetAt: number }
const store = new Map<string, Hit>()

function sweep(now: number) {
  if (store.size < 1000) return
  for (const [k, v] of store) if (v.resetAt <= now) store.delete(k)
}

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

/**
 * Devuelve un NextResponse 429 si se superó el límite, o `null` si puede continuar.
 * Keyea por `id` (ej. user id) si se pasa; si no, por IP.
 */
export function rateLimit(
  req: NextRequest,
  opts: { bucket: string; limit: number; windowMs: number; id?: string }
): NextResponse | null {
  const now = Date.now()
  sweep(now)
  const key = `${opts.bucket}:${opts.id ?? clientIp(req)}`
  const hit = store.get(key)

  if (!hit || hit.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs })
    return null
  }
  if (hit.count >= opts.limit) {
    const retryAfter = Math.ceil((hit.resetAt - now) / 1000)
    return NextResponse.json(
      { error: "Demasiadas solicitudes seguidas. Esperá unos segundos y volvé a intentar." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }
  hit.count++
  return null
}
