/**
 * Sistema de permisos por rol.
 *
 * Roles posibles en `profiles.role`:
 *   - "admin"  → acceso total (todas las páginas /admin/*, override de cliente activo, crear usuarios)
 *   - "team"   → acceso parcial al CRM (applications, leads, centro-operativo, data)
 *   - "setter" → solo Setting CRM (carga su daily log) + leads
 *   - null     → cliente final (portal coach, sin acceso /admin/*)
 *
 * Los roles internos se crean desde el Centro Operativo (form de "Nuevo usuario") por un admin.
 * Los clientes finales se crean por flujo separado (signup / aplicación).
 */

export type UserRole = "admin" | "team" | "setter" | string | null | undefined

export const ROLE_OPTIONS = [
  { value: "admin",  label: "Admin",  description: "Acceso total al CRM y gestión de usuarios" },
  { value: "team",   label: "Team",   description: "Applications, leads, centro operativo y datos" },
  { value: "setter", label: "Setter", description: "Solo Setting CRM (carga métricas diarias)" },
] as const

export const TEAM_ALLOWED_ADMIN_PATHS = [
  "/admin/applications",
  "/admin/leads",
  "/admin/centro-operativo",
  "/admin/data",
] as const

export const SETTER_ALLOWED_ADMIN_PATHS = [
  "/admin/setting",
  "/admin/leads",
] as const

export const ADMIN_DEFAULT_LANDING  = "/admin/leads"
export const TEAM_DEFAULT_LANDING   = "/admin/leads"
export const SETTER_DEFAULT_LANDING = "/admin/setting"

export function normalizeRole(role: UserRole): "admin" | "team" | "setter" | "client" {
  const r = String(role ?? "").toLowerCase()
  if (r === "admin")  return "admin"
  if (r === "team")   return "team"
  if (r === "setter") return "setter"
  return "client"
}

export function isAdmin(role: UserRole):  boolean { return normalizeRole(role) === "admin" }
export function isTeam(role: UserRole):   boolean { return normalizeRole(role) === "team" }
export function isSetter(role: UserRole): boolean { return normalizeRole(role) === "setter" }

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
