import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isInternal } from "@/lib/auth/permissions"

/**
 * Resuelve el usuario autenticado y el client_id sobre el que opera, a partir
 * del JWT (header Authorization). Mismo patrón que content-research/transcript:
 *  - Staff interno (admin/developer/team): puede pasar ?client_id (el cliente
 *    activo del header). Si no, usa el suyo.
 *  - Cliente/setter: solo su propio client_id.
 */
export type SocialScope =
  | { ok: true; userId: string; clientId: string; role: string }
  | { ok: false; status: number; error: string }

export async function resolveSocialScope(
  req: NextRequest,
  requestedClientId?: string | null,
): Promise<SocialScope> {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  if (!jwt) return { ok: false, status: 401, error: "Unauthorized" }

  const sb = createServiceClient()
  const { data: { user }, error } = await sb.auth.getUser(jwt)
  if (error || !user) return { ok: false, status: 401, error: "Unauthorized" }

  const { data: prof } = await sb
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .maybeSingle()

  const role = String((prof as any)?.role ?? "").toLowerCase()
  const ownClientId = (prof as any)?.client_id ?? null

  if (isInternal(role)) {
    const clientId = requestedClientId ?? ownClientId
    if (!clientId) return { ok: false, status: 400, error: "Falta client_id" }
    return { ok: true, userId: user.id, clientId, role }
  }

  if (!ownClientId) return { ok: false, status: 403, error: "Forbidden" }
  if (requestedClientId && requestedClientId !== ownClientId) {
    return { ok: false, status: 403, error: "Forbidden" }
  }
  return { ok: true, userId: user.id, clientId: ownClientId, role }
}
