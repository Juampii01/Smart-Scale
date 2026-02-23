// Supabase Edge Function: research-worker
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

export const config = {
  verify_jwt: false,
}
// NOTE: If you still see 401 before this code runs, disable "Verify JWT" for this function in Supabase Dashboard (Function Details).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

async function supabaseFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers ?? {})
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")

  // Always use service role for DB writes/reads inside the worker
  headers.set("apikey", SUPABASE_SERVICE_ROLE_KEY)
  headers.set("Authorization", `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`)

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers,
  })
}

async function supabaseRpc(fn: string, body: any = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

serve(async (req: Request) => {
  console.log("WORKER EJECUTADO");
  let requestId: string | undefined = undefined
  try {
    // Obtener requests pendientes
    const rpcRes = await supabaseRpc("get_next_pending_request");
    if (!rpcRes.ok) {
      throw new Error("RPC error: " + await rpcRes.text());
    }
    const data = await rpcRes.json();
    console.log("RPC RESULT:", data);

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return new Response("No pending requests", { status: 200 });
    }

    const pendingRequest = Array.isArray(data) ? data[0] : data;

    if (!pendingRequest || !pendingRequest.id) {
      throw new Error("Invalid pending request structure");
    }

    requestId = pendingRequest.id;
    // Claim the job (prevents re-processing the same request on subsequent invocations)
    const claimRes = await supabaseFetch(`research_requests?id=eq.${requestId}&status=eq.pending`, {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "processing",
        started_at: new Date().toISOString(),
        error_message: null,
      }),
    })

    if (!claimRes.ok) {
      throw new Error("Claim research_requests failed: " + await claimRes.text())
    }

    const claimed = await claimRes.json()
    if (!Array.isArray(claimed) || claimed.length === 0) {
      // Someone else claimed it or it is no longer pending
      return new Response("Nothing to claim", { status: 200 })
    }

    // Integración Anthropic
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      console.error("Missing ANTHROPIC_API_KEY at runtime");
      return new Response("Missing ANTHROPIC_API_KEY", { status: 500 });
    }

    function buildPrompt(request) {
      const { platform, competitors, transcripts, ...rest } = request;
      let prompt = "";
      // Hard limits to avoid WORKER_LIMIT (compute exhaustion)
      const MAX_COMPETITORS_CHARS = 8000;
      const MAX_TRANSCRIPTS_CHARS = 12000;
      if (platform === "youtube") {
        prompt += `Eres un analista de inteligencia competitiva especializado en YouTube. Analiza los siguientes datos:\n`;
      } else if (platform === "instagram") {
        prompt += `Eres un analista de inteligencia competitiva especializado en Instagram. Analiza los siguientes datos:\n`;
      } else {
        prompt += `Eres un analista de inteligencia competitiva. Analiza los siguientes datos:\n`;
      }
      const competitorsString = JSON.stringify(competitors, null, 2);
      prompt += `Competidores:\n${
        competitorsString.length > MAX_COMPETITORS_CHARS
          ? competitorsString.slice(0, MAX_COMPETITORS_CHARS) + "\n[TRUNCATED]"
          : competitorsString
      }\n`;
      if (transcripts) {
        const transcriptsString = JSON.stringify(transcripts, null, 2);
        prompt += `Transcripciones:\n${
          transcriptsString.length > MAX_TRANSCRIPTS_CHARS
            ? transcriptsString.slice(0, MAX_TRANSCRIPTS_CHARS) + "\n[TRUNCATED]"
            : transcriptsString
        }\n`;
      }
      Object.entries(rest).forEach(([key, value]) => {
        if (value !== undefined) {
          prompt += `${key}:\n${JSON.stringify(value, null, 2)}\n`;
        }
      });
      prompt += `
Eres un analista senior de inteligencia competitiva y estrategia digital. Tu nivel es experto. No generas análisis genéricos. No produces consejos superficiales. Detectas patrones reales a partir de los datos proporcionados.

Tu tarea es construir un informe estratégico profundo, específico y accionable basado EXCLUSIVAMENTE en los datos entregados arriba.

IMPORTANTE:
- No escribas frases aplicables a cualquier cuenta.
- Basa cada insight en patrones observables del contenido analizado.
- Si no puedes inferir algo desde los datos, deja el array vacío [].
- No inventes información.
- No repitas estructuras estándar del nicho sin justificación.
- El análisis debe parecer realizado por un consultor estratégico premium.

El nivel de profundidad debe ser avanzado:
- Detecta posicionamiento implícito.
- Identifica contradicciones estratégicas.
- Señala oportunidades diferenciales reales.
- Evalúa el nivel de sofisticación del mensaje.
- Analiza comportamiento probable del algoritmo según la plataforma.

Devuelve EXCLUSIVAMENTE un JSON válido, sin markdown, sin comentarios y sin texto fuera del JSON.

La estructura debe ser EXACTAMENTE:

{
  "executive_summary": string,
  "dominant_patterns": [
    { "pattern": string, "description": string }
  ],
  "hook_frameworks": [
    { "framework": string, "description": string }
  ],
  "positioning_analysis": string,
  "market_sophistication_level": string,
  "saturation_level": string,
  "market_gaps": [
    { "gap": string, "description": string }
  ],
  "strategic_opportunities": [
    { "opportunity": string, "description": string }
  ],
  "recommended_content_angles": [
    { "angle": string, "description": string }
  ],
  "storytelling_structures": [
    { "structure": string, "description": string }
  ]
}

Reglas obligatorias:
- Todas las claves deben existir.
- Si no hay evidencia suficiente, devuelve arrays vacíos [].
- No incluyas texto fuera del JSON.
- No uses markdown.
- No agregues claves adicionales.
- Máximo 5 elementos por array.
- Cada descripción debe ser concreta, estratégica y no genérica.
- Todo el contenido textual debe estar 100% en español.
- Las claves del JSON deben permanecer en inglés exactamente como están.
- Si produces contenido genérico, reformúlalo con mayor especificidad antes de finalizar.

El resultado debe sentirse como un informe de inteligencia estratégica premium, no como un resumen educativo.
`;
      return prompt;
    }

    function safeParseJSON(text: string) {
      try {
        const cleaned = text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");

        if (start === -1 || end === -1) {
          throw new Error("No se encontró un objeto JSON válido en la respuesta");
        }

        // Si parece truncado, intentamos parsear igualmente en vez de fallar
        if (!cleaned.trim().endsWith("}")) {
          console.warn("Posible JSON truncado por límite de tokens, intentando parsear igualmente...");
        }

        let jsonString = cleaned.substring(start, end + 1);

        try {
          return JSON.parse(jsonString);
        } catch (firstErr) {
          // Attempt repair: remove trailing commas
          jsonString = jsonString
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]");

          return JSON.parse(jsonString);
        }

      } catch (err: any) {
        console.error("RAW ANTHROPIC RESPONSE:", text);
        throw new Error("Error al parsear JSON: " + err.message);
      }
    }

    function validateStructure(result: any) {
      const requiredKeys = [
        "executive_summary",
        "dominant_patterns",
        "hook_frameworks",
        "positioning_analysis",
        "market_sophistication_level",
        "saturation_level",
        "market_gaps",
        "strategic_opportunities",
        "recommended_content_angles",
        "storytelling_structures",
      ];

      for (const key of requiredKeys) {
        if (!(key in result)) {
          throw new Error(`Falta la clave obligatoria: ${key}`);
        }
      }

      // Ensure arrays are arrays (prevent DB crashes)
      const arrayKeys = [
        "dominant_patterns",
        "hook_frameworks",
        "market_gaps",
        "strategic_opportunities",
        "recommended_content_angles",
        "storytelling_structures",
      ];

      for (const key of arrayKeys) {
        if (!Array.isArray(result[key])) {
          result[key] = [];
        }
      }
    }

    async function callAnthropic(prompt: string) {
      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY no configurada");
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          temperature: 0.2,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error en Anthropic: ${errorText}`);
      }

      const data = await response.json();
      // If truncated by max_tokens, we still attempt to parse.
      // Do NOT throw here because often the JSON is complete enough.
      if (data?.stop_reason === "max_tokens") {
        console.warn("Anthropic response reached max_tokens limit, attempting to parse anyway...");
      }

      if (!data?.content?.[0]?.text) {
        throw new Error("Respuesta de Anthropic inválida");
      }

      return data.content[0].text;
    }

    // Construir prompt dinámico
    const prompt = buildPrompt(pendingRequest);
    // Llamar a Anthropic con reintentos y parseo seguro
    let anthropicResponse: string | null = null;
    let parsedResult: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        anthropicResponse = await callAnthropic(prompt);
        parsedResult = safeParseJSON(anthropicResponse);
        break; // éxito
      } catch (e) {
        if (attempt === 2) {
          throw e;
        }
        console.warn("Retrying Anthropic call due to parse error...");
      }
    }
    // Validar estructura
    validateStructure(parsedResult);
    // Eliminar resultado previo si existe
    await supabaseFetch(`research_results?request_id=eq.${requestId}`, {
      method: "DELETE",
    });

    // Insertar nuevo resultado
    const insertRes = await supabaseFetch("research_results", {
      method: "POST",
      body: JSON.stringify({
        request_id: requestId,

        // Español (estructura real de tu tabla)
        resumen_ejecutivo: parsedResult.executive_summary,
        patrones_dominantes: parsedResult.dominant_patterns,
        frameworks_de_ganchos: parsedResult.hook_frameworks,
        analisis_de_posicionamiento: parsedResult.positioning_analysis,
        nivel_de_sofisticacion_del_mercado: parsedResult.market_sophistication_level,
        nivel_de_saturacion: parsedResult.saturation_level,
        brechas_de_mercado: parsedResult.market_gaps,
        oportunidades_estrategicas: parsedResult.strategic_opportunities,
        angulos_de_contenido_recomendados: parsedResult.recommended_content_angles,
        estructuras_de_storytelling: parsedResult.storytelling_structures ?? null,
      }),
    });

    if (!insertRes.ok) {
      throw new Error("Insert research_results failed: " + await insertRes.text());
    }
    // Marcar request como completed
    const completeRes = await supabaseFetch(`research_requests?id=eq.${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "completed",
        completed_at: new Date().toISOString(),
        error_message: null,
      }),
    })

    if (!completeRes.ok) {
      throw new Error("Complete research_requests failed: " + await completeRes.text())
    }
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Worker error:", err);

    if (requestId) {
      await supabaseFetch(`research_requests?id=eq.${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "failed",
          error_message: err instanceof Error ? err.message : String(err)
        })
      });
    }

    return new Response(
      err instanceof Error ? err.message : String(err),
      { status: 500 }
    );
  }
})
