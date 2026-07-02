/**
 * Admin AI Assistant — Claude con tool use para consultar la DB del CRM.
 *
 * Herramientas disponibles:
 *   get_cash_data          → cobrado / pendiente de un mes
 *   get_client_installments → cuotas de un cliente
 *   get_active_clients     → listado de clientes con estado
 *   get_commission_data    → comisiones de setters por mes
 *
 * Solo accesible por usuarios internal (admin / team / setter).
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireInternal } from "@/lib/auth/api-guards"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 45

// ─── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_cash_data",
    description: `Obtiene los datos de cash cobrado y pendiente para un mes específico desde el CRM.
Devuelve: cuotas con due_date en ese mes, separadas por estado (pagado/pendiente), con cliente y monto.
Úsala cuando el usuario pregunta por cobros, old cash, qué se cobró, qué falta cobrar, pendientes del mes, etc.`,
    input_schema: {
      type: "object" as const,
      properties: {
        month: {
          type: "string",
          description: "Mes en formato YYYY-MM, ej: 2026-05",
        },
        segment: {
          type: "string",
          enum: ["all", "new_cash", "old_cash"],
          description: "all = todo, new_cash = clientes que entraron ese mes, old_cash = clientes anteriores",
        },
      },
      required: ["month"],
    },
  },
  {
    name: "get_client_installments",
    description: `Obtiene el historial de cuotas de un cliente específico buscado por nombre (búsqueda parcial).
Devuelve: todas sus cuotas con monto, fecha de vencimiento y si fue pagado.
Úsala cuando preguntan por un cliente específico: qué pagó, qué debe, sus cuotas, su historial.`,
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: {
          type: "string",
          description: "Nombre o parte del nombre del cliente",
        },
      },
      required: ["client_name"],
    },
  },
  {
    name: "get_active_clients",
    description: `Obtiene el listado de clientes del CRM con su estado actual y próxima cuota.
Úsala cuando preguntan cuántos clientes hay, quiénes están activos, cuáles en pausa, etc.`,
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["all", "activo", "en_pausa", "inactivo", "completado"],
          description: "Filtro por estado. 'all' devuelve todos.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_commission_data",
    description: `Obtiene las comisiones de los setters para un mes específico.
Calcula: cash cobrado de sus clientes, comisión al 5%.
Úsala cuando pregunten por comisiones, cuánto gana Steffano, comisión del setter, etc.`,
    input_schema: {
      type: "object" as const,
      properties: {
        month: {
          type: "string",
          description: "Mes en formato YYYY-MM",
        },
      },
      required: ["month"],
    },
  },
]

// ─── Tool execution ────────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  const supabase = createServiceClient()

  if (name === "get_cash_data") {
    const month: string = input.month ?? ""
    const segment: string = input.segment ?? "all"
    if (!/^\d{4}-\d{2}$/.test(month)) return "Error: formato de mes inválido"

    const [y, m] = month.split("-").map(Number)
    const monthStart = `${month}-01`
    const monthEnd   = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`

    // Todos los clientes activos con sus cuotas vencidas en ese mes
    const { data: rows, error } = await supabase
      .from("crm_clients")
      .select("id, name, created_at, status, crm_installments(amount, due_date, paid_at, installment_number)")
      .neq("status", "inactivo")

    if (error) return `Error BD: ${error.message}`

    const clients = rows ?? []
    const isNewClient = (c: any) => {
      const d = new Date(c.created_at)
      return d.getFullYear() === y && d.getMonth() + 1 === m
    }

    type InstResult = { client: string; installment: number; amount: number; due_date: string; paid_at: string | null }
    const result: { paid: InstResult[]; pending: InstResult[] } = { paid: [], pending: [] }

    for (const client of clients) {
      const isNew = isNewClient(client)
      if (segment === "new_cash" && !isNew) continue
      if (segment === "old_cash" && isNew) continue

      const insts = (client as any).crm_installments ?? []
      for (const inst of insts) {
        if (!inst.due_date) continue
        const dueDate = inst.due_date.slice(0, 10)
        if (dueDate < monthStart || dueDate > monthEnd) continue

        const entry: InstResult = {
          client: (client as any).name,
          installment: inst.installment_number,
          amount: Number(inst.amount),
          due_date: dueDate,
          paid_at: inst.paid_at ? inst.paid_at.slice(0, 10) : null,
        }
        if (inst.paid_at) result.paid.push(entry)
        else result.pending.push(entry)
      }
    }

    const totalPaid    = result.paid.reduce((s, i) => s + i.amount, 0)
    const totalPending = result.pending.reduce((s, i) => s + i.amount, 0)

    return JSON.stringify({
      month,
      segment,
      total_paid:    totalPaid,
      total_pending: totalPending,
      total_expected: totalPaid + totalPending,
      paid:    result.paid,
      pending: result.pending,
    })
  }

  if (name === "get_client_installments") {
    const search: string = input.client_name ?? ""
    const { data: clients, error } = await supabase
      .from("crm_clients")
      .select("id, name, status, program_start, installment_amount, num_installments, is_monthly_subscription, crm_installments(installment_number, amount, due_date, paid_at)")
      .ilike("name", `%${search}%`)
      .limit(3)

    if (error) return `Error BD: ${error.message}`
    if (!clients || clients.length === 0) return `No se encontró ningún cliente con nombre "${search}"`

    return JSON.stringify(
      clients.map((c: any) => ({
        name: c.name,
        status: c.status,
        program_start: c.program_start,
        monthly_subscription: c.is_monthly_subscription,
        installments: (c.crm_installments ?? []).map((i: any) => ({
          number: i.installment_number,
          amount: Number(i.amount),
          due_date: i.due_date?.slice(0, 10) ?? null,
          paid_at: i.paid_at?.slice(0, 10) ?? null,
          status: i.paid_at ? "pagado" : "pendiente",
        })).sort((a: any, b: any) => a.number - b.number),
      }))
    )
  }

  if (name === "get_active_clients") {
    const status: string = input.status ?? "all"
    let query = supabase
      .from("crm_clients")
      .select("name, status, program_start, num_installments, installment_amount, is_monthly_subscription, crm_installments(installment_number, amount, due_date, paid_at)")
      .order("created_at", { ascending: false })

    if (status !== "all") query = query.eq("status", status)

    const { data, error } = await query
    if (error) return `Error BD: ${error.message}`

    const today = new Date().toISOString().slice(0, 10)
    const summary = (data ?? []).map((c: any) => {
      const insts = (c.crm_installments ?? []) as any[]
      const nextUnpaid = insts
        .filter((i: any) => !i.paid_at)
        .sort((a: any, b: any) => a.due_date?.localeCompare(b.due_date))[0]
      return {
        name: c.name,
        status: c.status,
        monthly: c.is_monthly_subscription,
        paid_count: insts.filter((i: any) => i.paid_at).length,
        total_installments: c.num_installments,
        next_due: nextUnpaid ? { amount: Number(nextUnpaid.amount), due_date: nextUnpaid.due_date?.slice(0, 10), overdue: nextUnpaid.due_date?.slice(0, 10) < today } : null,
      }
    })

    const counts = { activo: 0, en_pausa: 0, inactivo: 0, completado: 0 }
    for (const c of summary) counts[(c.status as keyof typeof counts)]++

    return JSON.stringify({ counts, clients: summary })
  }

  if (name === "get_commission_data") {
    const month: string = input.month ?? ""
    if (!/^\d{4}-\d{2}$/.test(month)) return "Error: formato de mes inválido"

    const [y, m] = month.split("-").map(Number)
    const monthStart = new Date(y, m - 1, 1)
    const monthEnd   = new Date(y, m, 0, 23, 59, 59)

    const { data: clients, error } = await supabase
      .from("crm_clients")
      .select("id, name, setter_id, total_amount, installment_amount, num_installments, status, crm_installments(amount, paid_at, due_date)")
      .neq("status", "inactivo")
      .not("setter_id", "is", null)

    if (error) return `Error BD: ${error.message}`

    // Fetch setter names
    const setterIds = [...new Set((clients ?? []).map((c: any) => c.setter_id))]
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", setterIds)
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.name]))

    const setterMap = new Map<string, { setter_name: string; clients: string[]; cash: number; commission: number }>()

    for (const client of clients ?? []) {
      const sid = (client as any).setter_id
      const insts = ((client as any).crm_installments ?? []) as any[]
      const paidThisMonth = insts.filter((i: any) => {
        if (!i.paid_at) return false
        const d = new Date(i.paid_at)
        return d >= monthStart && d <= monthEnd
      })
      if (!paidThisMonth.length) continue

      const cash = paidThisMonth.reduce((s: number, i: any) => s + Number(i.amount), 0)
      if (!setterMap.has(sid)) {
        setterMap.set(sid, { setter_name: nameMap.get(sid) ?? sid, clients: [], cash: 0, commission: 0 })
      }
      const rec = setterMap.get(sid)!
      rec.clients.push((client as any).name)
      rec.cash += cash
      rec.commission = rec.cash * 0.05
    }

    return JSON.stringify({
      month,
      setters: Array.from(setterMap.values()),
    })
  }

  return `Herramienta "${name}" no reconocida.`
}

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  return `Sos el asistente interno de Smart Scale CRM. Tenés acceso directo a la base de datos del CRM vía herramientas (tools).

Fecha actual: ${todayStr}. Mes actual: ${currentMonth}.

Tu trabajo: responder preguntas del equipo interno sobre pagos, clientes, cobros, comisiones y estado del CRM. Cuando necesitás datos reales, usá las herramientas — no inventes números.

REGLAS:
1. Si te preguntan sobre datos (cobros, pagos, clientes, comisiones), SIEMPRE usá la herramienta correspondiente antes de responder.
2. Respondé en español rioplatense, directo y conciso.
3. Cuando mostrás montos, usá formato $X.XXX (ej: $4.300).
4. Si hay múltiples clientes con nombres similares, mostralos todos y aclaralo.
5. Para preguntas ambiguas de mes, asumí el mes actual (${currentMonth}).
6. Nunca inventes datos — si la herramienta no devuelve algo, decilo.
7. Las comisiones son al 5% del cash cobrado ese mes por el setter.

CONOCIMIENTO BASE:
- Old cash = cuotas de clientes anteriores al mes consultado, con due_date en ese mes
- New cash = cuota #1 de clientes que entraron ese mismo mes
- Old cash cobrado = old cash con paid_at no nulo
- Old cash pendiente = old cash aún sin pagar
- Los clientes inactivos NO se cuentan en ningún cálculo
- Los pagos atrasados (ej: cuota de marzo pagada en mayo) NO cuentan como cobrado de mayo`
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
    const user = await requireInternal(jwt)
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const messages: Anthropic.MessageParam[] = Array.isArray(body?.messages) ? body.messages : []
    if (!messages.length) return NextResponse.json({ error: "messages required" }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 })

    const anthropic = new Anthropic({ apiKey })

    // Agentic loop: hasta 4 rounds de tool use
    const history: Anthropic.MessageParam[] = messages.slice(-20)
    let reply = ""
    let rounds = 0

    while (rounds < 4) {
      rounds++
      const response = await anthropic.messages.create({
        model:      "claude-haiku-4-5",
        max_tokens: 1024,
        system:     buildSystemPrompt(),
        tools:      TOOLS,
        messages:   history,
      })

      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find(b => b.type === "text")
        reply = textBlock?.type === "text" ? textBlock.text : ""
        break
      }

      if (response.stop_reason === "tool_use") {
        // Add assistant message with tool use blocks
        history.push({ role: "assistant", content: response.content })

        // Execute all requested tools
        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const block of response.content) {
          if (block.type !== "tool_use") continue
          const output = await executeTool(block.name, block.input as Record<string, any>)
          toolResults.push({
            type:        "tool_result",
            tool_use_id: block.id,
            content:     output,
          })
        }

        history.push({ role: "user", content: toolResults })
        continue
      }

      // Unexpected stop reason
      break
    }

    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error("[admin/assistant] error:", err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
