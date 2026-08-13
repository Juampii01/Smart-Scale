/**
 * Error Watch — detecta errores/warnings NUEVOS en app_logs y le pide al
 * agente Constructor (Managed Agents) un diagnóstico de solo lectura.
 *
 * Nunca aplica un fix solo. El Constructor investiga y reporta; el fix real
 * sigue siendo una decisión manual (mismo patrón que usamos a mano para el
 * crash de Florencia) — esto solo automatiza el primer paso: notar que algo
 * nuevo rompió y armar el diagnóstico inicial sin que alguien tenga que ir
 * a mirar los logs.
 *
 * Deduplica por "signature" (hash de route + mensaje normalizado, sin ids
 * ni timestamps) para no re-disparar el mismo error cada vez que se repite.
 */
import { createHash } from "crypto"
import { createServiceClient } from "@/lib/supabase-service"
import { sendPushToNames } from "@/lib/push"

const ANTHROPIC_API_BASE = "https://api.anthropic.com"
const MANAGED_AGENTS_BETA = "managed-agents-2026-04-01"
const REPO_URL = "https://github.com/Juampii01/Smart-Scale"

type SB = ReturnType<typeof createServiceClient>

// ─── Normalización + hash de firma ─────────────────────────────────────────

/** Reemplaza partes dinámicas (uuids, números, emails, hex) por placeholders
 *  para que la misma clase de error dedupee aunque cambien los IDs. */
export function normalizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "<email>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hex>")
    .replace(/\b\d+\b/g, "<n>")
    .slice(0, 300)
}

export function computeSignature(route: string | null, message: string): string {
  const key = `${route ?? "unknown"}::${normalizeMessage(message)}`
  return createHash("sha256").update(key).digest("hex")
}

// ─── Prompt de diagnóstico (solo lectura, mismas restricciones que usamos a mano) ──

function buildDiagnosticPrompt(route: string | null, message: string, sampleContext: unknown): string {
  const contextStr = sampleContext ? JSON.stringify(sampleContext, null, 2).slice(0, 1000) : "(sin contexto adicional)"
  return `CONTEXTO
Apareció un error/warning nuevo en producción (tabla app_logs), nunca visto
antes con esta firma. Necesito que lo investigues y me reportes qué es —
NO que lo arregles todavía.

Ruta/origen: ${route ?? "desconocido"}
Mensaje: ${message}
Contexto de ejemplo:
${contextStr}

OBJETIVO
Diagnóstico en modo lectura. Quiero un informe, no un fix.

RESTRICCIONES DURAS - NO NEGOCIABLES
- NO modifiques ningún archivo. Solo lectura y análisis.
- NO ejecutes migraciones SQL ni comandos de base de datos.
- NO hagas commits, pushes ni deploys.
- Confirmame primero en qué branch estás parado.
- Si creés que hace falta un fix, describilo con el diff que aplicarías,
  PERO NO LO APLIQUES — yo lo autorizo después de leer tu reporte.

QUÉ INSPECCIONAR
1. Encontrá el archivo/ruta de donde sale este mensaje (buscá el texto
   exacto o el patrón más cercano).
2. Leé el código alrededor de esa línea — qué la dispara, en qué condición.
3. Determiná si es un bug real, un caso esperado que solo necesita mejor
   manejo de errores, o ruido sin importancia.

FORMATO DEL INFORME (breve, esto va a una notificación push)
- Veredicto en 1-2 líneas: ¿es un bug real? ¿hace falta actuar?
- Archivo + línea de la causa.
- Si aplica, el fix propuesto en 2-3 líneas (sin aplicarlo).
Mantené el reporte corto — menos de 300 palabras.`
}

// ─── Managed Agents: crear sesión + mandar el diagnóstico ──────────────────

async function anthropicFetch(path: string, init: RequestInit) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured")
  return fetch(`${ANTHROPIC_API_BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": MANAGED_AGENTS_BETA,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  })
}

export async function dispatchDiagnosis(
  route: string | null,
  message: string,
  sampleContext: unknown,
): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  const agentId = process.env.CONSTRUCTOR_AGENT_ID
  const environmentId = process.env.CONSTRUCTOR_ENVIRONMENT_ID
  const githubToken = process.env.CONSTRUCTOR_GITHUB_TOKEN
  if (!agentId || !environmentId || !githubToken) {
    return { ok: false, error: "Constructor no configurado (faltan env vars)" }
  }

  try {
    const sessionRes = await anthropicFetch("/v1/sessions", {
      method: "POST",
      body: JSON.stringify({
        agent: agentId,
        environment_id: environmentId,
        title: `Error Watch — ${route ?? "unknown"}`,
        resources: [{
          type: "github_repository",
          url: REPO_URL,
          authorization_token: githubToken,
          mount_path: "/workspace/Smart-Scale",
          checkout: { type: "branch", name: "main" },
        }],
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!sessionRes.ok) {
      const body = await sessionRes.text().catch(() => "")
      return { ok: false, error: `session create ${sessionRes.status}: ${body.slice(0, 300)}` }
    }
    const session = await sessionRes.json()
    const sessionId = session.id as string

    const eventRes = await anthropicFetch(`/v1/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({
        events: [{ type: "user.message", content: [{ type: "text", text: buildDiagnosticPrompt(route, message, sampleContext) }] }],
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!eventRes.ok) {
      const body = await eventRes.text().catch(() => "")
      return { ok: false, error: `kickoff message ${eventRes.status}: ${body.slice(0, 300)}` }
    }

    return { ok: true, sessionId }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "unknown error" }
  }
}

