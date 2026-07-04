/**
 * POST /api/webhooks/ghl/contract-signed
 *
 * Recibe el evento de "contrato firmado" directo desde el Workflow de
 * GoHighLevel (sin Zapier de por medio) y dispara los 3 emails de onboarding
 * vía lib/onboarding-flow.ts.
 *
 * El payload real de GHL todavía no se conoce (a confirmar con un contrato de
 * prueba) — por eso: (a) se guarda SIEMPRE crudo en ghl_webhook_events antes
 * de intentar parsear nada, y (b) la extracción de email/contact_id prueba
 * varios nombres de campo posibles en vez de asumir uno solo.
 *
 * Auth: header `x-webhook-secret` o `Authorization: Bearer` con
 * GHL_WEBHOOK_SECRET — mismo patrón fail-closed que /api/webhooks/client.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { triggerContractSigned } from "@/lib/onboarding-flow"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function authorize(req: NextRequest): boolean {
  const secret = process.env.GHL_WEBHOOK_SECRET
  if (!secret) return false
  const incoming =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    null
  return incoming === secret
}

/** Acceso case-insensitive — GHL nombra las custom keys tal cual las escribiste
 *  en el Workflow (ej: "Email", no "email"), así que no podemos asumir casing. */
function getCI(obj: any, key: string): any {
  if (obj == null || typeof obj !== "object") return undefined
  const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase())
  return foundKey ? obj[foundKey] : undefined
}

/** Prueba varios paths posibles dentro del payload de GHL — se ajusta cuando
 *  llegue un ejemplo real. */
function pickDeep(obj: any, ...paths: string[]): string | null {
  for (const path of paths) {
    const val = path.split(".").reduce((acc: any, key) => getCI(acc, key), obj)
    if (val != null && val !== "") return String(val)
  }
  return null
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: any
  try { body = await req.json() } catch {
    body = {}
  }

  const sb = createServiceClient()

  // Guardar el payload crudo SIEMPRE, antes de cualquier intento de parseo.
  const { data: logRow } = await sb
    .from("ghl_webhook_events")
    .insert({ raw_payload: body })
    .select("id")
    .single()
  const logId = (logRow as any)?.id as string | undefined

  const email = pickDeep(body, "email", "contact.email", "customData.email", "data.email", "contact_email")
  const ghlContactId = pickDeep(body, "contact_id", "contactId", "contact.id", "id", "data.contact_id")

  async function finish(matchedClient: string | null, error: string | null) {
    if (logId) {
      await sb.from("ghl_webhook_events")
        .update({ matched_client: matchedClient, processed_at: new Date().toISOString(), error })
        .eq("id", logId)
    }
  }

  try {
    let crmClientId: string | null = null

    if (ghlContactId) {
      const { data } = await sb.from("crm_clients").select("id").eq("id", ghlContactId).maybeSingle()
      // ghl_contact_id no es el mismo id que crm_clients.id — buscar por columna correcta.
      const { data: byGhlId } = await sb
        .from("onboarding_flow")
        .select("crm_client_id")
        .eq("ghl_contact_id", ghlContactId)
        .maybeSingle()
      crmClientId = (byGhlId as any)?.crm_client_id ?? (data as any)?.id ?? null
    }

    if (!crmClientId && email) {
      const { data } = await sb.from("crm_clients").select("id").eq("email", email.toLowerCase()).maybeSingle()
      crmClientId = (data as any)?.id ?? null
    }

    if (!crmClientId) {
      const reason = `No se pudo matchear el cliente (email=${email ?? "?"}, ghl_contact_id=${ghlContactId ?? "?"})`
      console.error("[webhooks/ghl/contract-signed]", reason)
      await finish(null, reason)
      // 200 igual — evita que GHL reintente indefinidamente un evento que
      // nunca va a poder matchear.
      return NextResponse.json({ ok: false, error: reason })
    }

    const result = await triggerContractSigned(sb, crmClientId)
    await finish(crmClientId, result.ok ? null : (result.error ?? "triggerContractSigned falló"))

    return NextResponse.json({ ok: result.ok, alreadyProcessed: result.alreadyProcessed })
  } catch (err: any) {
    console.error("[webhooks/ghl/contract-signed] error:", err?.message ?? err)
    await finish(null, err?.message ?? "unknown error")
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
