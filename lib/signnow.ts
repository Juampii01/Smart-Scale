/**
 * SignNow Integration — reemplaza a lib/ghl.ts (GoHighLevel) en el flujo de
 * contrato/firma. A diferencia de GHL (que solo recibía los datos del cierre
 * y dejaba que un Workflow externo generara y mandara el documento), SignNow
 * es una API de e-firma pura: este código crea el documento desde una
 * plantilla, prefillea los campos, registra el webhook de "firmado", y manda
 * la invitación de firma.
 *
 * Fire-and-forget: como createGHLContact() antes, ninguna función de acá
 * lanza excepciones hacia el caller — todo devuelve null/false + un log en
 * caso de error, para no bloquear el alta de un cliente nuevo si SignNow
 * falla o todavía no está configurado.
 */

const SIGNNOW_CLIENT_ID     = process.env.SIGNNOW_CLIENT_ID
const SIGNNOW_CLIENT_SECRET = process.env.SIGNNOW_CLIENT_SECRET
const SIGNNOW_USERNAME      = process.env.SIGNNOW_USERNAME
const SIGNNOW_PASSWORD      = process.env.SIGNNOW_PASSWORD
const SIGNNOW_TEMPLATE_ID   = process.env.SIGNNOW_TEMPLATE_ID
const SIGNNOW_ROLE_NAME     = process.env.SIGNNOW_ROLE_NAME || "Cliente"
const SIGNNOW_WEBHOOK_SECRET = process.env.SIGNNOW_WEBHOOK_SECRET
const SIGNNOW_API_BASE      = "https://api.signnow.com"

export interface SignNowContractData {
  clienteNombre: string
  clienteEmail:  string
  program?:       string | null
  totalAmount?:   number
  primerPago?:    number
  cuotas?:        Record<string, number | null>   // cuota_1..cuota_6
  cantidadMeses?: number
  cantidadPagos?: number
  setterName?:    string | null
}

/** OAuth2 password grant — ver docs.signnow.com/docs/signnow/authentication */
async function getAccessToken(): Promise<string | null> {
  if (!SIGNNOW_CLIENT_ID || !SIGNNOW_CLIENT_SECRET || !SIGNNOW_USERNAME || !SIGNNOW_PASSWORD) {
    return null
  }
  try {
    const basicAuth = Buffer.from(`${SIGNNOW_CLIENT_ID}:${SIGNNOW_CLIENT_SECRET}`).toString("base64")
    const body = new URLSearchParams({
      grant_type: "password",
      username:   SIGNNOW_USERNAME,
      password:   SIGNNOW_PASSWORD,
    })
    const response = await fetch(`${SIGNNOW_API_BASE}/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    })
    const result = await response.json()
    if (!response.ok) {
      console.error("SignNow token request failed:", response.status, JSON.stringify(result).slice(0, 300))
      return null
    }
    return (result as any).access_token ?? null
  } catch (err) {
    console.error("SignNow token request error:", err)
    return null
  }
}

async function createDocumentFromTemplate(documentName: string, token: string): Promise<string | null> {
  try {
    const response = await fetch(`${SIGNNOW_API_BASE}/template/${SIGNNOW_TEMPLATE_ID}/copy`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({ document_name: documentName }),
    })
    const result = await response.json()
    if (!response.ok) {
      console.error("SignNow create document from template failed:", response.status, JSON.stringify(result).slice(0, 300))
      return null
    }
    return (result as any).id ?? null
  } catch (err) {
    console.error("SignNow create document error:", err)
    return null
  }
}

async function prefillDocumentFields(documentId: string, fields: Record<string, string>, token: string): Promise<boolean> {
  try {
    const payload = {
      fields: Object.entries(fields).map(([field_name, prefilled_text]) => ({ field_name, prefilled_text })),
    }
    const response = await fetch(`${SIGNNOW_API_BASE}/v2/documents/${documentId}/prefill-texts`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      console.error("SignNow prefill fields failed:", response.status, JSON.stringify(result).slice(0, 300))
      return false
    }
    return true
  } catch (err) {
    console.error("SignNow prefill fields error:", err)
    return false
  }
}

/** Se registra ANTES de invitar al firmante para evitar la ventana de carrera
 *  "cliente firma antes de que el webhook exista". Puede fallar si el plan de
 *  cuenta de SignNow no incluye Webhooks 2.0 — no bloquea el resto del flujo,
 *  solo faltaría el callback automático (queda el override manual como red
 *  de contención, igual que ya existe para GHL). */
async function registerContractWebhook(documentId: string, token: string): Promise<boolean> {
  if (!SIGNNOW_WEBHOOK_SECRET) return false
  try {
    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://smartscale.space"}/api/webhooks/signnow/contract-signed`
    const response = await fetch(`${SIGNNOW_API_BASE}/api/v2/events`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        event:     "document.complete",
        entity:    "document",
        entity_id: documentId,
        action:    "callback",
        attributes: {
          callback:    callbackUrl,
          use_tls_12:  true,
          headers:     { "x-webhook-secret": SIGNNOW_WEBHOOK_SECRET },
        },
      }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      console.error("SignNow register webhook failed:", response.status, JSON.stringify(result).slice(0, 300))
      return false
    }
    return true
  } catch (err) {
    console.error("SignNow register webhook error:", err)
    return false
  }
}

