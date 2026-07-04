import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/magic-link
 * Genera un magic link de acceso para un cliente existente.
 * Body: { email: string }
 */
export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const caller = await requireInternal(jwt)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = String(body.email ?? "").trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Email inválido" }, { status: 400 })

  const supabase = createServiceClient()

  // Verificar existencia via una query directa a auth.users (service_role tiene
  // acceso al schema auth). Reemplaza el listUsers() O(n) anterior que cargaba
  // todos los usuarios para hacer un .find() lineal.
  const { data: authUser, error: lookupErr } = await (supabase as any)
    .schema("auth")
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (lookupErr) {
    console.error("[magic-link] auth.users lookup error:", lookupErr.message)
    // Si el schema query falla (versión del cliente sin soporte), fallback a
    // verificar el link directamente (ver más abajo)
  } else if (!authUser) {
    return NextResponse.json({ error: "No existe ningún usuario con ese email" }, { status: 404 })
  }

  // Generar magic link
  try {
    const { data: link, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://smartscale.space"}/dashboard`,
      },
    })

    if (error) {
      // Si llegamos acá sin haber podido verificar via schema auth, detectar
      // "user not found" del error de generateLink como fallback de existencia
      const isNotFound = /not found|no user|does not exist/i.test(error.message)
      if (isNotFound) {
        return NextResponse.json({ error: "No existe ningún usuario con ese email" }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const magicLink = (link as any)?.properties?.action_link ?? null
    if (!magicLink) return NextResponse.json({ error: "No se pudo generar el link" }, { status: 500 })

    return NextResponse.json({ magicLink })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
