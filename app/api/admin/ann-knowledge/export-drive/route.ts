/**
 * Exporta todo el Cerebro de Ann (ann_knowledge, todas las entradas activas)
 * a un único Google Doc dentro de la carpeta de Drive compartida con la
 * service account. Se puede correr las veces que haga falta — reemplaza el
 * contenido del mismo doc en vez de crear uno nuevo cada vez.
 *
 * El doc "Cerebro de Ann — Smart Scale" tiene que existir de antemano,
 * creado a mano por un usuario real dentro de esa carpeta — ver el comment
 * de lib/google-drive.ts::updateDocInFolder (límite real de Google: las
 * service accounts no tienen cuota propia, no pueden crear archivos).
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireAdmin } from "@/lib/auth/api-guards"
import { updateDocInFolder } from "@/lib/google-drive"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const PILLAR_LABELS: Record<string, string> = {
  F: "Fascinate",
  E: "Educate",
  T: "Transform",
  I: "Invite",
  general: "General",
}

function getJwt(req: NextRequest) {
  return (req.headers.get("authorization") ?? "").replace("Bearer ", "")
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(getJwt(req))
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!folderId) return NextResponse.json({ error: "GOOGLE_DRIVE_FOLDER_ID no configurada" }, { status: 500 })

  const sb = createServiceClient()
  const { data: items, error } = await sb
    .from("ann_knowledge")
    .select("title, content, pillar, sort_order, updated_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items || items.length === 0) return NextResponse.json({ error: "No hay entradas activas para exportar" }, { status: 404 })

  const byPillar = new Map<string, typeof items>()
  for (const item of items) {
    const key = item.pillar || "general"
    if (!byPillar.has(key)) byPillar.set(key, [] as any)
    ;(byPillar.get(key) as any).push(item)
  }

  const pillarOrder = ["F", "E", "T", "I", "general"]
  const sections: string[] = []
  for (const pillarKey of pillarOrder) {
    const group = byPillar.get(pillarKey)
    if (!group || group.length === 0) continue
    sections.push(`\n\n========================================\n${PILLAR_LABELS[pillarKey] ?? pillarKey}\n========================================`)
    for (const item of group as any[]) {
      sections.push(`\n\n--- ${item.title} ---\n\n${item.content}`)
    }
  }

  const header =
    `CEREBRO DE ANN — SMART SCALE\n` +
    `Exportado automáticamente desde /admin/ann-knowledge — ${new Date().toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" })}\n` +
    `${items.length} entradas activas\n` +
    `Este documento se reemplaza cada vez que se vuelve a exportar — la fuente real es la plataforma, no edites acá.`

  const content = header + sections.join("")

  try {
    const doc = await updateDocInFolder({
      name: "Cerebro de Ann — Smart Scale",
      content,
      folderId,
    })
    return NextResponse.json({ ok: true, webViewLink: doc.webViewLink, entries: items.length })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error al exportar a Drive" }, { status: 500 })
  }
}
