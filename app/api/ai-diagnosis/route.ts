
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── Module maps ──────────────────────────────────────────────────────────────

const MODULES_MENOS20K: Record<string, { name: string; url: string | null }> = {
  F1: { name: "La Ingeniera de un Simple Post",         url: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=3a570a586e744dedafdef91c419fe72d" },
  F2: { name: "Los No Negociables Diarios",             url: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=c5c75f6311a645a5867f213dde41731b" },
  F3: { name: "El Diamante de Autoridad & BIO",         url: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=5a91a467141640bf89bd4b13141181c6" },
  F4: { name: "Quick Cash DM Ads",                      url: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=a201e7243ac44af4b58e721c7c455b42" },
  E1: { name: "Mini-Serie Youtube Playbook",            url: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=5edbbfa66f1047a0a814f29e6dd236a0" },
  E2: { name: "Airtable CRM y Base de Datos",           url: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=e40e73a9017a4d21a222c23cf1f15c16" },
  E3: { name: "DM to Chat — Priorizacion de tu Pipeline", url: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=ad1eff5e3bc148dfb1fbaa577adad68c" },
  I1: { name: "Tu Programa Matadolor™",                 url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=3114f6cc62a846a7a4f996697d45e075" },
  I2: { name: "Onboarding Proceso",                     url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=6ab1072e74324d14b2b666f30f5a7092" },
  I3: { name: "Tu Offer Doc",                           url: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=9bfa0b4c8323478ca0436e75aa3ad902" },
  T1: { name: "Investigacion de Mercado",               url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=5517d71b489548e6aa1ed63890d0a600" },
  T2: { name: "Recoleccion de Prueba Social",           url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=6b66e086de2f44feb598e4d7e8c9e0b9" },
  T3: { name: "Una Simple Oferta | Blueprint",          url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=8ab64a0d4cf34a979f914fc2fd8eac62" },
}

const MODULES_MAS20K: Record<string, { name: string; url: string | null }> = {
  F4: { name: "Lead Magnets Principales",                          url: "https://www.skool.com/strategy-consulting/classroom/b70c523e?md=a35dd1def5c94d88a226995aea444f33" },
  F5: { name: "Un Simple Protocolo de Ads",                        url: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=2612acf4f7e64788b327f4568554abe0" },
  F6: { name: "Productividad y Calendario Optimizado",             url: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=dde2660eda3e48b09383936180dd1e1b" },
  F7: { name: "Quick Cash DM Ads",                                 url: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=a201e7243ac44af4b58e721c7c455b42" },
  E4: { name: "El Blueprint de una Marca con Identidad",           url: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=cfd8870603c54aff944465e90f275111" },
  E5: { name: "Un Simple Video (VSL)",                             url: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=0bbae3a1de594f5b958e7affe859a652" },
  E6: { name: "Workshops DDE",                                     url: null },
  I4: { name: "Creacion de Tu Simple Oferta",                      url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=65d7aa8ec4f4471a96c5fa4a134383e4" },
  I5: { name: "Tu World Class Delivery",                           url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=169b8b019d194654a84f1a2415b4502c" },
  I6: { name: "Nivel 8 — IA & Sistemas",                          url: "https://www.skool.com/strategy-consulting/classroom/70b44121?md=09194ec249794bc7b686ea1e7b5122c2" },
  T4: { name: "Comunidad Solida",                                  url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=49c844ba2c644830be548a4e9fe015cb" },
  T5: { name: "Formulario de Contratacion",                        url: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=293abb85bfe445c8b8bc265e7278471d" },
  T6: { name: "SmartScale Roadmap",                                url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=3038e1c85d064ea3af2e30952a1c71b6" },
}

// ─── Parse prompt → items per color ──────────────────────────────────────────

type ParsedItem = { id: string; label: string }
type ParsedAudit = { red: ParsedItem[]; orange: ParsedItem[]; green: ParsedItem[] }

function parsePrompt(prompt: string): ParsedAudit {
  const red:    ParsedItem[] = []
  const orange: ParsedItem[] = []
  const green:  ParsedItem[] = []

  const lineRe = /^\s*-\s*\[(ROJO|NARANJA|VERDE)\]\s+([A-Z]\d+):\s+(.+)$/

  for (const line of prompt.split("\n")) {
    const m = line.match(lineRe)
    if (!m) continue
    const [, color, id, label] = m
    const item = { id, label: label.trim() }
    if (color === "ROJO")    red.push(item)
    if (color === "NARANJA") orange.push(item)
    if (color === "VERDE")   green.push(item)
  }

  return { red, orange, green }
}

// ─── Build deterministic markdown ─────────────────────────────────────────────

function buildDiagnosis(prompt: string, auditType: string): string {
  const modules = auditType === "mas20k" ? MODULES_MAS20K : MODULES_MENOS20K
  const { red, orange, green } = parsePrompt(prompt)

  const lines: string[] = ["# Mapa de Ruta Smart Scale", ""]

  const modLine = (prefix: string, mod: { name: string; url: string | null } | undefined) => {
    if (!mod) return ""
    if (!mod.url) return `- ${prefix}: ${mod.name} _(Módulo en creación)_`
    return `- ${prefix}: [${mod.name}](${mod.url})`
  }

  // ── En primer lugar (rojo) ──
  if (red.length > 0) {
    lines.push("## En primer lugar", "")
    for (const item of red) {
      const mod = modules[item.id]
      lines.push(`### ${item.id}: ${item.label}`)
      if (mod) lines.push(modLine("Mirá esto", mod))
      lines.push("")
    }
  }

  // ── En segundo lugar (naranja) ──
  if (orange.length > 0) {
    lines.push("## En segundo lugar", "")
    for (const item of orange) {
      const mod = modules[item.id]
      lines.push(`### ${item.id}: ${item.label}`)
      if (mod) lines.push(modLine("Mirá esto", mod))
      lines.push("")
    }
  }

  // ── Felicitaciones (verde) ──
  if (green.length > 0) {
    lines.push("## Felicitaciones", "")
    for (const item of green) {
      const mod = modules[item.id]
      lines.push(`### ${item.id}: ${item.label}`)
      if (mod) lines.push(modLine("Seguí apoyándote en", mod))
      lines.push("")
    }
  }

  if (!red.length && !orange.length && !green.length) {
    lines.push("_No se encontraron puntos evaluados en la auditoría._")
  }

  return lines.join("\n")
}

// ─── GET: poll status ─────────────────────────────────────────────────────────

function getAdminSupabase() {
  return createServiceClient()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const requestId = searchParams.get("request_id")

    if (!requestId) {
      return NextResponse.json({ error: "Missing request_id" }, { status: 400 })
    }

    const supabase = getAdminSupabase()

    const { data, error } = await supabase
      .from("ai_diagnosis_results")
      .select("result, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      const { data: requestRow, error: requestError } = await supabase
        .from("ai_diagnosis_requests")
        .select("status, updated_at, created_at")
        .eq("id", requestId)
        .maybeSingle()

      if (requestError) {
        return NextResponse.json({ error: requestError.message }, { status: 500 })
      }

      return NextResponse.json({
        result: null,
        created_at: requestRow?.created_at ?? null,
        updated_at: requestRow?.updated_at ?? null,
        status: requestRow?.status ?? "pending",
      })
    }

    return NextResponse.json({
      result: data.result ?? null,
      created_at: data.created_at ?? null,
      status: data.result ? "completed" : "pending",
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", detail: error?.message || "Unknown error" },
      { status: 500 }
    )
  }
}

// ─── POST: diagnóstico determinista (sin IA) ──────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt, auditType, annualRevenue, selectedMonth, clientId, userId } = body ?? {}

    if (!prompt || typeof prompt !== "string" || !userId) {
      return NextResponse.json({ error: "Missing prompt or userId" }, { status: 400 })
    }

    const supabase = getAdminSupabase()

    // 1. Build result deterministically — no AI call
    const result = buildDiagnosis(prompt, auditType ?? "menos20k")

    // 2. Save request as completed immediately
    const { data: inserted, error: requestError } = await supabase
      .from("ai_diagnosis_requests")
      .insert({
        user_id:        userId,
        prompt,
        audit_type:     auditType ?? null,
        annual_revenue: annualRevenue ?? null,
        selected_month: selectedMonth ?? null,
        client_id:      clientId ?? null,
        status:         "completed",
      })
      .select("id")
      .limit(1)
      .single()

    if (requestError || !inserted?.id) {
      return NextResponse.json(
        { error: "Error al guardar el request", detail: requestError?.message },
        { status: 500 }
      )
    }

    const requestId = inserted.id

    // 3. Save result
    await supabase.from("ai_diagnosis_results").insert({
      request_id:   requestId,
      result,
      raw_response: null,
      created_at:   new Date().toISOString(),
    })

    // 4. Return result directly — no polling needed
    return NextResponse.json({
      message:    "Diagnóstico completado.",
      request_id: requestId,
      result,
      status:     "completed",
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error:  "Internal server error",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}
