/**
 * Sistema de permisos por rol.
 *
 * Roles posibles en `profiles.role`:
 *   - "admin"     → acceso total (todas las páginas /admin/*, override de cliente activo, crear usuarios)
 *   - "developer" → idéntico a admin (equipo técnico — mismo acceso completo)
 *   - "team"      → acceso parcial al CRM (applications, leads, centro-operativo, data)
 *   - "setter"    → solo Setting CRM (carga su daily log) + leads
 *   - "client"    → portal del cliente (dashboard, métricas, recursos)
 *
 * Los roles internos se crean desde el Centro Operativo (form de "Nuevo usuario") por un admin.
 * Los clientes finales se crean por flujo separado (signup / aplicación).
 */

export type UserRole = "admin" | "developer" | "team" | "setter" | string | null | undefined

export const ROLE_OPTIONS = [
  { value: "admin",     label: "Admin",     description: "Acceso total al CRM y gestión de usuarios" },
  { value: "developer", label: "Developer", description: "Acceso total igual que admin (equipo técnico)" },
  { value: "team",      label: "Team",      description: "Applications, leads, centro operativo y datos" },
  { value: "setter",    label: "Setter",    description: "Solo Setting CRM (carga métricas diarias)" },
  { value: "client",    label: "Cliente",   description: "Acceso al portal del cliente (dashboard, métricas, recursos)" },
] as const

export const TEAM_ALLOWED_ADMIN_PATHS = [
  "/admin/data",
  "/admin/leads",
  "/admin/setting",
  "/admin/applications",
  "/admin/centro-operativo",
  "/admin/onboarding",
  "/admin/tareas",        // tablero compartido del equipo
] as const

// Setter no ve Adquisition Stats (/admin/data); el resto igual que team.
// Prospección vive como tab dentro de /admin/centro-operativo (no path standalone).
// Landing default: /admin/setting (su flow principal).
export const SETTER_ALLOWED_ADMIN_PATHS = [
  "/admin/leads",
  "/admin/setting",
  "/admin/applications",
  "/admin/centro-operativo",
  "/admin/onboarding",
  "/admin/tareas",        // tablero compartido del equipo
] as const

export const ADMIN_DEFAULT_LANDING  = "/admin/leads"
export const TEAM_DEFAULT_LANDING   = "/admin/leads"
export const SETTER_DEFAULT_LANDING = "/admin/setting"

export function normalizeRole(role: UserRole): "admin" | "team" | "setter" | "client" {
  const r = String(role ?? "").toLowerCase()
  if (r === "admin" || r === "developer") return "admin"  // developer = acceso total
  if (r === "team")   return "team"
  if (r === "setter") return "setter"
  return "client"
}

export function isAdmin(role: UserRole):  boolean { return normalizeRole(role) === "admin" }
export function isTeam(role: UserRole):   boolean { return normalizeRole(role) === "team" }
export function isSetter(role: UserRole): boolean { return normalizeRole(role) === "setter" }

/** Rol developer "crudo" (sin normalizar). `normalizeRole` colapsa developer en admin,
 *  así que para gatear features exclusivas del equipo técnico (ej: botón "Testear" que
 *  envía datos aleatorios) hay que mirar el string original. */
export function isDeveloper(role: UserRole): boolean {
  return String(role ?? "").toLowerCase() === "developer"
}

/** admin OR team OR setter — cualquier rol con acceso a la sección /admin */
export function isInternal(role: UserRole): boolean {
  const r = normalizeRole(role)
  return r === "admin" || r === "team" || r === "setter"
}

export function canAccessAdminPath(role: UserRole, path: string): boolean {
  if (isAdmin(role)) return true
  if (isTeam(role)) {
    return TEAM_ALLOWED_ADMIN_PATHS.some(allowed => path === allowed || path.startsWith(allowed + "/"))
  }
  if (isSetter(role)) {
    return SETTER_ALLOWED_ADMIN_PATHS.some(allowed => path === allowed || path.startsWith(allowed + "/"))
  }
  return false
}

export function getDefaultLandingForRole(role: UserRole): string {
  const r = normalizeRole(role)
  if (r === "admin")  return ADMIN_DEFAULT_LANDING
  if (r === "team")   return TEAM_DEFAULT_LANDING
  if (r === "setter") return SETTER_DEFAULT_LANDING
  return "/reflection"
}
