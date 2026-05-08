import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/users/create
 *
 * Body: { email: string, password?: string, role: "admin"|"team"|"setter"|"client", name?: string, client_id?: string }
 *
 * Crea un user en auth.users (con email_confirm=true para que pueda loguearse directo)
 * y guarda profiles.role + profiles.name. Solo accesible para admins.
 *
 * Para role='client' se puede pasar client_id (uuid de crm_clients) para asociarlo
 * inmediatamente. Si no se pasa, queda null y el admin lo vincula después desde
 * /admin/clients.
 *
 * Si no se da password, se genera una temporal y se devuelve en la respuesta para que
 * el admin se la comparta al usuario.
 */

const VALID_ROLES = new Set(["admin", "team", "setter", "client"])

function generateTempPassword(length = 14): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length]
  return out
}

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const admin = await requireAdmin(jwt)
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const email = String(body.email ?? "").trim().toLowerCase()
    const role  = String(body.role  ?? "").trim().toLowerCase()
    const name  = body.name ? String(body.name).trim() : null
    const passwordInput = body.password ? String(body.password) : null
    const clientId = body.client_id ? String(body.client_id).trim() : null

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 })
    }
    if (!VALID_ROLES.has(role)) {
      return NextResponse.json({ error: `Rol inválido. Opciones: ${[...VALID_ROLES].join(", ")}` }, { status: 400 })
    }
    if (passwordInput && passwordInput.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })
    }

    const password = passwordInput ?? generateTempPassword()
    const generated = !passwordInput

    const supabase = createServiceClient()

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, name },
      app_metadata: { role },
    })
    if (createErr || !created?.user) {
      return NextResponse.json({ error: createErr?.message ?? "No se pudo crear el usuario" }, { status: 500 })
    }

    const userId = created.user.id

    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({ id: userId, role, name, client_id: clientId }, { onConflict: "id" })

    if (profileErr) {
      // Rollback: si el profile falla, borramos el auth user para no dejar orfandad
      await supabase.auth.admin.deleteUser(userId).catch(() => {})

      // Mensaje friendly para el caso típico: client_id NOT NULL constraint
      const isClientIdNotNull = /client_id.+not[-_ ]null/i.test(profileErr.message)
      const friendly = isClientIdNotNull
        ? "La tabla profiles requiere client_id NOT NULL, pero los usuarios internos no tienen cliente asociado. Correr en Supabase: ALTER TABLE profiles ALTER COLUMN client_id DROP NOT NULL;"
        : `Auth creado pero falló profile: ${profileErr.message}`
      return NextResponse.json({ error: friendly }, { status: 500 })
    }

    return NextResponse.json({
      user: { id: userId, email, role, name },
      tempPassword: generated ? password : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
