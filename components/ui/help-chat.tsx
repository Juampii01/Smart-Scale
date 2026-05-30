"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Sparkles, X, Send, Loader2, RotateCcw } from "lucide-react"

type Message = { role: "user" | "assistant"; content: string }

const STARTER_QUESTIONS_CLIENT = [
  "¿Cómo cargo mi reporte mensual?",
  "¿Qué hace el Audit?",
  "¿Cómo veo mi avance del programa?",
  "¿Diferencia entre valor del trato y cash collected?",
]

const STARTER_QUESTIONS_ADMIN = [
  "¿Qué se cobró este mes?",
  "¿Qué falta cobrar en mayo?",
  "¿Cuánto cobra Fabri de comisión este mes?",
  "Mostrame las cuotas de Pablo Munizaga",
]

const WELCOME_CLIENT: Message = {
  role: "assistant",
  content:
    "Hola — soy el asistente del dashboard de Smart Scale 👋\n\nPodés preguntarme sobre cómo usar cualquier sección, qué significa cada métrica, o pedirme un workflow paso a paso. ¿En qué te ayudo?",
}

const WELCOME_ADMIN: Message = {
  role: "assistant",
  content:
    "Hola — soy el asistente interno del CRM 🔐\n\nTengo acceso directo a la base de datos. Podés preguntarme sobre cobros, pagos pendientes, cuotas de clientes, comisiones del setter, o cualquier dato del CRM. ¿Qué necesitás?",
}

// ─── Markdown render mínimo (sin dependencia externa) ────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  // Convierte líneas con `- ` en lista, **negrita** y `inline code`.
  const lines = text.split("\n")
  return lines.map((line, idx) => {
    if (!line.trim()) return <div key={idx} className="h-2" />

    if (line.startsWith("- ")) {
      return (
        <div key={idx} className="flex gap-2 leading-relaxed">
          <span className="text-[#ffde21]/60 mt-1.5 h-1 w-1 rounded-full bg-[#ffde21]/60 flex-shrink-0" />
          <span>{renderInline(line.slice(2))}</span>
        </div>
      )
    }
    return <p key={idx} className="leading-relaxed">{renderInline(line)}</p>
  })
}

function renderInline(text: string): React.ReactNode[] {
  // **bold** y `code`
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)/g
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index))
    if (m[1]) {
      parts.push(<strong key={`b${key++}`} className="font-semibold text-foreground">{m[2]}</strong>)
    } else if (m[3]) {
      parts.push(<code key={`c${key++}`} className="rounded bg-foreground/[0.08] px-1 py-0.5 text-[12.5px] font-mono text-[#ffde21]/90">{m[4]}</code>)
    }
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts
}

// ─── HelpChat ─────────────────────────────────────────────────────────────────

export function HelpChat() {
  const pathname   = usePathname()
  const isAdmin    = pathname?.startsWith("/admin") ?? false
  const WELCOME    = isAdmin ? WELCOME_ADMIN    : WELCOME_CLIENT
  const STARTERS   = isAdmin ? STARTER_QUESTIONS_ADMIN : STARTER_QUESTIONS_CLIENT
  const API_ROUTE  = isAdmin ? "/api/admin/assistant" : "/api/help-chat"

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset chat when switching between admin and client context
  useEffect(() => {
    setMessages([WELCOME])
    setInput("")
    setError(null)
  }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  // Esc cierra el panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open])

  const sendMessage = async (rawText?: string) => {
    const text = (rawText ?? input).trim()
    if (!text || loading) return

    const userMsg: Message = { role: "user", content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput("")
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError("Sesión expirada. Recargá la página.")
        return
      }

      // Excluir el welcome message del contexto que mandamos a la API
      const apiMessages = next.filter(m => m !== WELCOME)

      const res = await fetch(API_ROUTE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? "Error al consultar el asistente.")
        return
      }
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "" }])
    } catch (err: any) {
      setError(err?.message ?? "Error de conexión.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const reset = () => {
    setMessages([WELCOME])
    setInput("")
    setError(null)
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente"
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#ffde21] pl-4 pr-5 py-3 text-[13px] font-bold text-black shadow-lg shadow-black/40 hover:bg-[#ffe46b] hover:scale-105 active:scale-95 transition-all ${open ? "opacity-0 pointer-events-none scale-90" : "opacity-100"}`}
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">Asistente</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel slide-over */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md flex flex-col border-l border-foreground/[0.08] bg-background shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ boxShadow: "rgba(0,0,0,0.5) -8px 0 32px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-foreground/[0.07] px-5 py-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffde21]/10 ring-1 ring-[#ffde21]/20">
              <Sparkles className="h-4 w-4 text-[#ffde21]" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-foreground leading-tight">Asistente del dashboard</p>
              <p className="text-[11px] text-foreground/35 mt-0.5">IA · te ayuda a usar Smart Scale</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 1 && (
              <button
                onClick={reset}
                title="Reiniciar conversación"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              title="Cerrar (Esc)"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] ${
                  m.role === "user"
                    ? "bg-[#ffde21] text-black font-medium"
                    : "bg-foreground/[0.04] border border-foreground/[0.06] text-foreground/85"
                }`}
              >
                <div className="space-y-1">
                  {m.role === "assistant" ? renderMarkdown(m.content) : m.content}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-2 text-[12px] text-foreground/40">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Pensando…
                </div>
              </div>
            </div>
          )}

          {/* Starter questions cuando solo hay welcome */}
          {messages.length === 1 && !loading && (
            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/30 px-1">
                Probá con
              </p>
              {STARTERS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="block w-full text-left rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2 text-[12.5px] text-foreground/65 hover:text-foreground hover:border-[#ffde21]/30 hover:bg-[#ffde21]/[0.03] transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-800 dark:border-red-500/25 dark:bg-red-500/[0.06] dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-foreground/[0.07] px-4 py-3 bg-card">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntá cualquier cosa sobre el dashboard…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-[#ffde21]/40 focus:bg-foreground/[0.05] transition-all max-h-32"
              style={{ minHeight: "42px" }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-[#ffde21] text-black hover:bg-[#ffe46b] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-foreground/25 text-center">
            Enter para enviar · Shift+Enter para nueva línea · Esc para cerrar
          </p>
        </form>
      </div>
    </>
  )
}
