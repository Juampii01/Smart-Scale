/**
 * Next.js instrumentation — corre una vez al inicializar cada runtime de server.
 *
 * Parchea console.error y console.warn para que, además de escribir en consola,
 * persistan en la tabla app_logs. Así el panel /admin/dev-logs captura TODOS los
 * errores y warnings de la app en tiempo real sin instrumentar ruta por ruta.
 *
 * Solo aplica en runtime nodejs (no edge). Best-effort: si el insert falla,
 * nunca rompe el flujo ni genera recursión.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { createServiceClient } = await import("@/lib/supabase-service")

  // Evita recursión: si el propio insert dispara un console.error.
  let inside = false

  const origError = console.error.bind(console)
  const origWarn  = console.warn.bind(console)

  function isPlainObject(v: any): boolean {
    return v != null && typeof v === "object" && !(v instanceof Error) && !Array.isArray(v)
  }

  function stringify(p: any): string {
    if (typeof p === "string") return p
    if (p instanceof Error) return p.message
    try { return JSON.stringify(p) } catch { return String(p) }
  }

  /** Extrae route ([scope] del primer string), message y context (objeto en args). */
  function parse(args: any[]): { route: string | null; message: string; context: any } {
    let context: any = null
    const rest = [...args]

    // Si el último arg es un objeto plano, lo tratamos como context
    if (rest.length > 1 && isPlainObject(rest[rest.length - 1])) {
      context = rest.pop()
    }

    const text = rest.map(stringify).join(" ").trim()
    const m = text.match(/^\[([^\]]+)\]\s*(.*)$/)
    if (m) return { route: m[1], message: m[2] || text, context }
    return { route: null, message: text, context }
  }

  async function persist(level: "error" | "warn", args: any[]) {
    if (inside) return
    inside = true
    try {
      const { route, message, context } = parse(args)
      if (!message) return
      const sb = createServiceClient()
      await sb.from("app_logs").insert({
        level,
        route,
        message: message.slice(0, 2000),
        context: context ?? null,
      })
    } catch {
      // best-effort
    } finally {
      inside = false
    }
  }

  console.error = (...args: any[]) => {
    origError(...args)
    void persist("error", args)
  }
  console.warn = (...args: any[]) => {
    origWarn(...args)
    void persist("warn", args)
  }
}
