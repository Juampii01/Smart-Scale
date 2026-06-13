
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { rateLimit } from "@/lib/rate-limit"
import Anthropic from "@anthropic-ai/sdk"

// Helper: extrae el usuario autenticado del JWT (cualquier rol sirve)
async function getAuthedUser(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user } } = await supabase.auth.getUser(jwt)
  return user ?? null
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

// ─── Module maps (Skool) ──────────────────────────────────────────────────────

type SkoolModule = { name: string; level: string }

// +$20k → F1-F3, E1-E3, T1-T3, I1-I3
const MODULES_MAS20K: Record<string, SkoolModule> = {
  F1: { name: "La Ingeniera de un Simple Post",        level: "Nivel 5" },
  F2: { name: "Productividad y Calendario Optimizado", level: "Nivel 5" },
  F3: { name: "5 prospectos al dia - Persegui el NO",  level: "Nivel 6" },
  E1: { name: "Cadencia de Emails semanales",          level: "Nivel 4" },
  E2: { name: "CRM y Base de Datos",                   level: "Nivel 8" },
  E3: { name: "DM to Chat — Priorizacion de tu Pipeline", level: "Nivel 6" },
  T1: { name: "Investigacion de Mercado",              level: "Nivel 3" },
  T2: { name: "Recoleccion de Prueba Social",          level: "Nivel 3" },
  T3: { name: "Una Simple Oferta | Blueprint",         level: "Nivel 3" },
  I1: { name: "Tu Programa Matadolor™",                level: "Nivel 3" },
  I2: { name: "Onboarding Proceso",                    level: "Nivel 3" },
  I3: { name: "Delivery Escalable",                    level: "Nivel 3" },
}

// -$20k → F4-F6, E4-E6, T4-T6, I4-I6
const MODULES_MENOS20K: Record<string, SkoolModule> = {
  F4: { name: "La Ingeniera de un Simple Post",        level: "Nivel 5" },
  F5: { name: "Contenido que Conecta y Convierte",     level: "Nivel 5" },
  F6: { name: "Productividad y Calendario Optimizado", level: "Nivel 5" },
  E4: { name: "Fundamentos del formato largo",         level: "Nivel 7" },
  E5: { name: "Un Simple Video (VSL)",                 level: "Nivel 6" },
  E6: { name: "Quick Cash DM Ads",                     level: "Nivel 5" },
  T4: { name: "Comunidad Solida",                      level: "Nivel 3" },
  T5: { name: "De Operador a CEO",                     level: "Nivel 3" },
  T6: { name: "SOP | Como crear Caso de Exito en Youtube", level: "Nivel 3" },
  I4: { name: "Creacion de Tu Simple Oferta",          level: "Nivel 3" },
  I5: { name: "Tu World Class Delivery",               level: "Nivel 3" },
  I6: { name: "IA & Sistemas",                         level: "Nivel 8" },
}

// ─── Pillar metadata ──────────────────────────────────────────────────────────

const PILLAR_NAMES: Record<string, string> = {
  F: "FASCINATE",
  E: "EDUCATE",
  T: "TRANSFORM",
  I: "INVITE",
}

const PILLAR_DOMAINS: Record<string, string> = {
  F: "atracción de leads, contenido corto, crecimiento de audiencia y consistencia",
  E: "demanda orgánica, contenido largo, email marketing y automatización de nurturing",
  T: "oferta principal, casos de éxito, prueba social y comunidad",
  I: "sistema de prospección, onboarding, delivery sin depender de vos",
}

// Tie-break order: cuando 2 pilares empatan en score, gana el que está antes en esta lista
const TIE_BREAK_ORDER = ["E", "F", "T", "I"]

// ─── Parse user answers ───────────────────────────────────────────────────────

type Color = "red" | "yellow" | "green"
type AnsweredItem = { id: string; label: string; color: Color }

function parsePrompt(prompt: string): AnsweredItem[] {
  const items: AnsweredItem[] = []
  const lineRe = /^\s*-\s*\[(ROJO|NARANJA|VERDE)\]\s+([A-Z]\d+):\s+(.+)$/

  for (const line of prompt.split("\n")) {
    const m = line.match(lineRe)
    if (!m) continue
    const [, colorEs, id, label] = m
    const color: Color = colorEs === "ROJO" ? "red" : colorEs === "NARANJA" ? "yellow" : "green"
    items.push({ id, label: label.trim(), color })
  }
  return items
}

// ─── Score & classify ─────────────────────────────────────────────────────────

const colorPoints = (c: Color) => (c === "green" ? 2 : c === "yellow" ? 1 : 0)

