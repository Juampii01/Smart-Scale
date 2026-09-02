import { NextRequest, NextResponse, after } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"
import { zapierPosiSubmission, zapierPosiUnlock } from "@/lib/zapier"
import { POSI_MAX_FAILED_ATTEMPTS, isLevelApproved, resolveSkoolEmail } from "@/lib/posi"

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
      .select("id, client_id, level_id, answers, submitted_at, passed, wrong_question_ids, attempt_number, auto_approved, clients(name, nombre)")
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
    .select("id, level_id, answers, submitted_at, passed, attempt_number, auto_approved")
    .eq("client_id", clientId)
    .order("submitted_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ submissions: data ?? [] })
}

/** POST — responde un nivel: guarda las respuestas, califica (si el nivel
 *  tiene multiple_choice con correct_index) y dispara el webhook de Zapier
 *  (ZAPIER_WEBHOOK_POSI) con un aviso corto de aprobó/no aprobó — nunca el
 *  detalle de qué respondió mal, eso solo se ve en /admin/posi.
 *
 *  Auto-aprobado: al 3er intento fallido en el mismo nivel (ver
 *  POSI_MAX_FAILED_ATTEMPTS en lib/posi.ts), se guarda auto_approved=true
 *  sin tocar `passed` (sigue en false — es la nota real), y la respuesta
 *  de ESTE POST incluye un `feedback` con el detalle de qué erró.
 *
 *  Destrabe de Skool: si el nivel queda aprobado (real o auto-aprobado),
 *  intenta destrabar el curso del nivel siguiente vía ZAPIER_WEBHOOK_POSI_UNLOCK
 *  — deja rastro en posi_unlock_events (no hay API de lectura de Skool, es
 *  lo único con lo que se puede auditar esto). La respuesta solo expone
 *  `unlock.pending` y `unlock.level_title`, nunca el email ni el nombre del
 *  curso — eso es admin-only, en /admin/posi. */
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
    .select("id, level_number, title, questions")
    .eq("id", level_id)
    .maybeSingle()
  if (levelErr) return NextResponse.json({ error: levelErr.message }, { status: 500 })
  if (!level) return NextResponse.json({ error: "Nivel no encontrado" }, { status: 404 })

  const { passed, wrongIds } = gradeAnswers((level as any).questions ?? [], answers)

  // Cuenta de intentos: para calcular el auto-aprobado nos importan los
  // fallos previos en este nivel (passed=false — el .eq() ya deja afuera
  // tanto los aprobados como los passed=null de niveles no calificables).
  const { count: previousFailures, error: failuresErr } = await supabase
    .from("client_posi_submissions")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client_id)
    .eq("level_id", level_id)
    .eq("passed", false)
  if (failuresErr) return NextResponse.json({ error: failuresErr.message }, { status: 500 })

  // attempt_number es el número de intento de ESTE envío en el nivel: si es
  // un fallo, es su posición entre los fallos (para saber si es el 3ro). Si
  // no (aprobó, o el nivel no es calificable), no hace falta que cuente
  // contra el límite de auto-aprobado — usamos el total de filas previas +1
  // así el admin igual ve "intento #N" en cualquier caso.
  let attemptNumber: number
  if (passed === false) {
    attemptNumber = (previousFailures ?? 0) + 1
  } else {
    const { count: previousTotal, error: totalErr } = await supabase
      .from("client_posi_submissions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client_id)
      .eq("level_id", level_id)
    if (totalErr) return NextResponse.json({ error: totalErr.message }, { status: 500 })
    attemptNumber = (previousTotal ?? 0) + 1
  }

  const autoApproved = passed === false && attemptNumber >= POSI_MAX_FAILED_ATTEMPTS

  // Insert, no upsert — cada intento queda como fila propia (ej. reprobó y
  // volvió a responder, o aprobó y quiere reintentar de nuevo — sin límite,
  // haya aprobado o no). El historial completo se ve en /admin/posi; la
  // vista de cliente ya sabe tomar el intento más reciente por nivel.
  // Select explícito sin wrong_question_ids — no queremos que se filtre
  // por accidente en la respuesta (el cliente no debe verlo). `passed` NO
  // se pisa por el auto-aprobado — sigue siendo la nota real.
  const { data: saved, error: saveErr } = await supabase
    .from("client_posi_submissions")
    .insert({
      client_id, level_id, answers,
      passed,
      wrong_question_ids: wrongIds,
      attempt_number: attemptNumber,
      auto_approved: autoApproved,
      submitted_at: new Date().toISOString(),
    })
    .select("id, client_id, level_id, answers, submitted_at, passed, attempt_number, auto_approved")
    .single()
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  // `name` es legacy y en varias filas quedó con el email en vez del nombre
  // real (ver `nombre`) — mismo criterio de prioridad que ya usa el GET de
  // acá abajo y el resto de la app. Se necesita sincrónico (no solo en el
  // after() de más abajo) porque resolver el destrabe de Skool también
  // necesita skool_email antes de contestarle al cliente.
  const { data: client } = await supabase.from("clients").select("name, nombre, skool_email").eq("id", client_id).maybeSingle()
  const clientName = (client as any)?.nombre || (client as any)?.name || "Cliente"

  // ─── Destrabe automático del nivel siguiente en Skool ───────────────────
  // Se resuelve en dos tiempos: acá (sincrónico) decidimos y dejamos la fila
  // en posi_unlock_events — así el índice único reserva el lugar contra un
  // doble submit, y podemos contestarle al cliente si va a llegar el mail o
  // no. El webhook a Zapier (que ejecuta la acción de Skool) va en el
  // after() de más abajo. El auto-aprobado del 3er intento destraba igual
  // que un aprobado real — decisión explícita del negocio.
  let unlockPendingTitle: string | null = null
  let unlockDispatch: {
    eventId: string
    unlockLevelNumber: number
    unlockLevelTitle: string
    skoolEmail: string
    skoolCourseName: string
  } | null = null

  if (isLevelApproved({ passed, auto_approved: autoApproved })) {
    try {
      const nextLevelNumber = (level as any).level_number + 1
      const { data: nextLevel } = await supabase
        .from("posi_levels")
        .select("id, level_number, title, skool_course_name")
        .eq("level_number", nextLevelNumber)
        .maybeSingle()

      const baseRow = {
        client_id,
        submission_id: saved.id,
        approved_level_id: level_id,
        auto_approved: autoApproved,
      }

      if (!nextLevel) {
        await supabase.from("posi_unlock_events").insert({ ...baseRow, status: "skipped", reason: "ultimo_nivel" })
      } else if (!(nextLevel as any).skool_course_name) {
        await supabase.from("posi_unlock_events").insert({
          ...baseRow,
          unlock_level_id: (nextLevel as any).id,
          status: "skipped",
          reason: "sin_curso_configurado",
        })
      } else {
        const skoolEmail = resolveSkoolEmail(client as any)
        if (!skoolEmail) {
          await supabase.from("posi_unlock_events").insert({
            ...baseRow,
            unlock_level_id: (nextLevel as any).id,
            skool_course_name: (nextLevel as any).skool_course_name,
            status: "failed",
            reason: "sin_email",
          })
        } else {
          // Claim contra el índice único (client_id, unlock_level_id) — mismo
          // patrón que claim() en app/api/cron/call-reminders: insertamos
          // directo con status='pending' y dejamos que la constraint nos
          // diga si ya había una fila viva, en vez de un SELECT previo (hay
          // carrera real acá: doble click en el mismo formulario).
          const { data: claimed, error: claimErr } = await supabase
            .from("posi_unlock_events")
            .insert({
              ...baseRow,
              unlock_level_id: (nextLevel as any).id,
              skool_course_name: (nextLevel as any).skool_course_name,
              skool_email: skoolEmail,
              status: "pending",
            })
            .select("id")
            .single()

          if (claimErr) {
            // 23505 = unique_violation → ya había un destrabe pending/sent
            // para este (cliente, nivel), resultado esperado de la carrera.
            // Cualquier otro código es una falla de verdad.
            await supabase.from("posi_unlock_events").insert({
              ...baseRow,
              unlock_level_id: (nextLevel as any).id,
              skool_course_name: (nextLevel as any).skool_course_name,
              skool_email: skoolEmail,
              status: claimErr.code === "23505" ? "skipped" : "failed",
              reason: claimErr.code === "23505" ? "ya_destrabado" : `db_error: ${claimErr.message}`,
            })
          } else {
            unlockPendingTitle = (nextLevel as any).title
            unlockDispatch = {
              eventId: (claimed as any).id,
              unlockLevelNumber: (nextLevel as any).level_number,
              unlockLevelTitle: (nextLevel as any).title,
              skoolEmail,
              skoolCourseName: (nextLevel as any).skool_course_name,
            }
          }
        }
      }
    } catch (err) {
      // El destrabe es secundario a responder el nivel — un error acá nunca
      // debe romper la respuesta de la submission.
      console.error("[posi/submissions] error resolviendo destrabe:", err)
    }
  }

  after(async () => {
    await zapierPosiSubmission({
      event_type:     "posi.submitted",
      client_name:    clientName,
      level_title:    (level as any).title,
      passed,
      auto_approved:  autoApproved,
      attempt_number: attemptNumber,
    }).catch(() => {})

    if (unlockDispatch) {
      const payload = {
        event_type:             "posi.unlock" as const,
        unlock_event_id:        unlockDispatch.eventId,
        client_id,
        client_name:            clientName,
        skool_email:            unlockDispatch.skoolEmail,
        skool_course_name:      unlockDispatch.skoolCourseName,
        approved_level_number:  (level as any).level_number,
        approved_level_title:   (level as any).title,
        unlock_level_number:    unlockDispatch.unlockLevelNumber,
        unlock_level_title:     unlockDispatch.unlockLevelTitle,
        auto_approved:          autoApproved,
        attempt_number:         attemptNumber,
      }
      try {
        const zapierRes = await zapierPosiUnlock(payload)
        await supabase.from("posi_unlock_events").update({
          status:     zapierRes.ok ? "sent" : "failed",
          reason:     zapierRes.ok ? null : `webhook_error: ${zapierRes.error}`,
          payload,
          updated_at: new Date().toISOString(),
        }).eq("id", unlockDispatch.eventId)
      } catch (err: any) {
        // Nunca dejar la fila colgada en 'pending' — si el fetch mismo
        // explota (no solo un !res.ok), la marcamos failed igual.
        try {
          await supabase.from("posi_unlock_events").update({
            status:     "failed",
            reason:     `webhook_error: ${err?.message ?? "unknown"}`,
            payload,
            updated_at: new Date().toISOString(),
          }).eq("id", unlockDispatch.eventId)
        } catch {}
      }
    }
  })

  const unlock = { pending: unlockPendingTitle !== null, level_title: unlockPendingTitle }

  // wrong_question_ids no se manda en la respuesta — el cliente no tiene
  // que enterarse de cuáles falló, solo si aprobó o no (pedido explícito).
  // Única excepción: el auto-aprobado por 3er intento fallido, donde sí se
  // le muestra el detalle de lo que erró (pedido explícito de Ann) — pero
  // solo acá, en la respuesta de la submission recién creada, nunca en el
  // GET (si no, cualquier cliente se arma el respuestario pidiendo sus
  // intentos viejos). `unlock` nunca incluye skool_email, skool_course_name
  // ni el id del evento — eso es solo para /admin/posi.
  if (!autoApproved) {
    return NextResponse.json({ submission: saved, unlock })
  }

  const questionsById = new Map(((level as any).questions ?? []).map((q: any) => [q.id, q]))
  const feedback = {
    auto_approved:  true,
    attempt_number: attemptNumber,
    wrong: wrongIds.map((qid) => {
      const q = questionsById.get(qid) as any
      const yourIdx = (answers as Record<string, unknown>)[qid]
      const options: string[] = q?.options ?? []
      return {
        id: qid,
        label: q?.label ?? "",
        your_answer: typeof yourIdx === "number" ? (options[yourIdx] ?? null) : null,
        correct_answer: typeof q?.correct_index === "number" ? (options[q.correct_index] ?? null) : null,
      }
    }),
  }

  return NextResponse.json({ submission: saved, feedback, unlock })
}
