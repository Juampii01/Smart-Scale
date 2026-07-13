/**
 * POST /api/webhooks/signnow/contract-signed
 *
 * Recibe el evento "document.complete" de SignNow (registrado por documento
 * vía lib/signnow.ts al crear cada contrato) y dispara los 3 emails de
 * onboarding vía lib/onboarding-flow.ts. Reemplaza al webhook de GHL.
 *
 * El payload real de SignNow todavía no se confirmó con un evento real — por
 * eso: (a) se guarda SIEMPRE crudo en signnow_webhook_events antes de
 * intentar parsear nada, y (b) la extracción del document_id prueba varios
 * paths posibles en vez de asumir uno solo (mismo patrón que se usó para el
 * webhook de GHL en su momento).
 *
 * Auth: header `x-webhook-secret` o `Authorization: Bearer` con
 * SIGNNOW_WEBHOOK_SECRET — mismo patrón fail-closed que el resto de webhooks
 * internos.
 *
 * Match SOLO por document_id (SignNow no manda el email del firmante en el
 * evento document.complete) contra onboarding_flow.signnow_document_id,
 * seteado de forma determinística al crear el documento.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { triggerContractSigned } from "@/lib/onboarding-flow"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function authorize(req: NextRequest): boolean {
  const secret = process.env.SIGNNOW_WEBHOOK_SECRET
  if (!secret) return false
  const incoming =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    null
  return incoming === secret
}

function getCI(obj: any, key: string): any {
  if (obj == null || typeof obj !== "object") return undefined
  const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase())
  return foundKey ? obj[foundKey] : undefined
}

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
    .from("signnow_webhook_events")
    .insert({ raw_payload: body })
    .select("id")
    .single()
  const logId = (logRow as any)?.id as string | undefined

  const documentId = pickDeep(body, "document_id", "meta.document_id", "content.document.id", "id")

  async function finish(matchedClient: string | null, error: string | null) {
    if (logId) {
      await sb.from("signnow_webhook_events")
        .update({ matched_client: matchedClient, processed_at: new Date().toISOString(), error })
        .eq("id", logId)
    }
  }

  try {
    let crmClientId: string | null = null

    if (documentId) {
      const { data } = await sb
        .from("onboarding_flow")
        .select("crm_client_id")
        .eq("signnow_document_id", documentId)
        .maybeSingle()
      crmClientId = (data as any)?.crm_client_id ?? null
    }

    if (!crmClientId) {
      const reason = `No se pudo matchear el cliente (document_id=${documentId ?? "?"})`
      console.error("[webhooks/signnow/contract-signed]", reason)
      await finish(null, reason)
      // 200 igual — evita que SignNow reintente indefinidamente un evento que
      // nunca va a poder matchear.
      return NextResponse.json({ ok: false, error: reason })
    }

    const result = await triggerContractSigned(sb, crmClientId)
    await finish(crmClientId, result.error ?? null)

    return NextResponse.json({ ok: !result.error, alreadyProcessed: result.alreadyProcessed })
  } catch (err: any) {
    console.error("[webhooks/signnow/contract-signed] error:", err?.message ?? err)
    await finish(null, err?.message ?? "unknown error")
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
