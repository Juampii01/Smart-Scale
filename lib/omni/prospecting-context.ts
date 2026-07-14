// Bloque de contexto adicional para el análisis individual de conversaciones
// (lib/omni/conversation-analysis.ts) — específico del apartado
// "Prospección" que carga Steffano. Se concatena AL FINAL del system prompt
// de Ann (buildOmniSystemPrompt), nunca lo reemplaza ni lo reescribe: el
// criterio base sigue siendo el de Ann, esto solo ajusta cómo se redacta el
// feedback (traducido a español llano, con foco en la transición
// conversación→offer-doc) y suma ejemplos reales de qué funcionó o no.
//
// No bloqueante: si no hay contexto cargado o falla la lectura, se devuelve
// string vacío — el análisis sigue funcionando solo con el criterio de Ann.

import { createServiceClient } from "@/lib/supabase-service"

const MAX_PATTERNS = 8

const RESULTADO_LABEL: Record<string, string> = {
  cerro:     "cerró",
  no_cerro:  "no cerró",
  pendiente: "pendiente",
}

export async function buildProspectingContextBlock(
  sb: ReturnType<typeof createServiceClient>,
): Promise<string> {
  try {
    const { data: context } = await sb
      .from("omni_prospecting_context")
      .select("workflow_inbound, workflow_outbound, notas_generales")
      .eq("context_id", "prospeccion")
      .maybeSingle()

    const { data: patterns } = await sb
      .from("omni_prospecting_patterns")
      .select("situacion, enfoque, resultado, correccion")
      .order("created_at", { ascending: false })
      .limit(MAX_PATTERNS)

    const hasContext = !!(
      (context as any)?.workflow_inbound?.trim() ||
      (context as any)?.workflow_outbound?.trim() ||
      (context as any)?.notas_generales?.trim()
    )
    const hasPatterns = (patterns?.length ?? 0) > 0

    if (!hasContext && !hasPatterns) return ""

    const lines: string[] = [
      "## Ajustes para este feedback (apartado Prospección)",
      "",
      "Traducí cualquier término del vocabulario de Ann a español llano la " +
      "primera vez que lo uses en este feedback — quien lo lee recién está " +
      "empezando y todavía no conoce esa jerga.",
      "",
      "Priorizá en 'accion' específicamente la transición de \"seguir en " +
      "conversación\" vs. \"pasar a mandar el offer doc\" cuando aplique — " +
      "ese es el cuello de botella que se está trabajando ahora.",
    ]

    if (hasContext) {
      lines.push("", "### Workflow de prospección")
      if ((context as any).workflow_inbound?.trim()) {
        lines.push(`Inbound: ${(context as any).workflow_inbound.trim()}`)
      }
      if ((context as any).workflow_outbound?.trim()) {
        lines.push(`Outbound: ${(context as any).workflow_outbound.trim()}`)
      }
      if ((context as any).notas_generales?.trim()) {
        lines.push(`Notas: ${(context as any).notas_generales.trim()}`)
      }
    }

    if (hasPatterns) {
      lines.push("", "### Patrones reales registrados (más recientes primero)")
      for (const p of patterns as any[]) {
        const resultado = RESULTADO_LABEL[p.resultado] ?? p.resultado
        let line = `- Situación: ${p.situacion} → Enfoque usado: ${p.enfoque} → Resultado: ${resultado}`
        if (p.correccion?.trim()) line += ` → Corrección: ${p.correccion.trim()}`
        lines.push(line)
      }
    }

    return lines.join("\n")
  } catch (err) {
    console.error("[prospecting-context] error armando el bloque (no bloqueante):", err)
    return ""
  }
}
