import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin, isInternal } from "@/lib/auth/permissions"

/**
 * Server-side guards para route handlers `/api/admin/*`.
 *
 * Uso:
 *   const user = await requireAdmin(jwt)        // solo admin (datos sensibles)
 *   const user = await requireInternal(jwt)     // admin OR team (datos no sensibles)
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
