import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? ""
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { client_id, fecha, valor_trato, cash_collected, proximo_nivel, notas } = body
    const proximoObjetivo = body.proximo_objetivo ?? body.proximoNivel ?? proximo_nivel ?? null

    if (!client_id || !fecha || !valor_trato || !cash_collected) {
      return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 })
    }

    // Resolve client name
    let clientName = client_id
    const { data: clientRow } = await supabase
      .from("clients")
      .select("nombre")
      .eq("id", client_id)
      .maybeSingle()

    if (clientRow?.nombre) clientName = clientRow.nombre

    const nivelEmojiMap: Record<string, string> = {
      "$5K":   "🔴",
      "$10K":  "🔵",
      "$20K":  "🟣",
      "$50K":  "🟡",
      "$100K": "🟢",
    }
    const nivelEmoji = proximo_nivel ? (nivelEmojiMap[proximo_nivel] ?? "") : null
    const proximoNivelConEmoji = proximo_nivel
      ? `${nivelEmoji} ${proximo_nivel}`
      : null

    const payload = {
      event_type:              "chi_chang.new_deal",
      client_id,
      client_name:             clientName,
      submitted_by:            user.email,
      fecha,
      valor_trato:             Number(valor_trato),
      cash_collected:          Number(cash_collected),
      proximo_nivel:           proximoObjetivo,
      proximo_objetivo:        proximoObjetivo,
      proximo_nivel_con_emoji: proximoNivelConEmoji,
      proximo_nivel_emoji:     nivelEmoji,
      notas:                   notas || null,
      timestamp:               new Date().toISOString(),
    }

    const webhookUrl = process.env.ZAPIER_WEBHOOK_CHI_CHANG
    if (!webhookUrl) {
      console.warn("[chi-chang] No webhook URL configured")
      return NextResponse.json({ ok: true, warning: "Webhook no configurado" })
    }

    const zapierRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!zapierRes.ok) {
      const text = await zapierRes.text().catch(() => "")
      console.error("[chi-chang] Zapier error:", zapierRes.status, text)
      return NextResponse.json(
        { error: `Zapier respondió con error ${zapierRes.status}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, client_name: clientName })
  } catch (err: any) {
    console.error("[chi-chang] error:", err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
