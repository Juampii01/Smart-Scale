import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()
  const { data } = await sb
    .from("omni_instagram_connections")
    .select("account_name, account_pic, scopes, connected_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ connection: data ?? null })
}
