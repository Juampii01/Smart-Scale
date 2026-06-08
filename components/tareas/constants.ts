export type TaskColumnId = "por-hacer" | "en-proceso" | "en-revision" | "listo"

export const KANBAN_COLUMNS: {
  id: TaskColumnId
  label: string
  color: string
}[] = [
  { id: "por-hacer",   label: "Por hacer",   color: "var(--muted-foreground)" },
  { id: "en-proceso",  label: "En proceso",  color: "#F59E0B" },
  { id: "en-revision", label: "En revisión", color: "#8B5CF6" },
  { id: "listo",       label: "Listo",       color: "#22C55E" },
]

// Miembros del equipo asignables a una tarea
export const TEAM_MEMBERS = ["Juampi", "Fabri", "Ann"]

// Niveles de urgencia
export type TaskPriority = "urgente" | "importante" | "con-tiempo"

export const PRIORITY_LEVELS: {
  id: TaskPriority
  label: string
  color: string
  dot: string   // emoji para Slack
}[] = [
  { id: "urgente",    label: "Urgente",    color: "#EF4444", dot: "🔴" },
  { id: "importante", label: "Importante", color: "#F59E0B", dot: "🟡" },
  { id: "con-tiempo", label: "Con tiempo", color: "#22C55E", dot: "🟢" },
]

export const PRIORITY_BY_ID: Record<string, { label: string; color: string; dot: string }> =
  Object.fromEntries(PRIORITY_LEVELS.map(p => [p.id, { label: p.label, color: p.color, dot: p.dot }]))
