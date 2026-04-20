import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireAdmin(jwt: string | null) {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (String(profile?.role ?? "").toLowerCase() !== "admin") return null
  return user
}

/** GET — all clients with their installments and followups */
export async function GET(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()

    const { data: clients, error: clientsError } = await supabase
      .from("crm_clients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000)

    if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 })

    const { data: installments, error: installmentsError } = await supabase
      .from("crm_installments")
      .select("*")
      .order("installment_number", { ascending: true })

    if (installmentsError) return NextResponse.json({ error: installmentsError.message }, { status: 500 })

    const { data: followups, error: followupsError } = await supabase
      .from("crm_followups")
      .select("*")
      .order("scheduled_date", { ascending: true })

    if (followupsError) return NextResponse.json({ error: followupsError.message }, { status: 500 })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Compute installment status on the fly
    const enrichedInstallments = (installments ?? []).map((inst: any) => {
      let status: "pagado" | "vencido" | "pendiente"
      if (inst.paid_at) {
        status = "pagado"
      } else {
        const due = new Date(inst.due_date)
        due.setHours(0, 0, 0, 0)
        status = due < today ? "vencido" : "pendiente"
      }
      return { ...inst, status }
    })

    // Group installments and followups by client_id
    const installmentsByClient: Record<string, any[]> = {}
    for (const inst of enrichedInstallments) {
      if (!installmentsByClient[inst.client_id]) installmentsByClient[inst.client_id] = []
      installmentsByClient[inst.client_id].push(inst)
    }

    const followupsByClient: Record<string, any[]> = {}
    for (const fu of (followups ?? [])) {
      if (!followupsByClient[fu.client_id]) followupsByClient[fu.client_id] = []
      followupsByClient[fu.client_id].push(fu)
    }

    const result = (clients ?? []).map((client: any) => ({
      ...client,
      installments: installmentsByClient[client.id] ?? [],
      followups:    followupsByClient[client.id]    ?? [],
    }))

    return NextResponse.json({ clients: result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** POST — create client with installments, or add a followup */
export async function POST(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const supabase = createServiceClient()

    // Follow-up creation
    if (body.type === "followup") {
      const { client_id, scheduled_date, followup_type, notes } = body
      if (!client_id || !scheduled_date) {
        return NextResponse.json({ error: "client_id and scheduled_date are required" }, { status: 400 })
      }
      const { data, error } = await supabase
        .from("crm_followups")
        .insert({
          client_id,
          scheduled_date,
          type:  followup_type ?? "whatsapp",
          notes: notes || null,
          completed: false,
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ followup: data })
    }

    // Client creation
    const { name, email, instagram, phone, program_start, num_installments, installment_amount, notes } = body
    if (!name || !program_start || !num_installments || installment_amount == null) {
      return NextResponse.json({ error: "name, program_start, num_installments and installment_amount are required" }, { status: 400 })
    }

    const { data: client, error: clientError } = await supabase
      .from("crm_clients")
      .insert({
        name,
        email:              email || null,
        instagram:          instagram || null,
        phone:              phone || null,
        program_start,
        num_installments:   Number(num_installments),
        installment_amount: Number(installment_amount),
        status:             "activo",
        notes:              notes || null,
      })
      .select()
      .single()

    if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })

    // Auto-generate installments
    const installmentRows = []
    for (let i = 1; i <= Number(num_installments); i++) {
      const dueDate = new Date(program_start)
      dueDate.setMonth(dueDate.getMonth() + (i - 1))
      const dueDateStr = dueDate.toISOString().split("T")[0]
      installmentRows.push({
        client_id:          client.id,
        installment_number: i,
        due_date:           dueDateStr,
        amount:             Number(installment_amount),
      })
    }

    const { error: installmentsError } = await supabase
      .from("crm_installments")
      .insert(installmentRows)

    if (installmentsError) return NextResponse.json({ error: installmentsError.message }, { status: 500 })

    return NextResponse.json({ client })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** PATCH — toggle installment paid, toggle followup completed, or update client */
export async function PATCH(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const supabase = createServiceClient()

    // Toggle installment paid
    if (body.installment_id) {
      const { data: existing, error: fetchErr } = await supabase
        .from("crm_installments")
        .select("paid_at")
        .eq("id", body.installment_id)
        .maybeSingle()
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

      const newPaidAt = existing?.paid_at ? null : new Date().toISOString()
      const { error } = await supabase
        .from("crm_installments")
        .update({ paid_at: newPaidAt, notes: body.notes !== undefined ? body.notes : undefined })
        .eq("id", body.installment_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, paid_at: newPaidAt })
    }

    // Toggle followup completed
    if (body.followup_id) {
      const { data: existing, error: fetchErr } = await supabase
        .from("crm_followups")
        .select("completed")
        .eq("id", body.followup_id)
        .maybeSingle()
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

      const newCompleted = !existing?.completed
      const { error } = await supabase
        .from("crm_followups")
        .update({ completed: newCompleted })
        .eq("id", body.followup_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, completed: newCompleted })
    }

    // Update client fields
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const allowed: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body.name       !== undefined) allowed.name       = body.name
    if (body.email      !== undefined) allowed.email      = body.email || null
    if (body.instagram  !== undefined) allowed.instagram  = body.instagram || null
    if (body.phone      !== undefined) allowed.phone      = body.phone || null
    if (body.status     !== undefined) allowed.status     = body.status
    if (body.notes      !== undefined) allowed.notes      = body.notes || null
    if (body.setter              !== undefined) allowed.setter              = body.setter || null
    if (body.closer              !== undefined) allowed.closer              = body.closer || null
    if (body.programa            !== undefined) allowed.programa            = body.programa || null
    if (body.forma_pago          !== undefined) allowed.forma_pago          = body.forma_pago || null
    if (body.address             !== undefined) allowed.address             = body.address || null
    if (body.dashboard_email     !== undefined) allowed.dashboard_email     = body.dashboard_email || null
    if (body.dashboard_password  !== undefined) allowed.dashboard_password  = body.dashboard_password || null

    const { error } = await supabase.from("crm_clients").update(allowed).eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}

/** DELETE — delete followup or client (cascades installments + followups) */
export async function DELETE(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

    const supabase = createServiceClient()

    if (body.followup_id) {
      const { error } = await supabase.from("crm_followups").delete().eq("id", body.followup_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const { error } = await supabase.from("crm_clients").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
