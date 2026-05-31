import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { getFormByRole } from "@/lib/team-application-forms"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const {
      role,
      first_name,
      last_name,
      email,
      whatsapp,
      instagram_handle,
      answers,
    } = body ?? {}

    if (!role || typeof role !== "string") {
      return NextResponse.json({ error: "Falta el rol al que aplicás" }, { status: 400 })
    }

    const form = getFormByRole(role)
    if (!form) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 })
    }

    if (!first_name || !last_name || !email || !whatsapp) {
      return NextResponse.json({ error: "Faltan campos de contacto requeridos" }, { status: 400 })
    }

    // Validar gates server-side: si el candidato cae en un gate, rechazar.
    const safeAnswers: Record<string, any> = answers && typeof answers === "object" ? answers : {}
    for (const section of form.sections) {
      if (!section.fields) continue
      for (const field of section.fields) {
        if (field.gate && safeAnswers[field.id] === field.gate.value) {
          return NextResponse.json(
            { error: field.gate.message, gated: true },
            { status: 400 }
          )
        }
      }
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("team_applications")
      .insert({
        role,
        first_name:       first_name       || null,
        last_name:        last_name        || null,
        email:            email            || null,
        whatsapp:         whatsapp         || null,
        instagram_handle: instagram_handle || null,
        answers:          safeAnswers,
        status:           "nueva",
      })
      .select("id")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ── Webhook a Zapier (fire-and-forget). Zap dedicado a aplicaciones de
    //    equipo. Configurar TEAM_APPLY_WEBHOOK_URL en Vercel — sin fallback.
    const webhookUrl = process.env.TEAM_APPLY_WEBHOOK_URL

    if (webhookUrl) {
      const flatAnswers: Record<string, string> = {}
      for (const [k, v] of Object.entries(safeAnswers)) {
        flatAnswers[`r_${k}`] = v == null ? "" : String(v)
      }

      const payload = new URLSearchParams({
        tipo_form:       "equipo",
        rol:             form.role,
        rol_label:       form.title,
        id:              data.id,
        nombre:          first_name                              ?? "",
        apellido:        last_name                               ?? "",
        nombre_completo: `${first_name} ${last_name}`.trim(),
        email:           email                                   ?? "",
        whatsapp:        whatsapp                                ?? "",
        instagram:       instagram_handle                        ?? "",
        fecha_envio:     new Date().toISOString(),
        ...flatAnswers,
      })

      fetch(webhookUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    payload.toString(),
      }).catch(() => { /* silencioso — no rompe la respuesta */ })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
