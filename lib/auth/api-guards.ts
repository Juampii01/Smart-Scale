import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin, isInternal, isStaffFinanciero } from "@/lib/auth/permissions"
import { isOmniOwnerEmail } from "@/lib/omni/owner"
import { isPlatformOwnerEmail } from "@/lib/auth/platform-owner"
import { getSmartScaleTenantId } from "@/lib/auth/internal-scope"

/**
 * Server-side guards para route handlers `/api/admin/*`.
 *
 * Uso:
 *   const user = await requireAdmin(jwt)         // solo admin (datos sensibles)
 *   const user = await requireInternal(jwt)      // admin OR team OR setter (datos no sensibles)
 *   const user = await requireStaffFinanciero(jwt) // admin OR team, NO setter (facturación)
 *   const user = await requireOmniOwner(jwt)     // solo dueño del proyecto + Ann (piloto Omni)
 *   const user = await requirePlatformOwner(jwt) // solo dueño de la plataforma (sector interno "Ver Clientes")
 *   const user = await requireSmartScaleInternal(jwt) // admin, y del sector de Smart Scale (o platform owner)
 *   const user = await requireSmartScaleStaff(jwt)    // admin/team/setter, y del sector de Smart Scale (o platform owner)
 *   if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
 */

async function getProfile(jwt: string | null) {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  return { user, role: (profile as any)?.role ?? null }
}

async function getProfileWithTenant(jwt: string | null) {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, internal_tenant_id")
    .eq("id", user.id)
    .maybeSingle()
  return {
    user,
    role: (profile as any)?.role ?? null,
    internalTenantId: (profile as any)?.internal_tenant_id ?? null,
    supabase,
  }
}

/**
 * Restringe una pantalla founder-only (Payments, Executive Dashboard, Ann
 * Knowledge, Clientes, Contratación, POSI, MRR, Push, Agenda, Conexiones,
 * Actividad, Founder Checkins/Survey) al sector interno de Smart Scale —
 * ninguna de estas pantallas debería ser alcanzable por el admin/team de un
 * cliente con su propio sector interno, aunque `role='admin'` los deje pasar
 * el chequeo de rol. Antes de esto, `requireAdmin` solo & exclusivamente
 * miraba el rol, nunca el tenant — el día que un cliente tenga su propio
 * admin interno (sector multi-tenant, Fase 0), ese admin podía pegar la URL
 * a mano y ver la facturación completa de Smart Scale y de todos sus otros
 * clientes. El platform owner sigue teniendo bypass total, igual que en
 * resolveInternalScope.
 */
export async function requireSmartScaleInternal(jwt: string | null) {
  const ctx = await getProfileWithTenant(jwt)
  if (!ctx || !isAdmin(ctx.role)) return null
  if (isPlatformOwnerEmail(ctx.user.email)) return ctx.user
  if (!ctx.internalTenantId) return null
  const smartScaleTenantId = await getSmartScaleTenantId(ctx.supabase)
  if (!smartScaleTenantId || ctx.internalTenantId !== smartScaleTenantId) return null
  return ctx.user
}

/** Como requireSmartScaleInternal, pero admin/team/setter en vez de solo admin. */
export async function requireSmartScaleStaff(jwt: string | null) {
  const ctx = await getProfileWithTenant(jwt)
  if (!ctx || !isInternal(ctx.role)) return null
  if (isPlatformOwnerEmail(ctx.user.email)) return ctx.user
  if (!ctx.internalTenantId) return null
  const smartScaleTenantId = await getSmartScaleTenantId(ctx.supabase)
  if (!smartScaleTenantId || ctx.internalTenantId !== smartScaleTenantId) return null
  return ctx.user
}

export async function requireAdmin(jwt: string | null) {
  const ctx = await getProfile(jwt)
  if (!ctx || !isAdmin(ctx.role)) return null
  return ctx.user
}

export async function requireInternal(jwt: string | null) {
  const ctx = await getProfile(jwt)
  if (!ctx || !isInternal(ctx.role)) return null
  return ctx.user
}

export async function requireStaffFinanciero(jwt: string | null) {
  const ctx = await getProfile(jwt)
  if (!ctx || !isStaffFinanciero(ctx.role)) return null
  return ctx.user
}

/** No chequea rol — chequea identidad exacta (allowlist de OMNI_ALLOWED_EMAILS). */
export async function requireOmniOwner(jwt: string | null) {
  const ctx = await getProfile(jwt)
  if (!ctx || !isOmniOwnerEmail(ctx.user.email)) return null
  return ctx.user
}

/** No chequea rol — chequea identidad exacta (allowlist de PLATFORM_OWNER_EMAILS). */
export async function requirePlatformOwner(jwt: string | null) {
  const ctx = await getProfile(jwt)
  if (!ctx || !isPlatformOwnerEmail(ctx.user.email)) return null
  return ctx.user
}
