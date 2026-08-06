export type PipelineStageId =
  | "nuevo_lead"
  | "contactado"
  | "respondio"
  | "calificado"
  | "no_calificado"
  | "oferta"
  | "seguimiento_30"
  | "seguimiento_90"
  | "compraron"

// Etapas de Tom (Scale20), tal como las pasó Steffano — con "Compraron" agregado
// al final porque la lista de referencia no lo incluía pero su tablero real sí
// (columna "Won").
export const PIPELINE_COLUMNS: { id: PipelineStageId; label: string; color: string }[] = [
  { id: "nuevo_lead",     label: "Nuevo lead",              color: "var(--muted-foreground)" },
  { id: "contactado",     label: "Contactado",              color: "#3B82F6" },
  { id: "respondio",      label: "Respondió",               color: "#06B6D4" },
  { id: "calificado",     label: "Calificado (4-5★)",       color: "#dafc69" },
  { id: "no_calificado",  label: "No calificado (3★)",      color: "#6B7280" },
  { id: "oferta",         label: "Oferta realizada",        color: "#8B5CF6" },
  { id: "seguimiento_30", label: "Seguimiento · 30 días",   color: "#F59E0B" },
  { id: "seguimiento_90", label: "Seguimiento · 90 días",   color: "#F97316" },
  { id: "compraron",      label: "Compraron",               color: "#22C55E" },
]

export const PIPELINE_STAGE_LABELS: Record<PipelineStageId, string> =
  Object.fromEntries(PIPELINE_COLUMNS.map(c => [c.id, c.label])) as Record<PipelineStageId, string>

const PIPELINE_STAGE_IDS = new Set<string>(PIPELINE_COLUMNS.map(c => c.id))

/**
 * Todo lead vive en alguna columna del pipeline (a diferencia de Tom, acá no
 * hace falta agregarlo a mano: arranca clasificado por rating sin que el
 * setter tenga que moverlo).
 *
 * "nuevo" (minúscula, sin guión) es el default CRUDO de la columna status en
 * la base — todo lead que nunca se tocó llega así. Nunca se trata como una
 * asignación explícita de etapa: por eso "Nuevo lead" en el tablero tiene el
 * id "nuevo_lead", un valor distinto. Si usáramos el mismo string para los
 * dos, arrastrar una lead calificada de vuelta a "Nuevo lead" grabaría
 * status="nuevo" — que el código de acá abajo interpretaría como "todavía sin
 * tocar" y la mandaría de nuevo para adelante sola por su rating, sin dejar
 * mover ninguna lead calificada hacia atrás.
 *
 * "purchased" manda sobre el status crudo: si se marcó comprado desde la
 * tabla, se ve en "Compraron" aunque el status no se haya actualizado.
 */
export function effectiveStage(lead: { status: string | null; rating: number | null; purchased: boolean }): PipelineStageId {
  if (lead.purchased) return "compraron"
  if (lead.status && lead.status !== "nuevo" && PIPELINE_STAGE_IDS.has(lead.status)) return lead.status as PipelineStageId
  if ((lead.rating ?? 0) >= 4) return "calificado"
  if (lead.rating === 3) return "no_calificado"
  return "nuevo_lead"
}
