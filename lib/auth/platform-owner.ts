// Bypass total del sector interno multi-tenant ("Ver Clientes") — exclusivo
// del dueño de la plataforma. Distinto de OMNI_ALLOWED_EMAILS (lib/omni/owner.ts),
// que incluye a Ann y Steffano para el piloto de Ann AI: acá nadie más que el
// platform owner puede navegar el sector interno de otro cliente.
export const PLATFORM_OWNER_EMAILS = ["juampiacosta158@gmail.com"]

export function isPlatformOwnerEmail(email?: string | null): boolean {
  return PLATFORM_OWNER_EMAILS.includes((email ?? "").trim().toLowerCase())
}
