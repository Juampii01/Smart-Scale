import { NextRequest, NextResponse, after } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin } from "@/lib/auth/permissions"
import { notifyPosiLevelPassed } from "@/lib/slack"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function authorize(jwt: string | null, requestedClientId: string) {
  if (!jwt) return { ok: false as const, status: 401, message: "Unauthorized" }
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return { ok: false as const, status: 401, message: "Unauthorized" }

  const { data: profile } = await supabase.from("profiles").select("role, client_id").eq("id", user.id).maybeSingle()
  const role = String(profile?.role ?? "").toLowerCase()
  const ownClientId = (profile as any)?.client_id ?? null

  if (isAdmin(role)) return { ok: true as const, user, role, ownClientId }
  if (!ownClientId || ownClientId !== requestedClientId) return { ok: false as const, status: 403, message: "Forbidden" }
  return { ok: true as const, user, role, ownClientId }
}

/** GET — submissions de un cliente (propias, o de cualquiera si admin) */
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("client_id")
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 })

  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const auth = await authorize(jwt, clientId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("client_posi_submissions")
    .select("id, level_id, score, passed, submitted_at")
    .eq("client_id", clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ submissions: data ?? [] })
}

/** POST — responde un nivel: calcula score sobre las multiple_choice, guarda,
 *  y si aprueba por primera vez avisa a Slack. */
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
    .select("id, title, passing_score, questions")
    .eq("id", level_id)
    .maybeSingle()
  if (levelErr) return NextResponse.json({ error: levelErr.message }, { status: 500 })
  if (!level) return NextResponse.json({ error: "Nivel no encontrado" }, { status: 404 })

  // Score: solo sobre las preguntas multiple_choice (las "open" quedan
  // guardadas para revisión manual, no puntúan automático).
  const mcQuestions = ((level as any).questions ?? []).filter((q: any) => q.type === "multiple_choice")
  const correctCount = mcQuestions.filter((q: any) => answers[q.id] === q.correct_index).length
  const score = mcQuestions.length > 0 ? Math.round((correctCount / mcQuestions.length) * 100) : 0
  const passed = score >= (level as any).passing_score

  const { data: existing } = await supabase
    .from("client_posi_submissions")
    .select("passed")
    .eq("client_id", client_id)
    .eq("level_id", level_id)
    .maybeSingle()

  const { data: saved, error: saveErr } = await supabase
    .from("client_posi_submissions")
    .upsert({
      client_id, level_id, answers, score, passed,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "client_id,level_id" })
    .select()
    .single()
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })

  // Avisa a Slack solo la primera vez que aprueba este nivel (no en reintentos ya aprobados)
  if (passed && !(existing as any)?.passed) {
    after(async () => {
      const { data: client } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle()
      const clientName = (client as any)?.name ?? "Cliente"
      await notifyPosiLevelPassed({ client_name: clientName, level_title: (level as any).title, score }).catch(() => {})
    })
  }

  return NextResponse.json({ submission: saved, score, passed })
}
