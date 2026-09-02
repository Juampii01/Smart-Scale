import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"
import { zapierPosiUnlock } from "@/lib/zapier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST — re-dispara un destrabe de Skool que quedó en `failed`. Reusa el
 *  skool_email / skool_course_name ya guardados en la fila (no los vuelve
 *  a resolver) — si esos datos cambiaron desde entonces (ej. Ann cargó el
 *  skool_email que faltaba), el destrabe se reprocesa desde el próximo
 *  envío del formulario del cliente, no desde acá. Un `skipped` (ultimo_nivel
 *  o ya_destrabado) no se reintenta — no hay nada roto que arreglar ahí. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: event, error: fetchErr } = await supabase
    .from("posi_unlock_events")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!event) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if ((event as any).status !== "failed") {
    return NextResponse.json({ error: "Solo se pueden reintentar destrabes en estado 'failed'" }, { status: 400 })
  }
  if (!(event as any).skool_email || !(event as any).skool_course_name) {
    return NextResponse.json(
      { error: "Falta skool_email o skool_course_name en el evento — no se puede reintentar" },
      { status: 400 }
    )
  }

  const [{ data: client }, { data: approvedLevel }, { data: unlockLevel }] = await Promise.all([
    supabase.from("clients").select("name, nombre").eq("id", (event as any).client_id).maybeSingle(),
    supabase.from("posi_levels").select("level_number, title").eq("id", (event as any).approved_level_id).maybeSingle(),
    (event as any).unlock_level_id
      ? supabase.from("posi_levels").select("level_number, title").eq("id", (event as any).unlock_level_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const clientName = (client as any)?.nombre || (client as any)?.name || "Cliente"

  const payload = {
    event_type: "posi.unlock" as const,
    unlock_event_id: id,
    client_id: (event as any).client_id,
    client_name: clientName,
    skool_email: (event as any).skool_email,
    skool_course_name: (event as any).skool_course_name,
    approved_level_number: (approvedLevel as any)?.level_number ?? 0,
    approved_level_title: (approvedLevel as any)?.title ?? "",
    unlock_level_number: (unlockLevel as any)?.level_number ?? 0,
    unlock_level_title: (unlockLevel as any)?.title ?? "",
    auto_approved: (event as any).auto_approved,
    attempt_number: null,
  }

  const zapierRes = await zapierPosiUnlock(payload)

  const { data: updated, error: updateErr } = await supabase
    .from("posi_unlock_events")
    .update({
      status: zapierRes.ok ? "sent" : "failed",
      reason: zapierRes.ok ? null : `webhook_error: ${zapierRes.error}`,
      payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (updateErr) {
    // Puede pasar: mientras este failed estaba quieto, otro submit del
    // mismo cliente ya destrabó el mismo nivel de nuevo (queda un 'sent'
    // más nuevo) — al pasar este a 'sent' también, violaría el índice
    // único (client_id, unlock_level_id). No hace falta reintentar en ese caso.
    if (updateErr.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe un destrabe pending/sent más reciente para este cliente y nivel — no hace falta reintentar este." },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ event: updated })
}
