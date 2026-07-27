/**
 * Registro genérico de "esto corrió" para el panel Estado del Sistema en
 * /admin/omni. Fire-and-forget: nunca debe romper al caller (mismo espíritu
 * que las notificaciones de lib/slack.ts y lib/zapier.ts) — si falla el
 * insert, se loguea a consola y listo.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

export async function logJobRun(
  sb: SupabaseClient,
  jobName: string,
  status: "ok" | "error",
  detail?: string,
): Promise<void> {
  try {
    await sb.from("system_job_runs").insert({ job_name: jobName, status, detail: detail ?? null })
  } catch (err) {
    console.error(`[system-log] failed to log run for "${jobName}":`, err)
  }
}
