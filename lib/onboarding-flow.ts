/**
 * Lógica compartida de la secuencia de onboarding — la usan el webhook de GHL
 * (contrato firmado), el botón de override manual, y el botón de reintento
 * de un email individual en la UI, para no duplicar la lógica entre triggers.
 *
 * triggerContractSigned():
 *   1. Idempotente — si onboarding_flow.contract_signed_at ya está seteado,
 *      no hace nada (evita reenviar los 3 emails si GHL reintenta el webhook).
 *   2. Marca el contrato como firmado.
 *   3. Dispara los 3 emails (Skool, Slack, Plataforma) y guarda el resultado
 *      de cada uno (sent_at o error) en onboarding_flow.
 *   4. Si algún email falló, avisa por push a Juampi.
 *
 * resendOnboardingEmail():
 *   Reenvía un solo email (botón "Reintentar" en la UI) sin tocar
 *   contract_signed_at ni los otros dos emails.
 */
import { createServiceClient } from "@/lib/supabase-service"
import { sendSkoolAccessEmail, sendSlackAccessEmail, sendWelcomeEmail, type EmailResult } from "@/lib/email"
import { sendPushToNames } from "@/lib/push"

export type OnboardingEmailTemplate = "skool" | "slack" | "platform"

export interface TriggerContractSignedResult {
  ok:               boolean
  alreadyProcessed: boolean
  error?:           string
}

async function sendOnboardingEmail(
  sb: ReturnType<typeof createServiceClient>,
  template: OnboardingEmailTemplate,
  name: string,
  email: string,
): Promise<EmailResult> {
  if (template === "skool") return sendSkoolAccessEmail({ name, email })
  if (template === "slack") return sendSlackAccessEmail({ name, email })

  // Magic link fresco para el email de plataforma (los de creación expiran a las 24hs).
  let magicLink: string | null = null
  try {
    const { data: link } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://smartscale.space"}/reset-password` },
    })
    magicLink = (link as any)?.properties?.action_link ?? null
  } catch (err) {
    console.error("[onboarding-flow] magic link generation failed:", err)
  }
  return magicLink
    ? sendWelcomeEmail({ name, email, magic_link: magicLink })
    : { ok: false, error: "No se pudo generar el magic link" }
}

export async function resendOnboardingEmail(
  sb: ReturnType<typeof createServiceClient>,
  crmClientId: string,
  template: OnboardingEmailTemplate,
): Promise<EmailResult> {
  const { data: flow } = await sb
    .from("onboarding_flow")
    .select("id")
    .eq("crm_client_id", crmClientId)
    .maybeSingle()
  if (!flow) return { ok: false, error: "No existe fila de onboarding_flow para este cliente" }

  const { data: client } = await sb
    .from("crm_clients")
    .select("name, email")
    .eq("id", crmClientId)
    .maybeSingle()
  if (!client) return { ok: false, error: "No se encontró el cliente" }

  const name  = (client as any).name as string
  const email = (client as any).email as string
  const result = await sendOnboardingEmail(sb, template, name, email)

  await sb.from("onboarding_flow").update({
    [`email_${template}_sent_at`]: result.ok ? new Date().toISOString() : null,
    [`email_${template}_error`]:   result.ok ? null : result.error ?? "unknown error",
    updated_at: new Date().toISOString(),
  }).eq("id", (flow as any).id)

  return result
}

export async function triggerContractSigned(
  sb: ReturnType<typeof createServiceClient>,
  crmClientId: string,
): Promise<TriggerContractSignedResult> {
  const { data: flow } = await sb
    .from("onboarding_flow")
    .select("id, contract_signed_at")
    .eq("crm_client_id", crmClientId)
    .maybeSingle()

  if (!flow) {
    return { ok: false, alreadyProcessed: false, error: "No existe fila de onboarding_flow para este cliente" }
  }
  if ((flow as any).contract_signed_at) {
    return { ok: true, alreadyProcessed: true }
  }

  const { data: client } = await sb
    .from("crm_clients")
    .select("name, email")
    .eq("id", crmClientId)
    .maybeSingle()

  if (!client) {
    return { ok: false, alreadyProcessed: false, error: "No se encontró el cliente" }
  }
  const name  = (client as any).name as string
  const email = (client as any).email as string

  const now = new Date().toISOString()
  await sb.from("onboarding_flow")
    .update({ contract_signed_at: now, updated_at: now })
    .eq("id", (flow as any).id)

  const [skoolResult, slackResult, platformResult] = await Promise.all([
    sendOnboardingEmail(sb, "skool", name, email),
    sendOnboardingEmail(sb, "slack", name, email),
    sendOnboardingEmail(sb, "platform", name, email),
  ])

  await sb.from("onboarding_flow").update({
    email_skool_sent_at:    skoolResult.ok    ? new Date().toISOString() : null,
    email_skool_error:      skoolResult.ok    ? null : skoolResult.error ?? "unknown error",
    email_slack_sent_at:    slackResult.ok    ? new Date().toISOString() : null,
    email_slack_error:      slackResult.ok    ? null : slackResult.error ?? "unknown error",
    email_platform_sent_at: platformResult.ok ? new Date().toISOString() : null,
    email_platform_error:   platformResult.ok ? null : platformResult.error ?? "unknown error",
    updated_at: new Date().toISOString(),
  }).eq("id", (flow as any).id)

  const failed = [
    !skoolResult.ok    && "Skool",
    !slackResult.ok    && "Slack",
    !platformResult.ok && "Plataforma",
  ].filter(Boolean) as string[]

  if (failed.length > 0) {
    await sendPushToNames(sb, ["Juampi"], {
      title: "⚠️ Falló un email de onboarding",
      body:  `${name}: no se pudo enviar ${failed.join(", ")}. Revisá /admin/onboarding.`,
      url:   "/admin/onboarding",
    }).catch(() => {})
  }

  return { ok: failed.length === 0, alreadyProcessed: false }
}
