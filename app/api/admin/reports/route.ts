import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_FIELDS = new Set([
  // Revenue
  "cash_collected", "total_revenue", "mrr",
  "software_costs", "variable_costs", "ad_spend",
  // Sales
  "scheduled_calls", "attended_calls", "qualified_calls",
  "inbound_messages", "aplications",
  "offer_docs_sent", "offer_docs_responded", "cierres_por_offerdoc",
  "new_clients", "active_clients",
  // Instagram
  "short_followers", "short_reach", "short_posts",
  // YouTube
  "yt_subscribers", "yt_new_subscribers", "yt_monthly_audience",
  "yt_views", "yt_watch_time", "yt_videos",
  // Email
  "email_subscribers", "email_new_subscribers",
  // Other
  "nps_score",
])

/** PATCH /api/admin/reports
 *  Body: { client_id, month, field, value }
 *  Upserts the specific field in monthly_reports.
 *  Only accessible to admins (role = 'admin' in profiles).
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? ""
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServiceClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt)
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile || String(profile.role ?? "").toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let body: { client_id?: string; month?: string; field?: string; value?: number | null }
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const { client_id, month, field, value } = body
    if (!client_id || !month || !field) {
      return NextResponse.json({ error: "client_id, month and field are required" }, { status: 400 })
    }
    if (!ALLOWED_FIELDS.has(field)) {
      return NextResponse.json({ error: `Field '${field}' is not allowed` }, { status: 400 })
    }

    // Normalize month to YYYY-MM-01
    const monthDate = `${String(month).slice(0, 7)}-01`

    const { error: upsertErr } = await supabase
      .from("monthly_reports")
      .upsert(
        { client_id, month: monthDate, [field]: value },
        { onConflict: "client_id,month" }
      )

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
