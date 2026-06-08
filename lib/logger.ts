/**
 * Logger para API routes. Escribe en console con formato "[route] message".
 *
 * El insert a la tabla app_logs lo hace instrumentation.ts, que parchea
 * console.error/warn globalmente. Así este logger Y cualquier console.error
 * existente en el código quedan capturados en el panel /admin/dev-logs.
 *
 * Uso:
 *   import { log } from "@/lib/logger"
 *   log.error("ann-ai/chat", "Error al llamar Anthropic", { message: err.message })
 *   log.warn("billing", "Pago vencido", { client_id })
 *   log.info("webhook", "Cliente creado", { client_id })
 */

type Level = "error" | "warn" | "info" | "debug"

function emit(level: Level, route: string, message: string, context?: Record<string, any>) {
  const prefix = `[${route}]`
  const args: any[] = context ? [prefix, message, context] : [prefix, message]
  if (level === "error")      console.error(...args)
  else if (level === "warn")  console.warn(...args)
  else                        console.log(...args)
}

export const log = {
  error: (route: string, message: string, context?: Record<string, any>) => emit("error", route, message, context),
  warn:  (route: string, message: string, context?: Record<string, any>) => emit("warn",  route, message, context),
  info:  (route: string, message: string, context?: Record<string, any>) => emit("info",  route, message, context),
  debug: (route: string, message: string, context?: Record<string, any>) => emit("debug", route, message, context),
}
