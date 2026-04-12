
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── Module maps ──────────────────────────────────────────────────────────────

const MODULES_MENOS20K: Record<string, { name: string; url: string }> = {
  F1: { name: "Un Simple Post™ Diario",              url: "https://www.skool.com/strategy-consulting/classroom/6de08095" },
  F2: { name: "El Ritmo Semanal / No Negociables",   url: "https://www.skool.com/strategy-consulting/classroom/552a38a7" },
  F3: { name: "El Caracter Diamante™",               url: "https://www.skool.com/strategy-consulting/classroom/6de08095" },
  F4: { name: "Optimizar Quick Cash DM™",            url: "https://www.skool.com/strategy-consulting/classroom/c886e8bf" },
  E1: { name: "La Mini-Serie Youtube",               url: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75" },
  E2: { name: "The Airtable CRM",                    url: "https://www.skool.com/strategy-consulting/classroom/552a38a7" },
  E3: { name: "DM-To-Close™ System",                 url: "https://www.skool.com/strategy-consulting/classroom/cd022ec1" },
  I1: { name: "El Modelo Mata Dolor™",               url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4" },
  I2: { name: "Onboarding Mastery",                  url: "https://www.skool.com/strategy-consulting/classroom/552a38a7" },
  I3: { name: "The Offer Doc",                       url: "https://www.skool.com/strategy-consulting/classroom/cd022ec1" },
  T1: { name: "Market Intelligence",                 url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4" },
  T2: { name: "Recolectar Casos de Exito",           url: "https://www.skool.com/strategy-consulting/classroom/6de08095" },
  T3: { name: "Una Simple Oferta™",                  url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4" },
}

const MODULES_MAS20K: Record<string, { name: string; url: string }> = {
  F4: { name: "Lead Magnets Multiples",                             url: "https://www.skool.com/strategy-consulting/classroom/6de08095" },
  F5: { name: "Ecosistema Circular Ads",                            url: "https://www.skool.com/strategy-consulting/classroom/6de08095" },
  F6: { name: "Calendario de Contenido Mensual (Hooks validados)",  url: "https://www.skool.com/strategy-consulting/classroom/6de08095" },
  F7: { name: "Optimizar QUICK DM ADS - Cash Menu™",               url: "https://www.skool.com/strategy-consulting/classroom/c886e8bf" },
  E4: { name: "Marca Con Identidad™",                               url: "https://www.skool.com/strategy-consulting/classroom/6de08095" },
  E5: { name: "Un Simple Video VSL™",                               url: "https://www.skool.com/strategy-consulting/classroom/cd022ec1" },
  E6: { name: "Workshops DDE",                                      url: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75" },
  I4: { name: "Como Lanzar Ofertas",                                url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4" },
  I5: { name: "Experiencia World Class",                            url: "https://www.skool.com/strategy-consulting/classroom/552a38a7" },
  I6: { name: "AI + Systems",                                       url: "https://www.skool.com/strategy-consulting/classroom/552a38a7" },
  T4: { name: "The Group Keys",                                     url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4" },
  T5: { name: "Contratando Jugadores A",                            url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4" },
  T6: { name: "El Roadmap de la Escalabilidad",                     url: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4" },
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

  // ── En primer lugar (rojo) ──
  if (red.length > 0) {
    lines.push("## En primer lugar", "")
    for (const item of red) {
      const mod = modules[item.id]
      lines.push(`### ${item.id}: ${item.label}`)
      if (mod) {
        lines.push(`- Mirá esto: [${mod.name}](${mod.url})`)
      }
      lines.push("")
    }
  }

  // ── En segundo lugar (naranja) ──
  if (orange.length > 0) {
    lines.push("## En segundo lugar", "")
    for (const item of orange) {
      const mod = modules[item.id]
      lines.push(`### ${item.id}: ${item.label}`)
      if (mod) {
        lines.push(`- Mirá esto: [${mod.name}](${mod.url})`)
      }
      lines.push("")
    }
  }

  // ── Felicitaciones (verde) ──
  if (green.length > 0) {
    lines.push("## Felicitaciones", "")
    for (const item of green) {
      const mod = modules[item.id]
      lines.push(`### ${item.id}: ${item.label}`)
      if (mod) {
        lines.push(`- Seguí apoyándote en: [${mod.name}](${mod.url})`)
      }
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