function classify(puntos: number): "Sólido" | "En construcción" | "Cuello de botella" {
  if (puntos >= 5) return "Sólido"
  if (puntos >= 3) return "En construcción"
  return "Cuello de botella"
}

type PillarScore = {
  pillar: string                         // "F" | "E" | "T" | "I"
  name: string                           // "FASCINATE", etc.
  puntos: number
  estado: "Sólido" | "En construcción" | "Cuello de botella"
  items: { id: string; color: Color | null }[]   // 3 ítems en orden
}

function computeScores(answers: AnsweredItem[], auditType: string): PillarScore[] {
  const allItemIds = auditType === "mas20k"
    ? ["F1","F2","F3","E1","E2","E3","T1","T2","T3","I1","I2","I3"]
    : ["F4","F5","F6","E4","E5","E6","T4","T5","T6","I4","I5","I6"]

  const colorById = new Map(answers.map(a => [a.id, a.color]))

  const result: PillarScore[] = []
  for (const pillar of ["F", "E", "T", "I"]) {
    const pillarItems = allItemIds.filter(id => id.startsWith(pillar))
    const items = pillarItems.map(id => ({ id, color: colorById.get(id) ?? null }))
    const puntos = items.reduce((sum, it) => sum + (it.color ? colorPoints(it.color) : 0), 0)
    result.push({
      pillar,
      name: PILLAR_NAMES[pillar],
      puntos,
      estado: classify(puntos),
      items,
    })
  }
  return result
}

// ─── Decide focos (2 pilares con menor score) ─────────────────────────────────

function pickFocos(scores: PillarScore[]): PillarScore[] {
  // Ordená por score asc; en empate, usar TIE_BREAK_ORDER (E > F > T > I)
  const sorted = [...scores].sort((a, b) => {
    if (a.puntos !== b.puntos) return a.puntos - b.puntos
    return TIE_BREAK_ORDER.indexOf(a.pillar) - TIE_BREAK_ORDER.indexOf(b.pillar)
  })
  // Tomar los 2 con menor score (siempre devolver 2 como en el screenshot)
  return sorted.slice(0, 2)
}

// ─── Resolve Skool module for a foco ──────────────────────────────────────────

function resolveSkoolModule(foco: PillarScore, auditType: string): SkoolModule | null {
  const modules = auditType === "mas20k" ? MODULES_MAS20K : MODULES_MENOS20K
  // Item peor puntuado del pilar (red > yellow > green). Si todos sin responder, primer ítem.
  const colorRank: Record<string, number> = { red: 0, yellow: 1, green: 2 }
  const sorted = [...foco.items].sort((a, b) => {
    const ra = a.color ? colorRank[a.color] : 99
    const rb = b.color ? colorRank[b.color] : 99
    return ra - rb
  })
  const worst = sorted[0]
  return worst ? (modules[worst.id] ?? null) : null
}

// ─── Generate diagnostics with Claude ─────────────────────────────────────────

type FocoCopy = { titulo: string; diagnostico: string }

async function generateFocoCopy(focos: PillarScore[], answers: AnsweredItem[]): Promise<FocoCopy[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY")

  const anthropic = new Anthropic({ apiKey })

  const labelById = new Map(answers.map(a => [a.id, a.label]))
  const focosForPrompt = focos.map((f, idx) => {
    const weak = f.items
      .filter(it => it.color === "red" || it.color === "yellow")
      .map(it => `  - [${it.color === "red" ? "ROJO" : "NARANJA"}] ${it.id}: ${labelById.get(it.id) ?? ""}`)
      .join("\n")
    return `FOCO ${idx + 1} — Pilar ${f.name} (score ${f.puntos}/6, estado: ${f.estado})
Dominio: ${PILLAR_DOMAINS[f.pillar]}
Debilidades del cliente:
${weak || "  - (ninguna debilidad concreta — el pilar está sólido pero es de los más bajos)"}`
  }).join("\n\n")

  const prompt = `Sos coach de negocio para emprendedoras de coaching y cursos online dentro del programa Smart Scale. Estás generando los 2 focos prioritarios de un audit trimestral del Ecosistema Circular (FASCINATE → EDUCATE → TRANSFORM → INVITE).

${focosForPrompt}

Para cada foco, generá:
1. "titulo": un título corto en formato "<Pilar capitalizado> — <2-4 palabras del problema>". Ejemplos: "Educate — Nutrición y demanda", "Transform — Oferta y prueba social", "Fascinate — Atracción y consistencia", "Invite — Onboarding y delivery". Usá el nombre del pilar exactamente como aparece (Educate / Fascinate / Transform / Invite).
2. "diagnostico": 2-3 oraciones en segunda persona (vos), directa, sin lenguaje motivacional vacío. Explicá qué falta concretamente y por qué eso limita el crecimiento. No uses la palabra "cuello de botella". No menciones literalmente las afirmaciones del audit. Tono ejecutivo y específico.

Respondé SOLO con un JSON array de exactamente ${focos.length} objetos. Sin markdown, sin texto adicional.
Ejemplo:
[
  {"titulo": "Educate — Nutrición y demanda", "diagnostico": "Tu mayor brecha está en construir demanda real antes de que los leads lleguen. Sin contenido largo activo y sin automatizaciones de nurturing, dependés de tu presencia manual en cada venta. Eso limita tu capacidad de escalar sin quemarte."},
  {"titulo": "Transform — Oferta y prueba social", "diagnostico": "..."}
]`

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  })

  const raw = msg.content.find(b => b.type === "text")
  const text = raw?.type === "text" ? raw.text.trim() : "[]"
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim()
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed)) throw new Error("LLM did not return array")
  return parsed as FocoCopy[]
}

