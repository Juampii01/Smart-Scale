"use client"

import { DashboardLayout, useActiveClient, useActiveClientName, useUserRole } from "@/components/layout/dashboard-layout"
import { isInternal } from "@/lib/auth/permissions"
import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Sparkles, Send, Loader2, User, Wrench } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Msg { role: "user" | "assistant"; content: string; tools?: string[] }

const SUGGESTIONS_INTERNAL = [
  "¿Cómo viene este cliente este mes?",
  "Dame un diagnóstico del Ecosistema Circular",
  "Analizá la tasa de cierre y dónde está el cuello de botella",
  "¿En qué pilar debería enfocarse ahora?",
]
const SUGGESTIONS_CLIENT = [
  "¿Cómo vengo este mes?",
  "Dame un diagnóstico de mi Ecosistema Circular",
  "Analizá mi tasa de cierre y dónde está mi cuello de botella",
  "¿En qué pilar debería enfocarme ahora?",
]

function AnaiContent() {
  const activeClientId   = useActiveClient()
  const activeClientName = useActiveClientName()
  const userRole         = useUserRole()
  const internal         = isInternal(userRole)

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || loading) return
    setError(null)
    const next = [...messages, { role: "user" as const, content }]
    setMessages(next)
    setInput("")
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("Sesión expirada."); return }

      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          client_id: activeClientId,
          client_name: activeClientName,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Error al consultar a Ann AI."); return }
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "", tools: data.tools_used ?? [] }])
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  const empty = messages.length === 0
  const suggestions = internal ? SUGGESTIONS_INTERNAL : SUGGESTIONS_CLIENT

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 pb-5">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffde21] shadow-[0_0_24px_rgba(255,222,33,0.35)]">
          <Sparkles className="h-5 w-5 text-black" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-none flex items-center gap-2">
            Ann AI
            <span className="rounded-md bg-[#ffde21]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ffde21]/80">Beta</span>
          </h1>
          <p className="text-[12px] text-foreground/40 mt-1.5">
            {internal
              ? (activeClientName
                  ? <>Analizando a <span className="text-foreground/70 font-medium">{activeClientName}</span></>
                  : "Sin cliente seleccionado — elegí uno arriba para análisis específico")
              : "Tu asistente de negocio personal"}
          </p>
        </div>
      </div>

      {/* Conversación */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-2xl border border-foreground/[0.07] bg-card p-5 space-y-5">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1a1a1d] to-[#0f0f10] border border-[#ffde21]/25 mb-4">
              <Sparkles className="h-6 w-6 text-[#ffde21]" />
            </div>
            <p className="text-[15px] font-bold text-foreground">Preguntale lo que quieras sobre {internal ? "el negocio" : "tu negocio"}</p>
            <p className="text-[13px] text-foreground/40 mt-1 max-w-sm">Ann AI cruza la metodología de Ann con {internal ? "los datos reales del cliente" : "tus datos reales"}.</p>
            <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] px-4 py-3 text-left text-[12.5px] text-foreground/70 transition-all hover:border-[#ffde21]/30 hover:bg-[#ffde21]/[0.04] hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                m.role === "user" ? "bg-foreground/[0.06]" : "bg-[#ffde21]"
              }`}>
                {m.role === "user"
                  ? <User className="h-4 w-4 text-foreground/50" />
                  : <Sparkles className="h-4 w-4 text-black" />}
              </div>
              <div className={`min-w-0 max-w-[82%] ${m.role === "user" ? "text-right" : ""}`}>
                <div className={`inline-block rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#ffde21] text-black font-medium whitespace-pre-wrap"
                    : "bg-foreground/[0.04] text-foreground/90"
                }`}>
                  {m.role === "user" ? m.content : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p:          ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong:     ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                        em:         ({ children }) => <em className="italic text-foreground/80">{children}</em>,
                        ul:         ({ children }) => <ul className="mb-2 space-y-1 pl-4 list-disc marker:text-foreground/30">{children}</ul>,
                        ol:         ({ children }) => <ol className="mb-2 space-y-1 pl-4 list-decimal marker:text-foreground/30">{children}</ol>,
                        li:         ({ children }) => <li className="leading-snug">{children}</li>,
                        h1:         ({ children }) => <h1 className="mb-2 text-base font-bold text-foreground">{children}</h1>,
                        h2:         ({ children }) => <h2 className="mb-1.5 text-sm font-bold text-foreground">{children}</h2>,
                        h3:         ({ children }) => <h3 className="mb-1 text-[13px] font-semibold text-foreground/80">{children}</h3>,
                        hr:         () => <hr className="my-3 border-foreground/[0.08]" />,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-[#ffde21]/40 pl-3 text-foreground/60 italic">{children}</blockquote>,
                        code:       ({ children }) => <code className="rounded bg-foreground/[0.07] px-1 py-0.5 text-[12px] font-mono">{children}</code>,
                        table:      ({ children }) => (
                          <div className="my-2 overflow-x-auto rounded-xl border border-foreground/[0.08]">
                            <table className="w-full text-[12.5px]">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-foreground/[0.05]">{children}</thead>,
                        th:    ({ children }) => <th className="px-3 py-2 text-left font-semibold text-foreground/70">{children}</th>,
                        td:    ({ children }) => <td className="px-3 py-2 border-t border-foreground/[0.06] text-foreground/80">{children}</td>,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  )}
                </div>
                {m.tools && m.tools.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-foreground/25">
                    <Wrench className="h-2.5 w-2.5" />
                    consultó: {Array.from(new Set(m.tools)).join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ffde21]">
              <Sparkles className="h-4 w-4 text-black" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-foreground/[0.04] px-4 py-2.5 text-[13px] text-foreground/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analizando los datos…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input) }}
        className="mt-3 flex items-end gap-2 rounded-2xl border border-foreground/[0.08] bg-card p-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder={internal ? "Preguntale a Ann AI sobre el negocio…" : "Preguntale a Ann AI sobre tu negocio…"}
          rows={1}
          disabled={loading}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffde21] text-black transition hover:bg-[#ffe46b] disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  )
}

export default function AnaiPage() {
  return (
    <DashboardLayout>
      <AnaiContent />
    </DashboardLayout>
  )
}
