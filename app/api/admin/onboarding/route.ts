import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { notifyClientOnboarded } from "@/lib/slack"
import { sendWelcomeEmail, sendCredentialsToAdmin } from "@/lib/email"
import { createGHLContact, parseFullName, formatPhoneForGHL } from "@/lib/ghl"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALBERTO_CLIENT_ID = "09314097-df56-450f-980e-38ec1e61f246"

/**
 * POST /api/admin/onboarding
 *
 * Crea un cliente nuevo en el flujo de onboarding completo:
 *  1. Valida todos los campos (email duplicado, formatos, fechas, etc)
 *  2. Auto-asigna setter_id si el caller es un setter
 *  3. Crea row en `crm_clients` (CRM de ventas)
 *  4. Crea installments individuales para cada cuota
 *  5. Crea row en `clients` (portal — necesario para el FK de profiles)
 *  6. Crea cuenta en auth.users + profiles (role=client)
 *  7. Copia playbook template de Alberto
 *  8. Genera magic link + contraseña
 *  9. Notifica vía Slack + email
 *
 * Body:
 *   name          string   — nombre del cliente (requerido)
 *   email         string   — email para la cuenta del dashboard (requerido, único)
 *   instagram     string?  — handle de Instagram (formato: @handle)
 *   phone         string?  — teléfono (formato válido)
 *   program       string?  — nombre del programa / plan
 *   total_amount  number?  — monto total del programa (> 0)
 *   cuotas        object?  — { cuota_1, cuota_2, ... cuota_6 } con montos de cada cuota
 *   program_start date?   — fecha de inicio (YYYY-MM-DD, no pasada)
 *   forma_pago    string?  — descripción de formato de pago (transferencia, tarjeta, etc)
 *   setter_id     string? — uuid del setter que cerró (auto-asignado si caller es setter)
 *
 * Respuesta:
 *   client: { id, name, email }
 *   user: { id, email }
 *   tempPassword: string (temp password)
 *   magicLink: string (one-time login link, 24h)
 *
 * Solo accesible por admin, team y setter.
 */

function generateTempPassword(length = 14): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, v => chars[v % chars.length]).join("")
}

