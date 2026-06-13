/**
 * Mapeo centralizado email → nombre del equipo interno.
 * Completá con los emails de cada uno para que se muestren por nombre
 * (en comentarios de tareas y notificaciones de Slack).
 */
const TEAM_BY_EMAIL: Record<string, string> = {
  "juampiacosta158@gmail.com": "Juampi",
  "ann@strategycoach.us":      "Ann",
  "delacruzfabra@gmail.com":   "Fabri",
}

/** Devuelve el nombre lindo, o null si no se puede resolver. */
export function resolveTeamName(idOrEmail?: string | null): string | null {
  if (!idOrEmail) return null
  const known = TEAM_BY_EMAIL[idOrEmail.toLowerCase()]
  if (known) return known
  if (idOrEmail.includes("@")) {
    const local = idOrEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim()
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : null
  }
  return null
}
