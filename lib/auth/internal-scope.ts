import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isInternal } from "@/lib/auth/permissions"
import { isPlatformOwnerEmail } from "@/lib/auth/platform-owner"

/**
 * Resuelve el usuario interno (admin/team/setter) autenticado y el tenant
 * (internal_tenant_id) del sector interno sobre el que opera — Leads/Setting/
 * Prospección. Mismo patrón que resolveSocialScope (lib/social/scope.ts), pero
 * con una diferencia deliberada: acá SOLO el platform owner puede pasar un
 * tenant distinto al propio ("Ver Clientes"). Cualquier otro interno
 * (admin/team/setter de un cliente) siempre opera sobre su propio tenant,
 * sin excepción — es el requisito de aislamiento central de este feature.
 */
export type InternalScope =
  | { ok: true; userId: string; tenantId: string; role: string; isPlatformOwner: boolean }
  | { ok: false; status: number; error: string }

export async function resolveInternalScope(
  req: NextRequest,
  requestedTenantId?: string | null,
): Promise<InternalScope> {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  if (!jwt) return { ok: false, status: 401, error: "Unauthorized" }

  const sb = createServiceClient()
  const { data: { user }, error } = await sb.auth.getUser(jwt)
  if (error || !user) return { ok: false, status: 401, error: "Unauthorized" }

  const { data: prof } = await sb
    .from("profiles")
    .select("role, internal_tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  const role = String((prof as any)?.role ?? "").toLowerCase()
  if (!isInternal(role)) return { ok: false, status: 403, error: "Forbidden" }

  const ownTenantId = (prof as any)?.internal_tenant_id ?? null
  const isPlatformOwner = isPlatformOwnerEmail(user.email)

  if (isPlatformOwner && requestedTenantId) {
    return { ok: true, userId: user.id, tenantId: requestedTenantId, role, isPlatformOwner: true }
  }

  if (!ownTenantId) return { ok: false, status: 400, error: "Tu cuenta no tiene un sector interno asignado" }
  return { ok: true, userId: user.id, tenantId: ownTenantId, role, isPlatformOwner }
}
