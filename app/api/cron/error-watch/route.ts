/**
 * Cron de Error Watch — corre cada 30 min.
 *
 * 1. Revisa diagnósticos "diagnosing" pendientes (sesiones del Constructor
 *    ya disparadas) — si terminaron, avisa por push y guarda el reporte.
 * 2. Busca errores/warnings NUEVOS en app_logs (dedupeados por firma) y le
 *    pide al Constructor un diagnóstico de solo lectura — nunca aplica un
 *    fix solo, eso sigue siendo decisión manual.
 *
 * Auth: Vercel Cron envía Authorization: Bearer ${CRON_SECRET}.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { checkPendingDiagnoses, dispatchNewErrors } from "@/lib/error-watch"
import { logJobRun } from "@/lib/system-log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sb = createServiceClient()

  try {
    const pendingResult = await checkPendingDiagnoses(sb)
    const newResult = await dispatchNewErrors(sb)

    await logJobRun(sb, "error-watch", "ok", JSON.stringify({ ...pendingResult, ...newResult }))
    return NextResponse.json({ ok: true, ...pendingResult, ...newResult })
  } catch (err: any) {
    await logJobRun(sb, "error-watch", "error", err?.message ?? "unknown error")
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 })
  }
}