/** Chequea si la sesión ya terminó de responder. Devuelve el texto del
 *  último agent.message si el hilo volvió a estar idle. */
export async function pollDiagnosis(sessionId: string): Promise<{ done: boolean; text?: string; error?: string }> {
  try {
    const res = await anthropicFetch(`/v1/sessions/${sessionId}/events?limit=50`, { method: "GET", signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return { done: false, error: `HTTP ${res.status}` }
    const { data } = await res.json() as { data: any[] }

    const isIdle = data.some((e) => e.type === "session.status_idle")
    if (!isIdle) return { done: false }

    const lastMessage = [...data].reverse().find((e) => e.type === "agent.message")
    const text = lastMessage?.content?.find((c: any) => c.type === "text")?.text ?? null
    return { done: true, text: text ?? "(el agente terminó pero no devolvió texto)" }
  } catch (err: any) {
    return { done: false, error: err?.message ?? "unknown error" }
  }
}

// ─── Orquestación (llamada desde el cron) ──────────────────────────────────

const MAX_NEW_DISPATCHES_PER_RUN = 2
const DIAGNOSING_TIMEOUT_MS = 30 * 60 * 1000 // 30 min sin resolver → failed

export async function checkPendingDiagnoses(sb: SB): Promise<{ checked: number; completed: number }> {
  const { data: pending } = await sb
    .from("error_watch_dispatches")
    .select("id, session_id, route, sample_message, updated_at")
    .eq("status", "diagnosing")

  let completed = 0
  for (const row of pending ?? []) {
    if (!row.session_id) continue
    const result = await pollDiagnosis(row.session_id)

    const timedOut = Date.now() - new Date(row.updated_at).getTime() > DIAGNOSING_TIMEOUT_MS
    if (!result.done && !timedOut) continue

    const status = result.done ? "diagnosed" : "failed"
    const diagnosis = result.done ? result.text : (result.error ?? "timeout esperando respuesta")
    await sb.from("error_watch_dispatches").update({ status, diagnosis, updated_at: new Date().toISOString() }).eq("id", row.id)

    if (result.done) {
      completed++
      await sendPushToNames(sb, ["Juampi"], {
        title: "🔍 Diagnóstico del Constructor listo",
        body: `[${row.route ?? "?"}] ${(diagnosis ?? "").slice(0, 160)}`,
        url: "/admin/dev-logs",
      }).catch(() => {})
    }
  }
  return { checked: (pending ?? []).length, completed }
}

export async function dispatchNewErrors(sb: SB): Promise<{ found: number; dispatched: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await sb
    .from("app_logs")
    .select("route, message, context, created_at")
    .in("level", ["error", "warn"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200)

  const seen = new Set<string>()
  let dispatched = 0

  for (const row of recent ?? []) {
    const signature = computeSignature(row.route, row.message)
    if (seen.has(signature)) continue
    seen.add(signature)
    if (dispatched >= MAX_NEW_DISPATCHES_PER_RUN) continue

    const { data: existing } = await sb.from("error_watch_dispatches").select("id").eq("signature", signature).maybeSingle()
    if (existing) continue

    const { data: inserted, error: insertErr } = await sb
      .from("error_watch_dispatches")
      .insert({ signature, route: row.route, sample_message: row.message.slice(0, 2000), first_seen_at: row.created_at, status: "pending" })
      .select("id")
      .single()
    if (insertErr || !inserted) continue

    const result = await dispatchDiagnosis(row.route, row.message, row.context)
    if (result.ok) {
      dispatched++
      await sb.from("error_watch_dispatches").update({ status: "diagnosing", session_id: result.sessionId, updated_at: new Date().toISOString() }).eq("id", inserted.id)
      await sendPushToNames(sb, ["Juampi"], {
        title: "⚠️ Error nuevo detectado",
        body: `[${row.route ?? "?"}] ${row.message.slice(0, 140)} — el Constructor está diagnosticando.`,
        url: "/admin/dev-logs",
      }).catch(() => {})
    } else {
      await sb.from("error_watch_dispatches").update({ status: "failed", diagnosis: result.error, updated_at: new Date().toISOString() }).eq("id", inserted.id)
    }
  }

  return { found: seen.size, dispatched }
}
