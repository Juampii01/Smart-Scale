import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Add N months to a date, return ISO date string (YYYY-MM-DD) */
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T12:00:00Z")
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** Parse a date from various formats (DD/MM/YYYY, YYYY-MM-DD, Month YYYY, etc.) */
function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw).trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,"0")}-${mdy[2].padStart(2,"0")}`

  // Try native Date parse
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)

  return null
}

/** Coerce a value to a positive number, return null if not parseable */
function toNum(v: any): number | null {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.,-]/g, "").replace(",", "."))
  return isNaN(n) || n <= 0 ? null : n
}

/** Grab first truthy value from a list of keys in an object */
function pick(obj: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    const v = obj[k] ?? obj[k.toLowerCase()] ?? obj[k.replace(/_/g, " ")]
    if (v !== undefined && v !== null && v !== "") return v
  }
  return null
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, any>
    try {
      const ct = req.headers.get("content-type") ?? ""
      if (ct.includes("application/json")) {
        body = await req.json()
      } else {
        const text = await req.text()
        body = Object.fromEntries(new URLSearchParams(text))
      }
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }

    // ── Extract fields ──────────────────────────────────────────────────────

    const name = String(
      pick(body,
        "nombre", "nombre_completo", "nombre completo del cliente",
        "name", "full_name", "client_name"
      ) ?? ""
    ).trim()

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const email   = pick(body, "email", "mejor_email", "mejor email del cliente") as string | null
    const phone   = pick(body, "telefono", "phone", "mejor_telefono", "mejor telefono del cliente") as string | null
    const programa = pick(body, "programa", "program") as string | null
    const formaPago = pick(body, "forma_pago", "forma de pago", "payment_method") as string | null
    const notes   = pick(body, "notas", "notes", "observaciones") as string | null

    // Program start — use "fecha_cierre" (closing date) or "mes_actual" or today
    const rawStart = pick(body, "fecha_cierre", "fecha cierre", "start_date", "program_start", "mes_actual", "mes actual")
    const programStart = parseDate(rawStart) ?? new Date().toISOString().slice(0, 10)

    // Program duration in months (how long the program lasts)
    const rawDuracion = pick(body, "cantidad_meses", "cantidad de meses de programa", "meses_de_programa", "program_duration", "duracion")
    const programDuration = Math.min(24, Math.max(1, parseInt(String(rawDuracion ?? "1")) || 1))

    // Number of payment installments (how many payments, can differ from duration)
    const rawCuotas = pick(body, "cantidad_pagos", "cantidad de pagos", "num_installments", "cuotas", "num_cuotas")
    const numInstallments = Math.min(6, Math.max(1, parseInt(String(rawCuotas ?? String(programDuration))) || 1))

    // Total amount
    const rawTotal = pick(body, "pago_total", "pago total", "total_amount", "total")
    const totalAmount = toNum(rawTotal)

    // Per-installment amounts — read mes_1/primer_pago through mes_6
    const monthAmounts: (number | null)[] = [
      toNum(pick(body, "primer_pago", "primer pago", "mes_1", "mes 1", "pago_1")),
      toNum(pick(body, "mes_2", "mes 2", "pago_2")),
      toNum(pick(body, "mes_3", "mes 3", "pago_3")),
      toNum(pick(body, "mes_4", "mes 4", "pago_4")),
      toNum(pick(body, "mes_5", "mes 5", "pago_5")),
      toNum(pick(body, "mes_6", "mes 6", "pago_6")),
    ]

    // Derive per-installment amount fallback: total / num_installments
    const fallbackAmount = totalAmount ? totalAmount / numInstallments : 0

    // ── Insert client ───────────────────────────────────────────────────────

    const supabase = createServiceClient()

    const { data: client, error: clientErr } = await supabase
      .from("crm_clients")
      .insert({
        name,
        email:               email   || null,
        phone:               phone   || null,
        programa:            programa || null,
        forma_pago:          formaPago || null,
        notes:               notes   || null,
        program_start:       programStart,
        program_duration:    programDuration,
        num_installments:    numInstallments,
        installment_amount:  fallbackAmount,
        total_amount:        totalAmount ?? fallbackAmount * numInstallments,
        status:              "activo",
      })
      .select("id")
      .single()

    if (clientErr || !client) {
      console.error("crm_clients insert error", clientErr)
      return NextResponse.json({ error: clientErr?.message ?? "Error inserting client" }, { status: 500 })
    }

    // ── Insert installments ─────────────────────────────────────────────────

    const installments = Array.from({ length: numInstallments }, (_, i) => ({
      client_id:          client.id,
      installment_number: i + 1,
      due_date:           addMonths(programStart, i),
      amount:             monthAmounts[i] ?? fallbackAmount,
    }))

    const { error: instErr } = await supabase
      .from("crm_installments")
      .insert(installments)

    if (instErr) {
      console.error("crm_installments insert error", instErr)
      // Client was created — don't fail completely, just log
    }

    return NextResponse.json({ success: true, client_id: client.id })
  } catch (err: any) {
    console.error("webhook/client error", err)
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 })
  }
}
