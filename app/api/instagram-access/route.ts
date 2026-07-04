import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"

// Endpoint PÚBLICO (sin auth): el cliente envía su Instagram para que el equipo
// le dé acceso de tester/developer en la app de Meta y traer sus métricas.
// Guarda en instagram_access_requests y, si está configurado, avisa por Zapier.
// Degrada elegante: si la tabla aún no se migró, igual avisa por webhook.

/** Normaliza a @usuario cuando se puede; si es un link de perfil simple, extrae el handle. */
function normalizeIg(v: string) {
  const s = v.trim()
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      if (u.hostname.replace(/^www\./, "").toLowerCase() === "instagram.com") {
        const seg = u.pathname.split("/").filter(Boolean)
        if (seg.length === 1 && !["p", "reel", "reels", "stories", "direct", "explore"].includes(seg[0].toLowerCase())) {
          return `@${seg[0]}`
        }
      }
    } catch { /* link inválido — se guarda tal cual */ }
    return s
  }
  return `@${s.replace(/^@+/, "")}`
}

const MISSING = (msg: any) =>
  typeof msg === "string" && /does not exist|schema cache|relation .*instagram_access_requests/i.test(msg)

export async function POST(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const name      = String(body.name ?? "").trim()
    const instagram = String(body.instagram ?? "").trim()
    const email     = String(body.email ?? "").trim()
    const isPro      = Boolean(body.is_professional)

    if (!name)      return NextResponse.json({ error: "Necesitamos tu nombre." }, { status: 400 })
    if (!instagram) return NextResponse.json({ error: "Necesitamos tu usuario de Instagram." }, { status: 400 })

    const ig = normalizeIg(instagram)

    // ── 1) Guardar en la base (best-effort) ─────────────────────────────────────
    let stored = false
    let id: string | null = null
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("instagram_access_requests")
      .insert({
        name,
        instagram:       ig,
        email:           email || null,
        is_professional: isPro,
        status:          "nueva",
      })
      .select("id")
      .single()

    if (!error && data) { stored = true; id = data.id }
    else if (error && !MISSING(error.message)) {
      console.error("[instagram-access] insert error:", error.message)
    }

    // ── 2) Avisar por Zapier (best-effort) ──────────────────────────────────────
    let notified = false
    const webhookUrl = process.env.INSTAGRAM_ACCESS_WEBHOOK_URL
    if (webhookUrl) {
      try {
        const payload = new URLSearchParams({
          id:               id ?? "",
          nombre:           name,
          instagram:        ig,
          email:            email || "",
          cuenta_profesional: isPro ? "Sí" : "No",
          fecha_envio:      new Date().toISOString(),
        })
        await fetch(webhookUrl, {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:    payload.toString(),
        })
        notified = true
      } catch (e: any) {
        console.error("[instagram-access] webhook error:", e?.message)
      }
    }

    if (!stored && !notified) {
      return NextResponse.json(
        { error: "No pudimos registrar tu solicitud. Aplicá la migración instagram_access_requests o configurá INSTAGRAM_ACCESS_WEBHOOK_URL." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
