import { NextRequest, NextResponse } from "next/server"
import { requireInternal } from "@/lib/auth/api-guards"
import {
  getClientsByCloser,
  getClientsWithoutCloser,
  setClientCloser,
  setClientCloserBulk,
  getCloserSummary,
} from "@/lib/crm/client-helpers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/crm/client-closer
 *
 * Get client-closer relationship info
 *
 * Query params:
 *   type     string — "summary" | "by-closer" | "without-closer"
 *   closer_id uuid  — (for "by-closer" type)
 */
export async function GET(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const caller = await requireInternal(jwt)
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const type = req.nextUrl.searchParams.get("type") || "summary"
    const closerId = req.nextUrl.searchParams.get("closer_id")

    if (type === "summary") {
      const summary = await getCloserSummary()
      return NextResponse.json({ ok: true, summary })
    }

    if (type === "by-closer") {
      if (!closerId) {
        return NextResponse.json({ error: "closer_id is required" }, { status: 400 })
      }
      const clients = await getClientsByCloser(closerId)
      return NextResponse.json({ ok: true, clients })
    }

    if (type === "without-closer") {
      const clients = await getClientsWithoutCloser()
      return NextResponse.json({ ok: true, clients, count: clients.length })
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 })
  } catch (err: any) {
    console.error("Error in /api/admin/crm/client-closer:", err)
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/crm/client-closer
 *
 * Set closer for one or more clients
 *
 * Body:
 *   client_ids  string[] — IDs of clients to update
 *   closer_id   uuid     — ID of the closer to assign
 */
export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const caller = await requireInternal(jwt)
    if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const clientIds = body.client_ids as string[]
    const closerId = body.closer_id as string

    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return NextResponse.json({ error: "client_ids array is required" }, { status: 400 })
    }

    if (!closerId) {
      return NextResponse.json({ error: "closer_id is required" }, { status: 400 })
    }

    if (clientIds.length === 1) {
      const result = await setClientCloser(clientIds[0], closerId)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
    } else {
      const result = await setClientCloserBulk(clientIds, closerId)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      message: `${clientIds.length} client(s) assigned to closer`,
      updated_count: clientIds.length,
    })
  } catch (err: any) {
    console.error("Error in POST /api/admin/crm/client-closer:", err)
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 })
  }
}