// ─── Build full diagnosis JSON ────────────────────────────────────────────────

async function buildDiagnosis(prompt: string, auditType: string): Promise<string> {
  const answers = parsePrompt(prompt)
  const scores  = computeScores(answers, auditType)
  const focos   = pickFocos(scores)

  let copies: FocoCopy[] = []
  try {
    copies = await generateFocoCopy(focos, answers)
  } catch {
    // Fallback determinístico si la IA falla
    copies = focos.map(f => ({
      titulo: `${f.name.charAt(0)}${f.name.slice(1).toLowerCase()} — Foco prioritario`,
      diagnostico: `Tu pilar ${f.name} tiene un score de ${f.puntos}/6 (${f.estado}). Es de los más bajos de tu ecosistema y conviene atacarlo este trimestre antes de avanzar con el resto.`,
    }))
  }

  const focosOut = focos.map((f, idx) => {
    const skool = resolveSkoolModule(f, auditType)
    const label = idx === 0
      ? "Prioridad 1 — Ataca esto primero"
      : `Prioridad 2 — Una vez estabilices ${focos[0].name.charAt(0)}${focos[0].name.slice(1).toLowerCase()}`
    return {
      prioridad: idx + 1,
      modulo: f.name,
      etiqueta: label,
      titulo: copies[idx]?.titulo ?? `${f.name} — Foco prioritario`,
      diagnostico: copies[idx]?.diagnostico ?? "",
      skool_modulo: skool?.name ?? null,
      skool_nivel: skool?.level ?? null,
    }
  })

  const out = {
    version: 1,
    segmento: auditType === "mas20k" ? "+20K" : "-20K",
    scores: Object.fromEntries(scores.map(s => [s.pillar.toLowerCase(), {
      name: s.name,
      puntos: s.puntos,
      estado: s.estado,
      items: s.items,
    }])),
    focos: focosOut,
  }

  return JSON.stringify(out)
}

// ─── GET: poll status ─────────────────────────────────────────────────────────

function getAdminSupabase() {
  return createServiceClient()
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

// ─── POST: build diagnóstico (IA + determinístico) ────────────────────────────

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { bucket: "ai-diagnosis", limit: 10, windowMs: 60_000 })
  if (limited) return limited
  // Auth: cualquier usuario autenticado puede generar diagnósticos propios
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { prompt, auditType, annualRevenue, selectedMonth, clientId } = body ?? {}

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 })
    }

    // userId SIEMPRE viene del JWT, no del body (previene forjar user_id ajeno)
    const userId = user.id

    const supabase = getAdminSupabase()

    const result = await buildDiagnosis(prompt, auditType ?? "menos20k")

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

    await supabase.from("ai_diagnosis_results").insert({
      request_id:   requestId,
      result,
      raw_response: null,
      created_at:   new Date().toISOString(),
    })

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
  // user_id viene del JWT — no se acepta del body para evitar borrar datos ajenos
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { request_id } = await req.json()
    if (!request_id) {
      return NextResponse.json({ error: "Missing request_id" }, { status: 400 })
    }

    const supabase = getAdminSupabase()

    await supabase
      .from("ai_diagnosis_results")
      .delete()
      .eq("request_id", request_id)

    const { error } = await supabase
      .from("ai_diagnosis_requests")
      .delete()
      .eq("id", request_id)
      .eq("user_id", user.id) // solo puede borrar sus propios registros

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