async function getCallerRole(supabase: any, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  return (profile as any)?.role ?? null
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()

  try {
    // ── Auth check ─────────────────────────────────────────────────────────
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const caller = await requireInternal(jwt)
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // ── Parse + normalize input ────────────────────────────────────────────
    const name     = String(body.name  ?? "").trim()
    const email    = String(body.email ?? "").trim().toLowerCase()
    const instagram       = body.instagram ? String(body.instagram).trim() : null
    const phone           = body.phone     ? String(body.phone).trim()    : null
    const program         = body.program   ? String(body.program).trim()  : null
    const totalAmount     = body.total_amount != null ? Number(body.total_amount) : 0
    const cuotas          = body.cuotas ?? {}
    const programStart    = body.program_start       ? String(body.program_start)               : new Date().toISOString().slice(0, 10)
    const requestedSetterId = body.setter_id           ? String(body.setter_id)                   : null
    const formaPago       = body.forma_pago          ? String(body.forma_pago).trim()           : null
    const programDuration = body.program_duration != null ? Math.max(1, Math.min(24, Number(body.program_duration))) : null

    // ── 1. Enhanced validations ────────────────────────────────────────────
    // Name required
    if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })

    // Program required — sin programa no se dispara el contrato downstream
    if (!program) return NextResponse.json({ error: "El programa es requerido" }, { status: 400 })

    // Email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "Email inválido" }, { status: 400 })

    // Email duplicado check
    const { data: existingEmail } = await supabase
      .from("crm_clients")
      .select("id")
      .eq("email", email)
      .maybeSingle()
    if (existingEmail)
      return NextResponse.json({ error: "Este email ya está registrado" }, { status: 400 })

    // Instagram format (if provided)
    if (instagram && !instagram.startsWith("@"))
      return NextResponse.json({ error: "Instagram debe incluir @ (ej: @handle)" }, { status: 400 })

    // Phone format (if provided) — basic validation: 7+ digits
    if (phone && !/\d{7,}/.test(phone.replace(/\D/g, "")))
      return NextResponse.json({ error: "Teléfono debe tener al menos 7 dígitos" }, { status: 400 })

    // Total amount validation
    if (totalAmount < 0)
      return NextResponse.json({ error: "El monto total debe ser ≥ 0" }, { status: 400 })

    // Cuotas validation (all must be positive numbers)
    for (const [cuotaName, cuotaValue] of Object.entries(cuotas)) {
      if (cuotaValue != null) {
        const val = Number(cuotaValue)
        if (!Number.isFinite(val) || val <= 0)
          return NextResponse.json({ error: `${cuotaName} debe ser un monto positivo` }, { status: 400 })
      }
    }

    // program_start not in past
    const today = new Date().toISOString().slice(0, 10)
    if (programStart < today)
      return NextResponse.json({ error: "La fecha de inicio no puede ser en el pasado" }, { status: 400 })

    // setter_id validation (if provided)
    let finalSetterId: string | null = requestedSetterId
    if (requestedSetterId) {
      const { data: setterProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", requestedSetterId)
        .eq("role", "setter")
        .maybeSingle()
      if (!setterProfile)
        return NextResponse.json({ error: "El setter_id no es válido" }, { status: 400 })
    }

    // ── 2. Auto-assign setter_id if caller is a setter ─────────────────────
    if (!finalSetterId) {
      const callerRole = await getCallerRole(supabase, caller.id)
      if (callerRole === "setter") {
        finalSetterId = caller.id
      }
    }

    // ── 3. Generate credentials ────────────────────────────────────────────
    const tempPassword = generateTempPassword()
    const numInstallments = Object.values(cuotas).filter(v => v != null).length || 1

    // ── 4. Create in crm_clients ───────────────────────────────────────────
    const notesLines: string[] = []
    if (program) notesLines.push(`Programa: ${program}`)
    const cuotasWithValues = Object.entries(cuotas).filter(([_, v]) => v != null)
    if (cuotasWithValues.length > 0) {
      notesLines.push(`Cuotas: ${cuotasWithValues.map(([k, v]) => `${k}=$${v}`).join(", ")}`)
    }

    // Per-installment amount: use first cuota value if available, else divide total
    const perInstallmentAmount = cuotasWithValues.length > 0
      ? Number(cuotasWithValues[0][1])
      : (numInstallments > 0 ? totalAmount / numInstallments : totalAmount)

    const { data: crmClient, error: crmErr } = await supabase
      .from("crm_clients")
      .insert({
        name,
        email,
        instagram,
        phone,
        programa:           program,
        program_start:      programStart,
        installment_amount: perInstallmentAmount,
        num_installments:   numInstallments,
        program_duration:   programDuration ?? numInstallments,
        total_amount:       totalAmount,
        status:             "activo",
        notes:              notesLines.join(" | ") || null,
        forma_pago:         formaPago,
        ...(finalSetterId ? { setter_id: finalSetterId } : {}),
      })
      .select("id")
      .single()

    if (crmErr || !crmClient) {
      return NextResponse.json({ error: `Error al crear cliente: ${crmErr?.message}` }, { status: 500 })
    }

    const clientId = crmClient.id

    // ── 5. Create individual installments ──────────────────────────────────
    // Fallback para pago único: si no se llenaron cuotas pero hay total_amount
    if (cuotasWithValues.length === 0 && totalAmount > 0) {
      cuotasWithValues.push(["cuota_1", totalAmount])
    }

    if (cuotasWithValues.length > 0) {
      // Generate sequential monthly due dates starting from program_start
      function addMonthsToDate(dateStr: string, months: number): string {
        const d = new Date(dateStr + "T12:00:00Z")
        d.setUTCMonth(d.getUTCMonth() + months)
        return d.toISOString().slice(0, 10)
      }
      const nowIso = new Date().toISOString()
      const installmentsToInsert = cuotasWithValues.map(([cuotaName, amount], idx) => ({
        client_id:          clientId,
        installment_number: idx + 1,
        due_date:           addMonthsToDate(programStart, idx), // cuota 1 = start, cuota 2 = start+1m, etc.
        amount:             Number(amount),
        paid_at:            idx === 0 ? nowIso : null,           // primera cuota marcada como pagada
      }))

      const { error: instErr } = await supabase
        .from("crm_installments")
        .insert(installmentsToInsert)

      if (instErr) {
        // Rollback crm_clients
        try { await supabase.from("crm_clients").delete().eq("id", clientId) } catch {}
        return NextResponse.json({ error: `Error al crear cuotas: ${instErr.message}` }, { status: 500 })
      }
    }

    // ── 6. Create in clients (portal) ──────────────────────────────────────
    const { error: portalErr } = await supabase
      .from("clients")
      .insert({ id: clientId, name })

    if (portalErr) {
      try { await supabase.from("crm_installments").delete().eq("client_id", clientId) } catch {}
      try { await supabase.from("crm_clients").delete().eq("id", clientId) } catch {}
      return NextResponse.json({ error: `Error en portal: ${portalErr.message}` }, { status: 500 })
    }

    // ── 7. Create auth user + profile ──────────────────────────────────────
    const { data: created, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: "client", name },
      app_metadata:  { role: "client" },
    })

    if (authErr || !created?.user) {
      // Rollback all (best-effort)
      try { await supabase.from("clients").delete().eq("id", clientId) } catch {}
      try { await supabase.from("crm_installments").delete().eq("client_id", clientId) } catch {}
      try { await supabase.from("crm_clients").delete().eq("id", clientId) } catch {}
      return NextResponse.json({ error: authErr?.message ?? "Error al crear la cuenta" }, { status: 500 })
    }

    const userId = created.user.id

    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({ id: userId, role: "client", name, client_id: clientId }, { onConflict: "id" })

    if (profileErr) {
      // Rollback all (best-effort)
      try { await supabase.auth.admin.deleteUser(userId) } catch {}
      try { await supabase.from("clients").delete().eq("id", clientId) } catch {}
      try { await supabase.from("crm_installments").delete().eq("client_id", clientId) } catch {}
      try { await supabase.from("crm_clients").delete().eq("id", clientId) } catch {}
      return NextResponse.json({ error: `Error en profiles: ${profileErr.message}` }, { status: 500 })
    }

    // ── 8. Generate magic link ────────────────────────────────────────────
    let magicLink: string | null = null
    try {
      const { data: link } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dashboard`
        }
      })
      magicLink = (link as any)?.properties?.action_link ?? null
    } catch (err) {
      // Magic link generation failed, but don't rollback — continue with temp password
      console.error("Magic link generation failed:", err)
    }

    // ── 9. Copy Alberto's playbook template ────────────────────────────────
    try {
      const { data: albertoPlaybook } = await supabase
        .from("client_playbook_main")
        .select("*")
        .eq("client_id", ALBERTO_CLIENT_ID)
        .maybeSingle()

      if (albertoPlaybook) {
        const { error: pbErr } = await supabase
          .from("client_playbook_main")
          .insert({
            client_id: clientId,
            title: (albertoPlaybook as any).title,
            content: (albertoPlaybook as any).content,
            visible_to_client: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

        if (pbErr) {
          console.error("Playbook copy failed:", pbErr)
          // Don't rollback — playbook is optional for onboarding success
        }
      }
    } catch (err) {
      console.error("Playbook lookup failed:", err)
      // Don't rollback — playbook is optional
    }

    // ── 10. Get setter name (best-effort) ──────────────────────────────────
    let setterName: string | null = null
    if (finalSetterId) {
      const { data: setter } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", finalSetterId)
        .maybeSingle()
      setterName = (setter as any)?.name ?? null
    }

    // ── 11. Create contact in GHL (fire-and-forget) ────────────────────────
    const { firstName, lastName } = parseFullName(name)
    createGHLContact({
      firstName,
      lastName,
      email,
      phone: formatPhoneForGHL(phone),
      source: "Smart Scale",
      // customFields omitted — GHL v2 requires field IDs from the account
      tags: ["smart-scale", "onboarded"],
    }).catch(err => {
      console.error("GHL sync failed (non-blocking):", err)
    })

    // ── 12. Send credentials to admin (fire-and-forget) ────────────────────
    if (caller && (caller as any).email) {
      sendCredentialsToAdmin({
        admin_email:   (caller as any).email,
        client_name:   name,
        client_email:  email,
        temp_password: tempPassword,
        program,
      }).catch(() => {/* no bloquear si Resend falla */})
    }

    // ── 13. Slack notification (fire-and-forget) ───────────────────────────
    // Para pago único: si no se llenaron cuotas individuales pero hay total_amount,
    // construir cuotas con cuota_1 = total_amount para que el contrato tenga datos
    const cuotasForSlack = cuotasWithValues.length > 0
      ? cuotas
      : (totalAmount > 0 ? { cuota_1: totalAmount } : cuotas)

    notifyClientOnboarded({
      client_id:     clientId,
      name,
      email,
      instagram,
      phone,
      program,
      total_amount:  totalAmount,
      cuotas:        cuotasForSlack,
      program_start: programStart,
      setter_name:   setterName,
      temp_password: tempPassword,
      magic_link:    magicLink ?? undefined,
    }).then(result => {
      if (!result.ok) console.error("Slack notification failed:", result.error)
      else console.log("Slack notification sent, channel:", result.channel_id)
    }).catch(err => console.error("Slack notification error:", err?.message))

    // ── Success response ────────────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      client: { id: clientId, name, email },
      user:   { id: userId, email },
      tempPassword,
      magicLink,
    })
  } catch (err: any) {
    console.error("Onboarding error:", err)
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
