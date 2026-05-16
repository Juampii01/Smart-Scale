import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { notifyClientOnboarded } from "@/lib/slack"
import { sendWelcomeEmail } from "@/lib/email"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/onboarding
 *
 * Crea un cliente nuevo en el flujo de onboarding completo:
 *  1. Crea row en `crm_clients` (CRM de ventas)
 *  2. Crea row en `clients` (portal — necesario para el FK de profiles)
 *  3. Crea cuenta en auth.users + profiles (role=client)
 *
 * Body:
 *   name          string   — nombre del cliente (requerido)
 *   email         string   — email para la cuenta del dashboard (requerido)
 *   instagram     string?  — handle de Instagram
 *   phone         string?  — teléfono
 *   program       string?  — nombre del programa / plan
 *   installment_amount  number? — monto por cuota
 *   num_installments    number? — número de cuotas
 *   program_start date?   — fecha de inicio (YYYY-MM-DD)
 *   setter_id     string? — uuid del setter que cerró
 *   password      string? — si no se pasa, se genera una temporal
 *
 * Solo accesible por admin, team y setter.
 */

function generateTempPassword(length = 14): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, v => chars[v % chars.length]).join("")
}

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const caller = await requireInternal(jwt)
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const name     = String(body.name  ?? "").trim()
    const email    = String(body.email ?? "").trim().toLowerCase()
    const instagram       = body.instagram ? String(body.instagram).trim() : null
    const phone           = body.phone     ? String(body.phone).trim()    : null
    const program         = body.program   ? String(body.program).trim()  : null
    const installmentAmt  = body.installment_amount  != null ? Number(body.installment_amount)  : 0
    const numInstallments = body.num_installments    != null ? Number(body.num_installments)    : 1
    const programStart    = body.program_start       ? String(body.program_start)               : new Date().toISOString().slice(0, 10)
    const setterId        = body.setter_id           ? String(body.setter_id)                   : null
    const passwordInput   = body.password            ? String(body.password)                    : null

    if (!name)  return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "Email inválido" }, { status: 400 })
    if (passwordInput && passwordInput.length < 8)
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })

    const password  = passwordInput ?? generateTempPassword()
    const generated = !passwordInput
    const supabase  = createServiceClient()

    // ── 1. Crear en crm_clients ────────────────────────────────────────────
    const { data: crmClient, error: crmErr } = await supabase
      .from("crm_clients")
      .insert({
        name,
        email,
        instagram,
        phone,
        program_start:      programStart,
        installment_amount: installmentAmt,
        num_installments:   numInstallments,
        status:             "activo",
        notes:              program ? `Programa: ${program}` : null,
        ...(setterId ? { setter_id: setterId } : {}),
      })
      .select("id")
      .single()

    if (crmErr || !crmClient)
      return NextResponse.json({ error: `Error en crm_clients: ${crmErr?.message}` }, { status: 500 })

    const clientId = crmClient.id

    // ── 2. Crear en clients (portal) — necesario para FK profiles.client_id ──
    const { error: portalErr } = await supabase
      .from("clients")
      .insert({ id: clientId, name })

    if (portalErr)
      return NextResponse.json({ error: `Error en clients (portal): ${portalErr.message}` }, { status: 500 })

    // ── 3. Crear cuenta auth + profile ────────────────────────────────────
    const { data: created, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "client", name },
      app_metadata:  { role: "client" },
    })

    if (authErr || !created?.user) {
      // Rollback crm_clients y clients (best-effort)
      try { await supabase.from("clients").delete().eq("id", clientId) } catch {}
      try { await supabase.from("crm_clients").delete().eq("id", clientId) } catch {}
      return NextResponse.json({ error: authErr?.message ?? "Error al crear la cuenta" }, { status: 500 })
    }

    const userId = created.user.id

    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({ id: userId, role: "client", name, client_id: clientId }, { onConflict: "id" })

    if (profileErr) {
      // Rollback completo (best-effort)
      try { await supabase.auth.admin.deleteUser(userId) } catch {}
      try { await supabase.from("clients").delete().eq("id", clientId) } catch {}
      try { await supabase.from("crm_clients").delete().eq("id", clientId) } catch {}
      return NextResponse.json({ error: `Error en profiles: ${profileErr.message}` }, { status: 500 })
    }

    // ── 4. Obtener nombre del setter (best-effort) ────────────────────────
    let setterName: string | null = null
    if (setterId) {
      const { data: setter } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", setterId)
        .maybeSingle()
      setterName = (setter as any)?.name ?? null
    }

    // ── 5. Generar magic link de primer acceso ────────────────────────────
    // One-time link que el cliente usa para entrar sin contraseña.
    // Expira en 24hs por defecto (configurable en Supabase Auth settings).
    let magicLink: string | null = null
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ""
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type:       "magiclink",
        email,
        options: {
          redirectTo: `${siteUrl}/dashboard`,
        },
      })
      if (!linkErr && linkData?.properties?.action_link) {
        magicLink = linkData.properties.action_link
      }
    } catch {}

    // ── 6. Email de bienvenida con magic link (fire-and-forget) ──────────
    if (magicLink) {
      sendWelcomeEmail({
        name,
        email,
        magic_link:  magicLink,
        program,
        setter_name: setterName,
      }).catch(() => {/* no bloquear si Resend falla */})
    }

    // ── 7. Crear canal Slack + notificar (fire-and-forget) ────────────────
    notifyClientOnboarded({
      client_id:          clientId,
      name,
      email,
      instagram,
      phone,
      program,
      installment_amount: installmentAmt,
      num_installments:   numInstallments,
      program_start:      programStart,
      setter_name:        setterName,
      temp_password:      generated ? password : null,
      magic_link:         magicLink ?? undefined,
    }).catch(() => {/* no bloquear si Slack falla */})

    return NextResponse.json({
      ok: true,
      client: { id: clientId, name, email },
      user:   { id: userId, email },
      tempPassword: generated ? password : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/**
 * GET /api/admin/onboarding
 * Lista los clientes onboarding recientes (últimos 50 de crm_clients, más nuevos primero).
 */
export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const caller = await requireInternal(jwt)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("crm_clients")
    .select("id, name, email, instagram, phone, program_start, installment_amount, num_installments, status, notes, created_at, setter_id")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clients: data ?? [] })
}
