import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET — all clients with their installments and followups */
export async function GET(req: NextRequest) {
  try {
    const jwt  = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireAdmin(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const supabase = createServiceClient()

    // Las 4 tablas se leen en paralelo — son independientes.
    const [clientsRes, installmentsRes, followupsRes, portalClientsRes] = await Promise.all([
      supabase.from("crm_clients").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("crm_installments").select("*").order("installment_number", { ascending: true }),
      supabase.from("crm_followups").select("*").order("scheduled_date", { ascending: true }),
      supabase.from("clients").select("id, business_profile").limit(1000),
    ])

    if (clientsRes.error)     return NextResponse.json({ error: clientsRes.error.message },     { status: 500 })
    if (installmentsRes.error) return NextResponse.json({ error: installmentsRes.error.message }, { status: 500 })
    if (followupsRes.error)   return NextResponse.json({ error: followupsRes.error.message },   { status: 500 })

    const clients      = clientsRes.data
    const installments = installmentsRes.data
    const followups    = followupsRes.data

    // Mapeo business_profile por id (mismo UUID entre crm_clients y clients)
    const businessProfileById: Record<string, string | null> = {}
    for (const c of (portalClientsRes.data ?? [])) {
      businessProfileById[c.id] = c.business_profile ?? null
    }

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
      business_profile: businessProfileById[client.id] ?? null,
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
    const { name, email, instagram, phone, program_start, num_installments, installment_amount, notes, is_monthly_subscription } = body
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
        is_monthly_subscription: Boolean(is_monthly_subscription),
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

    // Offboard: mark client inactive + delete unpaid installments
    if (body.type === "offboard") {
      if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })
      const [updateRes, deleteRes] = await Promise.all([
        supabase
          .from("crm_clients")
          .update({ status: "inactivo", updated_at: new Date().toISOString() })
          .eq("id", body.id),
        supabase
          .from("crm_installments")
          .delete()
          .eq("client_id", body.id)
          .is("paid_at", null),
      ])
      if (updateRes.error) return NextResponse.json({ error: updateRes.error.message }, { status: 500 })
      if (deleteRes.error) return NextResponse.json({ error: deleteRes.error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // Update installment amount (only amount — does NOT toggle paid_at)
    if (body.installment_id && body.amount !== undefined) {
      const newAmount = Number(body.amount)
      if (isNaN(newAmount) || newAmount < 0) {
        return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 })
      }
      const { error } = await supabase
        .from("crm_installments")
        .update({ amount: newAmount })
        .eq("id", body.installment_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, amount: newAmount })
    }

    // Toggle installment paid
    if (body.installment_id) {
      // Fetch installment + parent client info (for monthly subscription logic)
      const { data: existing, error: fetchErr } = await supabase
        .from("crm_installments")
        .select("paid_at, due_date, installment_number, amount, client_id")
        .eq("id", body.installment_id)
        .maybeSingle()
      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

      const newPaidAt = existing?.paid_at ? null : new Date().toISOString()
      const { error } = await supabase
        .from("crm_installments")
        .update({ paid_at: newPaidAt, notes: body.notes !== undefined ? body.notes : undefined })
        .eq("id", body.installment_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Auto-renew: if marking as PAID (not unpaying) on a monthly subscription client,
      // generate next installment if one doesn't already exist
      let newInstallment: any = null
      if (newPaidAt && existing?.client_id) {
        const { data: client } = await supabase
          .from("crm_clients")
          .select("is_monthly_subscription, installment_amount")
          .eq("id", existing.client_id)
          .maybeSingle()

        if (client?.is_monthly_subscription) {
          // Check if a future unpaid installment already exists
          const { data: futurePending } = await supabase
            .from("crm_installments")
            .select("id")
            .eq("client_id", existing.client_id)
            .is("paid_at", null)
            .limit(1)

          if (!futurePending || futurePending.length === 0) {
            // Compute next due date = paid installment's due_date + 1 month
            const lastDue = new Date(existing.due_date + "T12:00:00")
            lastDue.setMonth(lastDue.getMonth() + 1)
            const nextDueStr = lastDue.toISOString().split("T")[0]
            const nextNumber = (existing.installment_number ?? 1) + 1

            const { data: created } = await supabase
              .from("crm_installments")
              .insert({
                client_id:          existing.client_id,
                installment_number: nextNumber,
                due_date:           nextDueStr,
                amount:             client.installment_amount ?? existing.amount,
              })
              .select()
              .maybeSingle()

            newInstallment = created ?? null
          }
        }
      }

      return NextResponse.json({ success: true, paid_at: newPaidAt, new_installment: newInstallment })
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
    if (body.programa            !== undefined) allowed.programa            = body.programa || null
    if (body.forma_pago          !== undefined) allowed.forma_pago          = body.forma_pago || null
    if (body.address             !== undefined) allowed.address             = body.address || null
    if (body.dashboard_email     !== undefined) allowed.dashboard_email     = body.dashboard_email || null
    if (body.dashboard_password  !== undefined) allowed.dashboard_password  = body.dashboard_password || null
    if (body.program_duration    !== undefined) allowed.program_duration    = Number(body.program_duration) || null
    if (body.is_monthly_subscription !== undefined) allowed.is_monthly_subscription = Boolean(body.is_monthly_subscription)

    const { error: crmErr } = await supabase.from("crm_clients").update(allowed).eq("id", body.id)
    if (crmErr) return NextResponse.json({ error: crmErr.message }, { status: 500 })

    // business_profile vive en la tabla portal (clients), mismo UUID
    if (body.business_profile !== undefined) {
      const { error: portalErr } = await supabase
        .from("clients")
        .update({ business_profile: body.business_profile || null })
        .eq("id", body.id)
      if (portalErr) return NextResponse.json({ error: portalErr.message }, { status: 500 })
    }

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
