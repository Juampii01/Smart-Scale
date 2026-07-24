/**
 * POST /api/webhooks/payfunnels
 *
 * Recibe la notificación de pago completado y dispara el onboarding
 * automático completo — misma secuencia que el alta manual en
 * app/api/admin/onboarding/route.ts (crm_clients, onboarding_flow,
 * crm_installments, cuenta del dashboard, contrato por SignNow).
 *
 * Quién llama a este endpoint: PayFunnels solo soporta una URL de webhook
 * global por cuenta, y ya está pensada para apuntar a la landing/checkout
 * (proyecto separado, strategycoach.us) — así que en la práctica quien nos
 * llama es la LANDING, reenviando el evento después de procesarlo ella, no
 * PayFunnels directo. Por eso el `program` viene explícito en el body la
 * mayoría de las veces: la landing ya sabe con certeza qué link/botón usó
 * el cliente. El monto solo se usa como respaldo (inferido contra los 4
 * montos vigentes) si no viene `program`, por ejemplo si en algún momento
 * SÍ apuntan PayFunnels acá directo.
 *
 * Si no se puede resolver ni por program ni por monto, el pago se loguea
 * igual y se avisa por Slack — nunca se crea un cliente a medias.
 *
 * Auth: acepta el secreto en la query string (?secret=...) — por si el
 * emisor es PayFunnels directo, que no manda headers custom — o en el
 * header x-webhook-secret/Authorization si el emisor es la landing (que sí
 * puede mandar headers).
 */
import { NextRequest, NextResponse, after } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { sendContractForSignature } from "@/lib/signnow"
import { notifyClientOnboarded, sendSlackMessage } from "@/lib/slack"
import { zapierClientOnboarded } from "@/lib/zapier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALBERTO_CLIENT_ID = "09314097-df56-450f-980e-38ec1e61f246"

interface Tier { program: string; installments: number; totalAmount: number; perInstallment: number }

const TIERS: Tier[] = [
  { program: "Smart Scale Grupal",  installments: 1, totalAmount: 3000, perInstallment: 3000 },
  { program: "Smart Scale Grupal",  installments: 2, totalAmount: 3500, perInstallment: 1750 },
  { program: "Smart Scale Híbrido", installments: 1, totalAmount: 6500, perInstallment: 6500 },
  { program: "Smart Scale Híbrido", installments: 2, totalAmount: 7000, perInstallment: 3500 },
]

/** Normaliza variantes de nombre de programa (la landing puede mandar labels
 *  distintos a los que usa el resto del código, ver app/apply/page.tsx). */
function normalizeProgram(raw: any): string | null {
  const s = String(raw ?? "").trim().toLowerCase()
  if (!s) return null
  const isHybrid = s.includes("hybrid") || s.includes("hibrido") || s.includes("híbrido")
  if (isHybrid) return "Smart Scale Híbrido"
  if (s.includes("grupal")) return "Smart Scale Grupal"
  // invoiceTitle real de PayFunnels (vía relay de la landing): "Smart Scale"
  // / "Smart Scale/ two" — sin "hybrid" en el título es el plan Grupal.
  if (s.includes("smart scale")) return "Smart Scale Grupal"
  return null
}

/** Resuelve el tier priorizando el `program` explícito (+ cantidad de cuotas
 *  si viene) que ya conoce quien nos llama; el monto es solo el respaldo. */
function resolveTier(body: Record<string, any>, amount: number | null): Tier | null {
  const explicitProgram = normalizeProgram(pick(body, "program", "programa", "plan"))
  if (explicitProgram) {
    const rawInstallments = toNum(pick(body, "installments", "num_installments", "cuotas", "cantidad_cuotas"))
    const wantedInstallments = rawInstallments != null ? Math.round(rawInstallments) : null

    if (wantedInstallments != null) {
      const exact = TIERS.find(t => t.program === explicitProgram && t.installments === wantedInstallments)
      if (exact) return exact
    }
    if (amount != null) {
      const byAmount = TIERS.find(t => t.program === explicitProgram && Math.round(t.perInstallment) === Math.round(amount))
      if (byAmount) return byAmount
    }
    // Programa conocido pero sin forma de saber cuotas — default a 1 pago.
    return TIERS.find(t => t.program === explicitProgram && t.installments === 1) ?? null
  }

  // Sin program explícito (ej. PayFunnels pegando directo): inferir todo por el monto.
  if (amount != null) {
    return TIERS.find(t => Math.round(t.perInstallment) === Math.round(amount)) ?? null
  }
  return null
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
    const hasProgram = normalizeProgram(pick(body, "program", "programa", "plan")) != null

    // amount solo es estrictamente necesario si no vino un program explícito
    // (ej. la landing no llegó a mandarlo por algún motivo) — con program
    // presente, alcanza con name/email para resolver el tier.
    if (!name || !email || (!hasProgram && amount == null)) {
      const reason = `Faltan datos básicos (name=${!!name}, email=${!!email}, program=${hasProgram}, amount=${amount})`
      await finish(null, reason)
      await sendSlackMessage(
        [{ type: "section", text: { type: "mrkdwn", text: `⚠️ *Webhook de PayFunnels con datos incompletos*\n${reason}\nRevisar \`payfunnels_webhook_events\` (id: ${logId ?? "?"}).` } }],
        "⚠️ Webhook de PayFunnels con datos incompletos",
      ).catch(() => null)
      return NextResponse.json({ ok: true, warning: reason })
    }

    // ── Resolver el plan (program explícito de la landing, o inferido por monto) ─
    const tier = resolveTier(body, amount)
    if (!tier) {
      const reason = `No se pudo resolver el plan (program=${hasProgram ? pick(body, "program", "programa", "plan") : "no vino"}, monto=${amount != null ? `$${amount}` : "no vino"})`
      await finish(null, reason)
      await sendSlackMessage(
        [{ type: "section", text: { type: "mrkdwn", text: `⚠️ *Pago de PayFunnels sin plan reconocido*\n*Cliente:* ${name} (${email})\n${reason}\nRevisar y cargar a mano en /admin/onboarding.` } }],
        `⚠️ Pago de PayFunnels sin plan reconocido (${name})`,
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
    const perInstallmentAmount = tier.perInstallment

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
