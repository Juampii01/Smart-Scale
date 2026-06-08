/**
 * Logger para API routes — escribe en console Y en app_logs (Supabase).
 * El panel /admin/dev-logs muestra los logs en tiempo real via Realtime.
 *
 * Uso:
 *   import { log } from "@/lib/logger"
 *   log.error("ann-ai/chat", "Error al llamar Anthropic", { user_id, message: err.message })
 *   log.warn("billing", "Pago vencido", { client_id })
 *   log.info("webhook", "Cliente creado", { client_id })
 */

import { createServiceClient } from "@/lib/supabase-service"

type Level = "error" | "warn" | "info" | "debug"

// No loguear en tests o builds estáticos
const isServer = typeof window === "undefined"

async function write(level: Level, route: string, message: string, context?: Record<string, any>) {
  // Siempre loguear en console
  const prefix = `[${level.toUpperCase()}] [${route}]`
  if (level === "error")      console.error(prefix, message, context ?? "")
  else if (level === "warn")  console.warn(prefix, message, context ?? "")
  else                        console.log(prefix, message, context ?? "")

  // Solo persistir en server y si no es modo dev silencioso
  if (!isServer) return

  try {
    const sb = createServiceClient()
    await sb.from("app_logs").insert({
      level,
      route,
      message,
      context: context ?? null,
    })
  } catch (e) {
    // Fallo silencioso — no romper el flujo principal por un error de logging
    console.error("[logger] error al escribir log:", e)
  }
}

export const log = {
  error: (route: string, message: string, context?: Record<string, any>) =>
    write("error", route, message, context),
  warn:  (route: string, message: string, context?: Record<string, any>) =>
    write("warn",  route, message, context),
  info:  (route: string, message: string, context?: Record<string, any>) =>
    write("info",  route, message, context),
  debug: (route: string, message: string, context?: Record<string, any>) =>
    write("debug", route, message, context),
}
