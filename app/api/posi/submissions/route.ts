import { NextRequest, NextResponse, after } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"
import { zapierPosiSubmission } from "@/lib/zapier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Califica contra `correct_index` — solo las multiple_choice que lo tienen
 *  definido cuentan (las demás preguntas, y las MC sin respuesta "correcta"
 *  marcada, no afectan el resultado). `passed=null` si el nivel no tiene
 *  ninguna pregunta calificable (no hay concepto de aprobar/reprobar ahí). */
function gradeAnswers(questions: any[], answers: Record<string, unknown>) {
  const graded = (questions ?? []).filter((q) => q.type === "multiple_choice" && typeof q.correct_index === "number")
  if (graded.length === 0) return { passed: null as boolean | null, wrongIds: [] as string[] }
  const wrongIds = graded.filter((q) => answers[q.id] !== q.correct_index).map((q) => q.id)
  return { passed: wrongIds.length === 0, wrongIds }
}

async function authorize(jwt: string | null, requestedClientId: string | null) {
  if (!jwt) return { ok: false as const, status: 401, message: "Unauthorized" }
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return { ok: false as const, status: 401, message: "Unauthorized" }

  const { data: profile } = await supabase.from("profiles").select("role, client_id").eq("id", user.id).maybeSingle()
  const role = String(profile?.role ?? "").toLowerCase()
  const ownClientId = (profile as any)?.client_id ?? null

  if (isAdmin(role)) return { ok: true as const, user, role, ownClientId }
  if (!requestedClientId || !ownClientId || ownClientId !== requestedClientId) return { ok: false as const, status: 403, message: "Forbidden" }
  return { ok: true as const, user, role, ownClientId }
}

/** GET — submissions de un cliente (propias, o de cualquiera si admin).
 *  Admin sin client_id: todas las submissions con el nombre del cliente
 *  (sector Founder → POSI, tabla de respuestas recibidas). */
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id")
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const auth = await authorize(jwt, clientId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()

  if (!clientId) {
    if (!isAdmin(auth.role)) return NextResponse.json({ error: "client_id is required" }, { status: 400 })
    // wrong_question_ids solo para admin — ver qué falló, nunca se lo
    // mandamos al cliente (para que no lo use como respuestario).
    const { data, error } = await supabase
      .from("client_posi_submissions")
      .select("id, client_id, level_id, answers, submitted_at, passed, wrong_question_ids, clients(name, nombre)")
      .order("submitted_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const submissions = (data ?? []).map((r: any) => ({
      ...r,
      client_name: r.clients?.nombre || r.clients?.name || "—",
      clients: undefined,
    }))
    return NextResponse.json({ submissions })
  }

  // Un cliente puede tener varios intentos del mismo nivel (ej. reprobó y
  // volvió a responder) — se guardan todos, más nuevo primero, para que
  // quien lea el array con .find() por level_id agarre el intento vigente.
  const { data, error } = await supabase
    .from("client_posi_submissions")
    .select("id, level_id, answers, submitted_at, passed")
    .eq("client_id", clientId)
    .order("submitted_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ submissions: data ?? [] })
}

/** POST — responde un nivel: guarda las respuestas, califica (si el nivel
 *  tiene multiple_choice con correct_index) y dispara el webhook de Zapier
 *  (ZAPIER_WEBHOOK_POSI) con un aviso corto de aprobó/no aprobó — nunca el
 *  detalle de qué respondió mal, eso solo se ve en /admin/posi. */
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { client_id, level_id, answers } = body ?? {}
  if (!client_id || !level_id || typeof answers !== "object") {
    return NextResponse.json({ error: "client_id, level_id, answers required" }, { status: 400 })
  }

  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const auth = await authorize(jwt, client_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const { data: level, error: levelErr } = await supabase
    .from("posi_levels")
    .select("id, title, questions")
    .eq("id", level_id)
    .maybeSingle()
  if (levelErr) return NextResponse.json({ error: levelErr.message }, { status: 500 })
  if (!level) return NextResponse.json({ error: "Nivel no encontrado" }, { status: 404 })

  const { passed, wrongIds } = gradeAnswers((level as any).questions ?? [], answers)

  // Insert, no upsert — cada intento queda como fila propia (ej. reprobó y
  // volvió a responder). El historial completo se ve en /admin/posi; la
  // vista de cliente ya sabe tomar el intento más reciente por nivel.
  // Select explícito sin wrong_question_ids — no queremos que se filtre
  // por accidente en la respuesta (el cliente no debe verlo).
  const { data: saved, error: saveErr } = await supabase
    .from("client_posi_submissions")
    .insert({
      client_id, level_id, answers,
      passed,
      wrong_question_ids: wrongIds,
      submitted_at: new Date().toISOString(),
    })
    .select("id, client_id, level_id, answers, submitted_at, passed")
    .single()
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  after(async () => {
    // `name` es legacy y en varias filas quedó con el email en vez del
    // nombre real (ver `nombre`) — mismo criterio de prioridad que ya usa
    // el GET de acá abajo y el resto de la app.
    const { data: client } = await supabase.from("clients").select("name, nombre").eq("id", client_id).maybeSingle()
    const clientName = (client as any)?.nombre || (client as any)?.name || "Cliente"
    await zapierPosiSubmission({
      event_type:  "posi.submitted",
      client_name: clientName,
      level_title: (level as any).title,
      passed,
    }).catch(() => {})
  })

  // wrong_question_ids no se manda en la respuesta — el cliente no tiene
  // que enterarse de cuáles falló, solo si aprobó o no (pedido explícito).
  return NextResponse.json({ submission: saved })
}
