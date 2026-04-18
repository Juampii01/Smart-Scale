
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── Module maps ──────────────────────────────────────────────────────────────

// +$20k → F1-F3, E1-E3, T1-T3, I1-I3
const MODULES_MAS20K: Record<string, { name: string; level: string }> = {
  F1: { name: "La Ingeniera de un Simple Post",          level: "Nivel 5" },
  F2: { name: "Los No Negociables Diarios",              level: "Nivel 0" },
  F3: { name: "El Diamante de Autoridad & BIO",          level: "Nivel 5" },
  E1: { name: "Mini-Serie Youtube Playbook",             level: "Nivel 7" },
  E2: { name: "Airtable CRM y Base de Datos",            level: "Nivel 8" },
  E3: { name: "DM to Chat — Priorizacion de tu Pipeline",level: "Nivel 6" },
  T1: { name: "Investigacion de Mercado",                level: "Nivel 3" },
  T2: { name: "Recoleccion de Prueba Social",            level: "Nivel 3" },
  T3: { name: "Una Simple Oferta | Blueprint",           level: "Nivel 3" },
  I1: { name: "Tu Programa Matadolor™",                  level: "Nivel 3" },
  I2: { name: "Onboarding Proceso",                      level: "Nivel 3" },
  I3: { name: "Tu Offer Doc",                            level: "Nivel 6" },
}

// -$20k → F4-F6, E4-E6, T4-T6, I4-I6
const MODULES_MENOS20K: Record<string, { name: string; level: string }> = {
  F4: { name: "Lead Magnets Principales",                level: "Nivel 4" },
  F5: { name: "Un Simple Protocolo de Ads",              level: "Nivel 5" },
  F6: { name: "Productividad y Calendario Optimizado",   level: "Nivel 5" },
  E4: { name: "El Blueprint de una Marca con Identidad", level: "Nivel 5" },
  E5: { name: "Un Simple Video (VSL)",                   level: "Nivel 6" },
  E6: { name: "Workshops DDE",                           level: "En creación" },
  T4: { name: "Comunidad Solida",                        level: "Nivel 3" },
  T5: { name: "Formulario de Contratacion",              level: "Nivel 6" },
  T6: { name: "SmartScale Roadmap",                      level: "Nivel 0" },
  I4: { name: "Creacion de Tu Simple Oferta",            level: "Nivel 3" },
  I5: { name: "Tu World Class Delivery",                 level: "Nivel 3" },
  I6: { name: "IA & Sistemas",                           level: "Nivel 8" },
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

// ─── Pillar metadata ──────────────────────────────────────────────────────────

const PILLAR_META: Record<string, { name: string; focus: string }> = {
  F: {
    name: "FASCINAR",
    focus: "Tu prioridad es construir autoridad y atraer audiencia de calidad. Sin una base sólida de atracción, la conversión y el delivery no tienen de dónde alimentarse.",
  },
  E: {
    name: "EDUCAR",
    focus: "Tu prioridad es fortalecer el seguimiento, tu lista de email y el sistema de conversión desde DMs. Tenés audiencia pero no estás convirtiendo todo su potencial.",
  },
  I: {
    name: "INVITAR",
    focus: "Tu prioridad es mejorar el onboarding y la entrega para que tus clientes logren resultados rápidos. La retención y los referidos dependen de esto.",
  },
  T: {
    name: "TRANSFORMAR",
    focus: "Tu prioridad es clarificar tu oferta y construir prueba social contundente. Sin esto, la atracción y la conversión pierden potencia.",
  },
}

// ─── Build deterministic markdown ─────────────────────────────────────────────

function buildDiagnosis(prompt: string, auditType: string): string {
  const modules = auditType === "mas20k" ? MODULES_MAS20K : MODULES_MENOS20K
  const { red, orange, green } = parsePrompt(prompt)

  // ── Identify primary bottleneck pillar ──
  const pillarScore: Record<string, number> = { F: 0, E: 0, I: 0, T: 0 }
  for (const item of red)    { const p = item.id[0]; if (p in pillarScore) pillarScore[p] += 2 }
  for (const item of orange) { const p = item.id[0]; if (p in pillarScore) pillarScore[p] += 1 }
  const primaryPillar = Object.entries(pillarScore).sort(([, a], [, b]) => b - a)[0]

  const modLine = (mod: { name: string; level: string }) => {
    if (mod.level === "En creación") return `- Módulo: **${mod.name}** _(En creación)_`
    return `- Módulo: **${mod.name}** — ${mod.level}`
  }

  const lines: string[] = ["# Mi Ecosistema — Diagnóstico", ""]

  // ── Foco estratégico ──
  if (primaryPillar && primaryPillar[1] > 0) {
    const pillar = PILLAR_META[primaryPillar[0]]
    lines.push("## Tu foco este trimestre", "")
    lines.push(`**${pillar.name}** — ${pillar.focus}`)
    lines.push("")
  }

  // ── Trabajar primero (rojo) ──
  if (red.length > 0) {
    lines.push("## Trabajar primero", "")
    for (const item of red) {
      const mod = modules[item.id]
      lines.push(`### ${item.id}: ${item.label}`)
      if (mod) lines.push(modLine(mod))
      lines.push("")
    }
  }

  // ── Fortalecer después (naranja) ──
  if (orange.length > 0) {
    lines.push("## Fortalecer después", "")
    for (const item of orange) {
      const mod = modules[item.id]
      lines.push(`### ${item.id}: ${item.label}`)
      if (mod) lines.push(modLine(mod))
      lines.push("")
    }
  }

  // ── Lo que ya funciona (verde) — sin links ──
  if (green.length > 0) {
    lines.push("## Lo que ya funciona", "")
    for (const item of green) {
      lines.push(`- **${item.id}:** ${item.label}`)
    }
    lines.push("")
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

// ─── DELETE: eliminar auditoría ───────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { request_id, user_id } = await req.json()
    if (!request_id || !user_id) {
      return NextResponse.json({ error: "Missing request_id or user_id" }, { status: 400 })
    }

    const supabase = getAdminSupabase()

    // Delete result first (FK constraint)
    await supabase
      .from("ai_diagnosis_results")
      .delete()
      .eq("request_id", request_id)

    // Delete request (verify ownership)
    const { error } = await supabase
      .from("ai_diagnosis_requests")
      .delete()
      .eq("id", request_id)
      .eq("user_id", user_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", detail: error?.message || "Unknown error" },
      { status: 500 }
    )
  }
}
