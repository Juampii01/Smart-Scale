/**
 * Extracción de texto de documentos para el Cerebro de Ann.
 * Soporta: PDF (vía Anthropic), DOCX (vía mammoth), TXT/MD (lectura directa).
 * Gateado a admin/developer.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-guards"
import Anthropic from "@anthropic-ai/sdk"

export const runtime  = "nodejs"
export const dynamic  = "force-dynamic"
export const maxDuration = 30

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function getJwt(req: NextRequest) {
  return (req.headers.get("authorization") ?? "").replace("Bearer ", "")
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(getJwt(req))
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ error: "No se pudo leer el archivo" }, { status: 400 }) }

  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo supera el límite de 10 MB" }, { status: 413 })

  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""

  // ── TXT / MD / CSV ─────────────────────────────────────────────────────────
  if (["txt", "md", "csv"].includes(ext)) {
    const text = await file.text()
    return NextResponse.json({ text: text.trim(), title: file.name.replace(/\.[^.]+$/, "") })
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  if (ext === "pdf") {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 })

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: process.env.ANAI_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          } as any,
          {
            type: "text",
            text: "Transcribí el contenido completo de este documento. Mantené la estructura original: párrafos, listas, secciones y subtítulos. No agregues introducción ni comentarios — solo el contenido tal como está.",
          },
        ],
      }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("")

    return NextResponse.json({ text: text.trim(), title: file.name.replace(/\.[^.]+$/, "") })
  }

  // ── DOCX / DOC ─────────────────────────────────────────────────────────────
  if (["docx", "doc"].includes(ext)) {
    try {
      // mammoth se importa dinámicamente para evitar que Next.js lo bundlee en el edge
      const mammoth = (await import("mammoth")).default
      const buffer  = Buffer.from(await file.arrayBuffer())
      const result  = await mammoth.extractRawText({ buffer })
      return NextResponse.json({ text: result.value.trim(), title: file.name.replace(/\.[^.]+$/, "") })
    } catch (e: any) {
      return NextResponse.json({ error: `No se pudo leer el DOCX: ${e?.message ?? "error desconocido"}` }, { status: 500 })
    }
  }

  return NextResponse.json({
    error: `Formato .${ext} no soportado. Usá PDF, DOCX, TXT o MD.`,
  }, { status: 400 })
}
