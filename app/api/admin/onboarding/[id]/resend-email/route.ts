/**
 * POST /api/admin/onboarding/[id]/resend-email
 *
 * Reenvía un solo email de onboarding (botón "Reintentar" en la UI cuando un
 * envío falló). `id` es el crm_client_id. Body: { template: "skool" | "slack" | "platform" }
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import { resendOnboardingEmail, type OnboardingEmailTemplate } from "@/lib/onboarding-flow"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VALID_TEMPLATES: OnboardingEmailTemplate[] = ["skool", "slack", "platform"]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const caller = await requireInternal(jwt)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  let body: any
  try { body = await req.json() } catch { body = {} }
  const template = body?.template as OnboardingEmailTemplate
  if (!VALID_TEMPLATES.includes(template)) {
    return NextResponse.json({ error: `template debe ser uno de: ${VALID_TEMPLATES.join(", ")}` }, { status: 400 })
  }

  const sb = createServiceClient()
  const result = await resendOnboardingEmail(sb, id, template)

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "No se pudo reenviar el email" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
