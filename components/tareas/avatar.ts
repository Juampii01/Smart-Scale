/**
 * Helpers de avatar para asignados de tareas.
 * Color determinístico por nombre — el mismo nombre siempre tiene el mismo color.
 */

// Paleta de colores para avatares (legibles en light y dark)
const AVATAR_COLORS = [
  "#6366F1", // indigo
  "#EC4899", // pink
  "#F59E0B", // amber
  "#10B981", // emerald
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EF4444", // red
  "#14B8A6", // teal
  "#F97316", // orange
  "#06B6D4", // cyan
]

/** Iniciales de un nombre: "Juan Pablo" -> "JP", "Ann" -> "A" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Color determinístico a partir de un string (nombre, etiqueta, etc). */
export function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/** Color para una etiqueta de texto libre (mismo algoritmo determinístico). */
export const labelColor = avatarColor
