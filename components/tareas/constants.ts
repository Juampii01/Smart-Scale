export type TaskColumnId = "por-hacer" | "en-proceso" | "listo"

export const KANBAN_COLUMNS: {
  id: TaskColumnId
  label: string
  color: string
}[] = [
  { id: "por-hacer",   label: "Por hacer",   color: "var(--muted-foreground)" },
  { id: "en-proceso",  label: "En proceso",  color: "#F59E0B" },
  { id: "listo",       label: "Listo",       color: "#22C55E" },
]

// Miembros del equipo asignables a una tarea
export const TEAM_MEMBERS = ["Juampi", "Fabri", "Ann"]

export const LABEL_PRESETS = [
  { text: "Reels",       color: "var(--foreground)" },
  { text: "Historia",    color: "#B09A4A" },
  { text: "Urgente",     color: "#E05252" },
  { text: "Ideas",       color: "#5BBDEF" },
  { text: "Edición",     color: "#8B5CF6" },
  { text: "Guión",       color: "#10B981" },
  { text: "Grabación",   color: "#F59E0B" },
  { text: "Revisión",    color: "#6B7280" },
]
