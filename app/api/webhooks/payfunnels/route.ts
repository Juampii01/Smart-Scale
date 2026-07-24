/**
 * POST /api/webhooks/payfunnels
 *
 * Recibe la notificación de pago completado de PayFunnels y dispara el
 * onboarding automático completo — misma secuencia que el alta manual en
 * app/api/admin/onboarding/route.ts (crm_clients, onboarding_flow,
 * crm_installments, cuenta del dashboard, contrato por SignNow).
 *
 * PayFunnels no manda un identificador de producto/plan en el webhook, así
 * que el plan pagado se infiere por el monto exacto cobrado — los 4 links de
 * pago vigentes tienen montos distintos entre sí:
 *   Grupal 1 pago $3.000 · Grupal 2 cuotas $1.750 c/u
 *   Híbrido 1 pago $6.500 · Híbrido 2 cuotas $3.500 c/u
 * Si el monto no matchea ninguno (ej. cambió un precio en PayFunnels sin
 * avisar acá), el pago se loguea igual y se avisa por Slack — no se crea un
 * cliente a medias.
 *
 * Auth: PayFunnels solo permite una URL de callback global sin headers
 * custom, así que el secreto va en la query string (?secret=...), con
 * fallback a header por si acaso — mismo patrón que
 * app/api/webhooks/recording/route.ts.
 */
import { NextRequest, NextResponse, after } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { sendContractForSignature } from "@/lib/signnow"
import { notifyClientOnboarded, sendSlackMessage } from "@/lib/slack"
import { zapierClientOnboarded } from "@/lib/zapier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALBERTO_CLIENT_ID = "09314097-df56-450f-980e-38ec1e61f246"

const PRICE_MAP: Record<number, { program: string; installments: number; totalAmount: number }> = {
  3000: { program: "Smart Scale Grupal",  installments: 1, totalAmount: 3000 },
  6500: { program: "Smart Scale Híbrido", installments: 1, totalAmount: 6500 },
  1750: { program: "Smart Scale Grupal",  installments: 2, totalAmount: 3500 },
  3500: { program: "Smart Scale Híbrido", installments: 2, totalAmount: 7000 },
}

// ─── Helpers (mismo patrón que app/api/webhooks/client/route.ts) ──────────────

function pick(obj: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    const v = obj?.[k] ?? obj?.[k.toLowerCase()] ?? obj?.[k.replace(/_/g, " ")]
    if (v !== undefined && v !== null && v !== "") return v
  }
  return null
}

// Distingue coma decimal ("1750,50") de coma de miles ("$6,500") mirando cuál
// separador aparece último y cuántos dígitos quedan después de la coma —
// necesario porque PayFunnels puede mandar el monto formateado como string.
function toNum(v: any): number | null {
  if (v == null) return null
  let s = String(v).trim().replace(/[^0-9.,-]/g, "")
  if (!s) return null
  const lastComma = s.lastIndexOf(",")
  const lastDot = s.lastIndexOf(".")
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1
    s = decimals === 2 ? s.replace(",", ".") : s.replace(/,/g, "")
  }
  const n = parseFloat(s)
  return Number.isNaN(n) ? null : n
}

function generateTempPassword(length = 14): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, v => chars[v % chars.length]).join("")
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T12:00:00Z")
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

