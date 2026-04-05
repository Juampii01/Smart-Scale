import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function DELETE(req: NextRequest) {
  try {
    // Auth: verify JWT
    const authHeader = req.headers.get("authorization") ?? ""
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

    const supabase = createServiceClient()

    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can delete reports
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    const role = (prof as any)?.role as string | undefined
    if ((role ?? "").toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 })
    }

    // Parse body
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const reportId = typeof body.id === "string" ? body.id : null
    if (!reportId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const { error: deleteErr } = await supabase
      .from("monthly_reports")
      .delete()
      .eq("id", reportId)

    if (deleteErr) {
      console.error("[monthly-reports/delete] Delete error:", deleteErr)
      return NextResponse.json({ error: `Database error: ${deleteErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[monthly-reports/delete] Unexpected error:", err)
    return NextResponse.json({ error: err?.message ?? "Internal server error" }, { status: 500 })
  }
}
