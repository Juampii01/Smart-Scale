
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function getAdminSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment variables")
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
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
      {
        error: "Internal server error",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      prompt,
      auditType,
      annualRevenue,
      selectedMonth,
      clientId,
      userId,
    } = body ?? {}

    if (!prompt || typeof prompt !== "string" || !userId) {
      return NextResponse.json(
        { error: "Missing prompt or userId" },
        { status: 400 }
      )
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables" },
        { status: 500 }
      )
    }

    const supabase = getAdminSupabase()

    const { data: insertedRequests, error: requestError } = await supabase
      .from("ai_diagnosis_requests")
      .insert({
        user_id: userId,
        prompt,
        audit_type: auditType ?? null,
        annual_revenue: annualRevenue ?? null,
        selected_month: selectedMonth ?? null,
        client_id: clientId ?? null,
        status: "pending",
      })
      .select("id")
      .limit(1)

    const requestData = Array.isArray(insertedRequests)
      ? insertedRequests[0]
      : insertedRequests

    if (requestError) {
      return NextResponse.json(
        { error: "Error al guardar el request", detail: requestError.message },
        { status: 500 }
      )
    }

    if (!requestData?.id) {
      return NextResponse.json(
        { error: "No se pudo obtener el id del request recién creado" },
        { status: 500 }
      )
    }

    const requestId = requestData.id

    const { error: workerError } = await supabase.functions.invoke(
      "ai-diagnosis-worker",
      {
        body: { request_id: requestId },
      }
    )

    if (workerError) {
      await supabase
        .from("ai_diagnosis_requests")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)

      return NextResponse.json(
        {
          error: "No se pudo disparar ai-diagnosis-worker",
          detail: workerError.message,
          request_id: requestId,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: "Diagnóstico en proceso. Consulta el historial en unos segundos.",
      request_id: requestId,
      status: "pending",
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Internal server error",
        detail:
          error?.name === "AbortError"
            ? "La invocación del worker tardó demasiado. Intenta nuevamente."
            : error?.message || "Unknown error",
      },
      { status: 500 }
    )
  }
}
