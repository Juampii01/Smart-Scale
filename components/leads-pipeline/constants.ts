export type PipelineStageId =
  | "calificado"
  | "seguimiento"
  | "oferta"
  | "seguimiento_48h"
  | "seguimiento_30d"
  | "seguimiento_90d"
  | "compraron"
  | "perdimos"

// El pipeline arranca directo en Calificado (4-5★) — no tiene sentido para
// Smart Scale trackear "Nuevo lead"/"Contactado"/"Respondió"/"No calificado":
// el setter recién agrega algo a este tablero cuando ya calificó al lead.
export const PIPELINE_COLUMNS: { id: PipelineStageId; label: string; color: string }[] = [
  { id: "calificado",        label: "Calificado (4-5★)",         color: "var(--accent-ink)" },
  { id: "seguimiento",       label: "Seguimiento 4/5 estrellas", color: "#06B6D4" },
  { id: "oferta",            label: "Oferta realizada",          color: "#8B5CF6" },
  { id: "seguimiento_48h",   label: "Seguimiento · 48 horas",    color: "#F59E0B" },
  { id: "seguimiento_30d",   label: "Seguimiento · 30 días",     color: "#F97316" },
  { id: "seguimiento_90d",   label: "Seguimiento · 90 días",     color: "#EA580C" },
  { id: "compraron",         label: "Compraron",                 color: "#22C55E" },
  { id: "perdimos",          label: "Perdimos",                  color: "#EF4444" },
]

export const PIPELINE_STAGE_LABELS: Record<PipelineStageId, string> =
  Object.fromEntries(PIPELINE_COLUMNS.map(c => [c.id, c.label])) as Record<PipelineStageId, string>

const PIPELINE_STAGE_IDS = new Set<string>(PIPELINE_COLUMNS.map(c => c.id))

/**
 * A diferencia de la versión anterior (que mostraba TODOS los leads), acá
 * solo entran al pipeline los de 4-5★ — el resto (3★, sin calificar, o
 * cualquier status viejo que ya no exista como columna) directamente no
 * aparece en el tablero. null = no está en el pipeline.
 *
 * "purchased" manda sobre el status crudo: si se marcó comprado desde la
 * tabla, se ve en "Compraron" aunque el status no se haya actualizado.
 */
export function effectiveStage(lead: { status: string | null; rating: number | null; purchased: boolean }): PipelineStageId | null {
  if (lead.purchased) return "compraron"
  if (lead.status && PIPELINE_STAGE_IDS.has(lead.status)) return lead.status as PipelineStageId
  if ((lead.rating ?? 0) >= 4) return "calificado"
  return null
}