async function inviteSigner(documentId: string, signer: { email: string; name: string }, token: string): Promise<boolean> {
  try {
    const response = await fetch(`${SIGNNOW_API_BASE}/document/${documentId}/invite`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        to:      [{ email: signer.email, role: SIGNNOW_ROLE_NAME, order: 1 }],
        from:    SIGNNOW_USERNAME,
        subject: "Contrato Smart Scale — firmá para continuar",
        message: `Hola ${signer.name}, adjunto tu contrato para revisar y firmar.`,
      }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      console.error("SignNow invite signer failed:", response.status, JSON.stringify(result).slice(0, 300))
      return false
    }
    return true
  } catch (err) {
    console.error("SignNow invite signer error:", err)
    return false
  }
}

/** Punto de entrada único: crea el documento desde la plantilla, lo
 *  prefillea, registra el webhook de "firmado", y manda la invitación.
 *  Fire-and-forget desde el caller — nunca lanza. */
export async function sendContractForSignature(data: SignNowContractData): Promise<{ document_id: string } | null> {
  if (!SIGNNOW_CLIENT_ID || !SIGNNOW_CLIENT_SECRET || !SIGNNOW_USERNAME || !SIGNNOW_PASSWORD || !SIGNNOW_TEMPLATE_ID) {
    console.warn("SignNow credentials not configured")
    return null
  }

  try {
    const token = await getAccessToken()
    if (!token) return null

    const documentId = await createDocumentFromTemplate(`Contrato — ${data.clienteNombre}`, token)
    if (!documentId) return null

    const fields: Record<string, string> = {
      cliente_nombre:      data.clienteNombre,
      cliente_email:       data.clienteEmail,
    }
    if (data.program)        fields.programa            = data.program
    if (data.totalAmount)    fields.pago_total           = String(data.totalAmount)
    if (data.primerPago)     fields.pago_entrada         = String(data.primerPago)
    if (data.setterName)     fields.setter               = data.setterName
    if (data.cantidadPagos)  fields.cantidad_de_pagos    = String(data.cantidadPagos)
    if (data.cantidadMeses)  fields.cantidad_de_meses    = String(data.cantidadMeses)
    if (data.cuotas) {
      for (let i = 1; i <= 6; i++) {
        const val = data.cuotas[`cuota_${i}`]
        if (val != null && val > 0) fields[`mes_${i}`] = String(val)
      }
    }
    await prefillDocumentFields(documentId, fields, token)

    await registerContractWebhook(documentId, token)

    const invited = await inviteSigner(documentId, { email: data.clienteEmail, name: data.clienteNombre }, token)
    if (!invited) return null

    return { document_id: documentId }
  } catch (err) {
    console.error("SignNow contract send error:", err)
    return null
  }
}
