// Supabase Edge Function: ai-diagnosis-worker
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

export const config = {
  verify_jwt: false,
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!

async function supabaseFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers ?? {})
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  headers.set("apikey", SUPABASE_SERVICE_ROLE_KEY)
  headers.set("Authorization", `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`)

  if (!headers.has("Prefer") && options.method && options.method !== "GET") {
    headers.set("Prefer", "return=minimal")
  }

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers,
  })
}

serve(async (req) => {
  let requestedRequestId: string | null = null

  try {
    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null)
      requestedRequestId = typeof body?.request_id === "string" ? body.request_id : null
    }
  } catch {
    requestedRequestId = null
  }

  let request: any = null

  if (requestedRequestId) {
    const requestedRes = await supabaseFetch(
      `ai_diagnosis_requests?select=*&id=eq.${requestedRequestId}&limit=1`
    )

    if (!requestedRes.ok) {
      const errorText = await requestedRes.text().catch(() => "")
      return new Response(
        `Error fetching ai diagnosis request ${requestedRequestId}: ${errorText}`,
        { status: 500 }
      )
    }

    const requestedRows = await requestedRes.json().catch(() => [])
    request = Array.isArray(requestedRows) ? requestedRows[0] ?? null : null

    if (!request) {
      return new Response(`AI diagnosis request not found: ${requestedRequestId}`, {
        status: 404,
      })
    }

    if (request.status !== "pending") {
      return new Response(`AI diagnosis request ${requestedRequestId} is ${request.status}`, {
        status: 200,
      })
    }
  } else {
    const res = await supabaseFetch(
      "ai_diagnosis_requests?select=*&status=eq.pending&order=created_at.asc&limit=1"
    )

    if (!res.ok) {
      const errorText = await res.text().catch(() => "")
      return new Response(`Error fetching pending ai diagnosis requests: ${errorText}`, {
        status: 500,
      })
    }

    const pendingRequests = await res.json().catch(() => [])

    if (!Array.isArray(pendingRequests) || pendingRequests.length === 0) {
      return new Response("No pending ai diagnosis requests", { status: 200 })
    }

    request = pendingRequests[0]
  }

  const requestId = request.id
  console.log("Processing ai diagnosis request:", requestId)

  await supabaseFetch(`ai_diagnosis_requests?id=eq.${requestId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "processing",
      updated_at: new Date().toISOString(),
    }),
  })

  const system = `Actúa como un advisor estratégico de Smart Scale.

Tu trabajo es devolver una respuesta SIMPLE, CORTA, DIRECTA y ESTRUCTURADA.

Reglas obligatorias:
- Responde en español.
- Usa markdown.
- Sé breve, claro y concreto.
- No expliques de más.
- No uses storytelling.
- No motives.
- No des contexto extra.
- No inventes datos.
- No inventes benchmarks.
- No nombres colores como rojo, naranja o verde en la respuesta final.
- No uses frases como “hay demanda”, “hay conversión”, “hay tracción” ni conclusiones generales no pedidas.
- No reformules los puntos. Usa el nombre exacto del punto cuando lo menciones.
- No des libre interpretación. Solo sigue la estructura pedida.
- No des una solución concreta ni táctica detallada.
- Tu trabajo es indicar en qué se tiene que enfocar la persona y mandarla al checklist, roadmap o recurso correcto.
- No respondas como si estuvieras resolviendo el problema en el mensaje.
- Si no tienes un link específico, deja [LINK].
- La respuesta debe ser lo más concisa posible sin perder claridad.
- No escribas párrafos largos.
- Cada punto debe ocupar poco espacio.
- Debes seguir exactamente el orden pedido y no salirte de ahí.`

  const userMessage = `AUDITORÍA RESPONDIDA POR EL USUARIO:
${request.prompt}

QUIERO QUE RESPONDAS SOLO CON ESTA ESTRUCTURA Y NADA MÁS:

# Mapa de Ruta Smart Scale

## En primer lugar
Aquí debes poner únicamente los puntos críticos que requieren atención inmediata.
- Incluye SOLO los puntos marcados como [ROJO].
- No digas que son rojos.
- Ve punto por punto.
- Usa el nombre exacto del punto.
- En cada punto usa este formato exacto:

### [NOMBRE EXACTO DEL PUNTO]
- Enfocate en: [frase corta indicando qué área debe trabajar]
- Mirá esto: [nombre del checklist, roadmap o recurso] → [LINK]

## En segundo lugar
Aquí debes poner únicamente los puntos importantes, pero no urgentes.
- Incluye SOLO los puntos marcados como [NARANJA].
- No digas que son naranjas.
- Ve punto por punto.
- Usa el nombre exacto del punto.
- En cada punto usa este formato exacto:

### [NOMBRE EXACTO DEL PUNTO]
- Enfocate en: [frase corta indicando qué área debe fortalecer]
- Mirá esto: [nombre del checklist, roadmap o recurso] → [LINK]

## Felicitaciones
Aquí debes poner únicamente los puntos que ya están bien.
- Incluye SOLO los puntos marcados como [VERDE].
- No digas que son verdes.
- Ve punto por punto.
- Usa el nombre exacto del punto.
- En cada punto usa este formato exacto:

### [NOMBRE EXACTO DEL PUNTO]
- Esto ya está bien: [frase corta y directa]
- Seguí apoyándote en: [nombre del checklist, roadmap o recurso] → [LINK]

REGLAS FINALES:
- No agregues introducción.
- No agregues cierre.
- No agregues análisis general.
- No agregues cuello de botella.
- No agregues prioridad estratégica.
- No des instrucciones tácticas específicas dentro del texto.
- Solo marca el foco correcto y deriva al roadmap, checklist o recurso indicado.`

  let responseText = ""
  let rawResponse: any = null

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1400,
        system,
        messages: [{ role: "user", content: userMessage }],
      }),
    })

    rawResponse = await anthropicRes.json()

    if (!anthropicRes.ok) {
      responseText = `Error al consultar Anthropic: ${JSON.stringify(rawResponse)}`
    } else {
      responseText = Array.isArray(rawResponse?.content)
        ? rawResponse.content
            .map((block: any) => (block?.type === "text" ? block.text : ""))
            .join("\n")
            .trim()
        : ""
    }
  } catch (error: any) {
    responseText = `Error al consultar Anthropic: ${error?.message || String(error)}`
    rawResponse = { error: String(error) }
  }

  const insertResultRes = await supabaseFetch("ai_diagnosis_results", {
    method: "POST",
    body: JSON.stringify({
      request_id: requestId,
      result: responseText,
      raw_response: rawResponse,
      created_at: new Date().toISOString(),
    }),
  })

  if (!insertResultRes.ok) {
    const errorText = await insertResultRes.text().catch(() => "")

    await supabaseFetch(`ai_diagnosis_requests?id=eq.${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        updated_at: new Date().toISOString(),
      }),
    })

    return new Response(`Error saving ai diagnosis result: ${errorText}`, {
      status: 500,
    })
  }

  const finalStatus = responseText.startsWith("Error al consultar Anthropic:")
    ? "failed"
    : "completed"

  await supabaseFetch(`ai_diagnosis_requests?id=eq.${requestId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: finalStatus,
      updated_at: new Date().toISOString(),
    }),
  })

  return new Response("AI diagnosis processed", { status: 200 })
})