function authorize(req: NextRequest): boolean {
  const secret = process.env.PAYFUNNELS_WEBHOOK_SECRET
  if (!secret) return false
  const incoming =
    req.nextUrl.searchParams.get("secret") ??
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    null
  return incoming === secret
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sb = createServiceClient()

  let body: Record<string, any>
  try {
    const ct = req.headers.get("content-type") ?? ""
    if (ct.includes("application/json")) {
      body = await req.json()
    } else {
      const text = await req.text()
      body = Object.fromEntries(new URLSearchParams(text))
    }
  } catch {
    body = {}
  }

  // Guardar el payload crudo SIEMPRE, antes de cualquier otra cosa — nunca
  // perder el pago aunque falle el resto del procesamiento.
  const { data: logRow } = await sb
    .from("payfunnels_webhook_events")
    .insert({ raw_payload: body })
    .select("id")
    .single()
  const logId = (logRow as any)?.id as string | undefined

  async function finish(matchedClient: string | null, error: string | null) {
    if (logId) {
      await sb.from("payfunnels_webhook_events")
        .update({ matched_client: matchedClient, processed_at: new Date().toISOString(), error })
        .eq("id", logId)
    }
  }

  try {
    const name  = String(pick(body, "name", "nombre", "full_name", "customer_name") ?? "").trim()
    const email = String(pick(body, "email", "customer_email") ?? "").trim().toLowerCase()
    const amount = toNum(pick(body, "amount", "monto", "total_charged", "amount_charged", "paid_amount"))

    if (!name || !email || amount == null) {
      const reason = `Faltan datos básicos (name=${!!name}, email=${!!email}, amount=${amount})`
      await finish(null, reason)
      await sendSlackMessage(
        [{ type: "section", text: { type: "mrkdwn", text: `⚠️ *Webhook de PayFunnels con datos incompletos*\n${reason}\nRevisar \`payfunnels_webhook_events\` (id: ${logId ?? "?"}).` } }],
        "⚠️ Webhook de PayFunnels con datos incompletos",
      ).catch(() => null)
      return NextResponse.json({ ok: true, warning: reason })
    }

    // ── Mapear el monto al plan correspondiente ─────────────────────────────
    const tier = PRICE_MAP[Math.round(amount)]
    if (!tier) {
      const reason = `Monto no reconocido: $${amount} (no matchea ninguno de los 4 planes vigentes)`
      await finish(null, reason)
      await sendSlackMessage(
        [{ type: "section", text: { type: "mrkdwn", text: `⚠️ *Pago de PayFunnels con monto no reconocido*\n*Cliente:* ${name} (${email})\n*Monto:* $${amount}\nNo matchea ninguno de los 4 planes — revisar y cargar a mano en /admin/onboarding.` } }],
        `⚠️ Pago de PayFunnels con monto no reconocido: $${amount} (${name})`,
      ).catch(() => null)
      return NextResponse.json({ ok: true, warning: reason })
    }

    // ── Dedup: ¿ya existe un cliente con este email? (reintento del webhook) ─
    const { data: existing } = await sb
      .from("crm_clients")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (existing) {
      await finish((existing as any).id, "Ya existía un crm_client con este email — pago duplicado o reintento, no se creó uno nuevo.")
      return NextResponse.json({ ok: true, client_id: (existing as any).id, duplicate: true })
    }

    // ── Crear cliente (misma secuencia que el alta manual) ──────────────────
    const programStart = new Date().toISOString().slice(0, 10)
    const perInstallmentAmount = tier.installments > 1 ? amount : tier.totalAmount

    const { data: crmClient, error: crmErr } = await sb
      .from("crm_clients")
      .insert({
        name,
        email,
        programa:           tier.program,
        program_start:      programStart,
        installment_amount: perInstallmentAmount,
        num_installments:   tier.installments,
        program_duration:   tier.installments,
        total_amount:       tier.totalAmount,
        status:             "activo",
        notes:              `Alta automática vía PayFunnels — Programa: ${tier.program}`,
        forma_pago:         "PayFunnels",
      })
      .select("id")
      .single()

    if (crmErr || !crmClient) {
      await finish(null, `Error creando crm_clients: ${crmErr?.message}`)
      return NextResponse.json({ ok: false, error: crmErr?.message }, { status: 500 })
    }

    const clientId = crmClient.id as string

    try {
      await sb.from("onboarding_flow").insert({ crm_client_id: clientId })
    } catch (err) {
      console.error("[payfunnels] onboarding_flow insert failed (non-blocking):", err)
    }

    const installmentsToInsert = Array.from({ length: tier.installments }, (_, idx) => ({
      client_id:          clientId,
      installment_number: idx + 1,
      due_date:           addMonths(programStart, idx),
      amount:             perInstallmentAmount,
      paid_at:            idx === 0 ? new Date().toISOString() : null,
    }))
    const { error: instErr } = await sb.from("crm_installments").insert(installmentsToInsert)
    if (instErr) console.error("[payfunnels] crm_installments insert failed (non-blocking):", instErr)

    const { error: portalErr } = await sb.from("clients").insert({ id: clientId, name })
    if (portalErr) {
      await finish(clientId, `Error creando fila de portal (clients): ${portalErr.message}`)
      return NextResponse.json({ ok: false, error: portalErr.message }, { status: 500 })
    }

    const tempPassword = generateTempPassword()
    const { data: created, error: authErr } = await sb.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: "client", name },
      app_metadata:  { role: "client" },
    })

    if (authErr || !created?.user) {
      await finish(clientId, `Error creando cuenta de auth: ${authErr?.message}`)
      return NextResponse.json({ ok: false, error: authErr?.message ?? "Error al crear la cuenta" }, { status: 500 })
    }

    const userId = created.user.id
    const { error: profileErr } = await sb
      .from("profiles")
      .upsert({ id: userId, role: "client", name, client_id: clientId }, { onConflict: "id" })
    if (profileErr) console.error("[payfunnels] profiles upsert failed:", profileErr)

    let magicLink: string | null = null
    try {
      const { data: link } = await sb.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://smartscale.space"}/reset-password` },
      })
      magicLink = (link as any)?.properties?.action_link ?? null
    } catch (err) {
      console.error("[payfunnels] magic link generation failed:", err)
    }

    // Copia del playbook template de Alberto — best-effort, no bloqueante.
    try {
      const { data: albertoPlaybook } = await sb
        .from("client_playbook_main")
        .select("*")
        .eq("client_id", ALBERTO_CLIENT_ID)
        .maybeSingle()
      if (albertoPlaybook) {
        await sb.from("client_playbook_main").insert({
          client_id: clientId,
          title: (albertoPlaybook as any).title,
          content: (albertoPlaybook as any).content,
          visible_to_client: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error("[payfunnels] playbook copy failed (non-blocking):", err)
    }

    // ── Contrato por SignNow (fire-and-forget, sobrevive el corte de la función) ─
    after(() => sendContractForSignature({
      clienteNombre: name,
      clienteEmail:  email,
      program:       tier.program,
      totalAmount:   tier.totalAmount,
      primerPago:    perInstallmentAmount,
      cuotas:        tier.installments > 1 ? { cuota_1: perInstallmentAmount, cuota_2: perInstallmentAmount } : { cuota_1: tier.totalAmount },
      cantidadMeses: tier.installments,
    }).then(result => {
      if (result?.document_id) {
        return sb.from("onboarding_flow")
          .update({ signnow_document_id: result.document_id, updated_at: new Date().toISOString() })
          .eq("crm_client_id", clientId)
      }
    }).catch(err => console.error("[payfunnels] SignNow sync failed (non-blocking):", err)))

    after(() => notifyClientOnboarded({
      client_id:     clientId,
      name,
      email,
      program:       tier.program,
      total_amount:  tier.totalAmount,
      cuotas:        tier.installments > 1 ? { cuota_1: perInstallmentAmount, cuota_2: perInstallmentAmount } : { cuota_1: tier.totalAmount },
      program_start: programStart,
      temp_password: tempPassword,
      magic_link:    magicLink ?? undefined,
    }).catch(err => console.error("[payfunnels] Slack onboarding notify failed:", err)))

    after(() => zapierClientOnboarded({
      event_type:    "client.onboarded",
      client_id:     clientId,
      client_name:   name,
      email,
      program:       tier.program,
      total_amount:  tier.totalAmount,
      cuotas:        tier.installments > 1 ? { cuota_1: perInstallmentAmount, cuota_2: perInstallmentAmount } : { cuota_1: tier.totalAmount },
      program_start: programStart,
      temp_password: tempPassword,
      magic_link:    magicLink,
    }).catch(err => console.error("[payfunnels] Zapier onboarding notify failed:", err?.message)))

    await finish(clientId, null)
    return NextResponse.json({ ok: true, client_id: clientId, program: tier.program })
  } catch (err: any) {
    console.error("[payfunnels] webhook error:", err)
    await finish(null, err?.message ?? "Error interno").catch(() => null)
    // 200 igual — evita reintentos en cadena de PayFunnels; el error queda logueado.
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" })
  }
}
