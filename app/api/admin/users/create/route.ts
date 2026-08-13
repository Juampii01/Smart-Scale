import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"
import { isPlatformOwnerEmail } from "@/lib/auth/platform-owner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/users/create
 *
 * Body: { email: string, password?: string, role: "admin"|"team"|"setter"|"client", name?: string, client_id?: string, internal_tenant_id?: string }
 *
 * Crea un user en auth.users (con email_confirm=true para que pueda loguearse directo)
 * y guarda profiles.role + profiles.name. Solo accesible para admins.
 *
 * Para role='client' se puede pasar client_id (uuid de la tabla `clients` —
 * la del portal, no `crm_clients`). El FK profiles.client_id apunta a clients.
 * Si no se pasa, queda null y el admin lo vincula después.
 *
 * Para roles internos (admin/developer/team/setter), internal_tenant_id
 * decide a qué sector interno pertenece (Leads/Setting/Prospección). Regla
 * de seguridad: un admin scoped a un tenant NUNCA puede elegir uno distinto
 * al suyo — solo el platform owner elige explícitamente. Cualquier otro
 * admin/team hereda en silencio el tenant del creador; si el body trae un
 * internal_tenant_id que no coincide, se rechaza (señal de manipulación de
 * payload, no de bug de UI).
 *
 * Si no se da password, se genera una temporal y se devuelve en la respuesta para que
 * el admin se la comparta al usuario.
 */

const VALID_ROLES = new Set(["admin", "developer", "team", "setter", "client"])
const INTERNAL_ROLES = new Set(["admin", "developer", "team", "setter"])

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

    // ── Resolver internal_tenant_id para roles internos, ANTES de crear
    // nada — si esto falla, no queremos auth users huérfanos.
    let internalTenantId: string | null = null
    if (INTERNAL_ROLES.has(role)) {
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("internal_tenant_id")
        .eq("id", admin.id)
        .maybeSingle()

      const callerTenantId = (callerProfile as any)?.internal_tenant_id ?? null
      const requestedTenantId = body.internal_tenant_id ? String(body.internal_tenant_id).trim() : null

      if (isPlatformOwnerEmail(admin.email)) {
        // El platform owner tiene que elegir explícito — sin default seguro
        // (si viene de una sesión "Ver Clientes" activa, asumir Smart Scale
        // por omisión podría dar de alta en el tenant equivocado).
        if (!requestedTenantId) {
          return NextResponse.json({ error: "internal_tenant_id es requerido (elegí el sector: Smart Scale u otro cliente)" }, { status: 400 })
        }
        const { data: tenantRow } = await supabase.from("clients").select("id").eq("id", requestedTenantId).maybeSingle()
        if (!tenantRow) return NextResponse.json({ error: "internal_tenant_id inválido" }, { status: 400 })
        internalTenantId = requestedTenantId
      } else {
        if (!callerTenantId) {
          return NextResponse.json({ error: "Tu cuenta no tiene un sector interno asignado. Contactá al dueño de la plataforma." }, { status: 400 })
        }
        if (requestedTenantId && requestedTenantId !== callerTenantId) {
          return NextResponse.json({ error: "No podés crear usuarios en un sector distinto al tuyo" }, { status: 403 })
        }
        internalTenantId = callerTenantId
      }
    }

    // ── Bridge: si el clientId existe en crm_clients pero NO en clients (la
    // tabla del portal), copiamos el row antes de crear el auth user. El FK
    // profiles.client_id apunta a clients, así que sin esto el upsert falla.
    // Este bridge es seguro de correr ANTES de crear el auth user — si falla,
    // no dejamos orfandad en auth.users.
    if (role === "client" && clientId) {
      const { data: portalClient } = await supabase
        .from("clients")
        .select("id, nombre")
        .eq("id", clientId)
        .maybeSingle()

      if (!portalClient) {
        const { data: crmClient } = await supabase
          .from("crm_clients")
          .select("name")
          .eq("id", clientId)
          .maybeSingle()

        if (!crmClient) {
          return NextResponse.json(
            { error: "El client_id no existe ni en `clients` ni en `crm_clients`." },
            { status: 400 },
          )
        }

        const crmName = String((crmClient as any).name ?? "").trim() || "Sin nombre"
        const { error: bridgeErr } = await supabase
          .from("clients")
          .insert({ id: clientId, name: crmName, nombre: crmName })

        if (bridgeErr) {
          return NextResponse.json(
            { error: `No se pudo crear el row en \`clients\`: ${bridgeErr.message}` },
            { status: 500 },
          )
        }
      } else if (!portalClient.nombre) {
        // Portal client exists but nombre is null — backfill from crm_clients
        const { data: crmClient } = await supabase
          .from("crm_clients")
          .select("name")
          .eq("id", clientId)
          .maybeSingle()

        const crmName = String((crmClient as any)?.name ?? "").trim()
        if (crmName) {
          await supabase.from("clients").update({ nombre: crmName }).eq("id", clientId)
        }
      }
    }

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
      .upsert({ id: userId, role, name, client_id: clientId, internal_tenant_id: internalTenantId }, { onConflict: "id" })

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
