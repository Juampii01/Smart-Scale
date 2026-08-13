/**
 * Chequea si, con el último toggle del Program Checklist ("Posi"), un cliente
 * cruzó el umbral de finalización de algún nivel — y si es la primera vez
 * que pasa para ese (cliente, nivel), dispara el aviso a Slack.
 *
 * Se llama fire-and-forget desde app/api/checklist-progress/route.ts después
 * de marcar una tarea como completada. Nunca debe romper el toggle en sí.
 */
import { createServiceClient } from "@/lib/supabase-service"
import { taskKeysByLevel } from "@/lib/program-checklist-data"
import { notifyChecklistLevelCompleted } from "@/lib/slack"

const COMPLETION_THRESHOLD = 0.8 // 80% de las tareas del nivel

export async function checkAndNotifyLevelCompletion(clientId: string): Promise<void> {
  try {
    const sb = createServiceClient()

    const { data: progressRows } = await sb
      .from("client_checklist_progress")
      .select("task_key")
      .eq("client_id", clientId)
    const completedKeys = new Set((progressRows ?? []).map((r: any) => r.task_key as string))

    const byLevel = taskKeysByLevel()

    for (const [level, keys] of byLevel.entries()) {
      if (keys.length === 0) continue
      const done = keys.filter(k => completedKeys.has(k)).length
      const pct = Math.round((done / keys.length) * 100)
      if (done / keys.length < COMPLETION_THRESHOLD) continue

      // Primero intenta insertar — si ya existe (unique client_id+level),
      // el insert falla y no se re-avisa. Evita una carrera con select-then-insert.
      const { error: insertErr } = await sb
        .from("client_checklist_level_notifications")
        .insert({ client_id: clientId, level, pct })
      if (insertErr) continue

      const { data: client } = await sb.from("clients").select("name").eq("id", clientId).maybeSingle()
      const clientName = (client as any)?.name ?? "Cliente"

      await notifyChecklistLevelCompleted({ client_name: clientName, level, pct }).catch(() => {})
    }
  } catch {
    // best-effort — nunca debe romper el toggle del checklist
  }
}
