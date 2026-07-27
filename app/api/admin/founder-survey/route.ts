/**
 * GET/POST /api/admin/founder-survey
 *
 * Encuesta de "Sistema Operativo" — reemplaza el business.md/marketing.md/
 * delivery.md manual por respuestas guardadas en founder_operating_system,
 * una fila por sección (negocio/marketing/entrega). Solo admin.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VALID_SECTIONS = ["negocio", "marketing", "entrega"]

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const caller = await requireAdmin(jwt)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const { data, error } = await sb
    .from("founder_operating_system")
    .select("section, answers, completed_at, updated_at")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const bySection: Record<string, any> = {}
  for (const row of data ?? []) bySection[row.section] = row

  return NextResponse.json({ sections: bySection })
}

export async function POST(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const caller = await requireAdmin(jwt)
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { section, answers, completed } = body as { section: string; answers: Record<string, unknown>; completed?: boolean }

  if (!VALID_SECTIONS.includes(section)) {
    return NextResponse.json({ error: "Sección inválida" }, { status: 400 })
  }
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "answers es requerido" }, { status: 400 })
  }

  const sb = createServiceClient()
  const now = new Date().toISOString()

  const { error } = await sb
    .from("founder_operating_system")
    .upsert({
      section,
      answers,
      completed_at: completed ? now : null,
      updated_at: now,
      updated_by: caller.id,
    }, { onConflict: "section" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
