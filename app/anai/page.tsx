"use client"

import { DashboardLayout, useActiveClient, useActiveClientName, useUserRole } from "@/components/layout/dashboard-layout"
import { isAdmin } from "@/lib/auth/permissions"
import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Sparkles, Send, Loader2, Lock, User, Wrench } from "lucide-react"

interface Msg { role: "user" | "assistant"; content: string; tools?: string[] }

const SUGGESTIONS = [
  "¿Cómo viene este cliente este mes?",
  "Dame un diagnóstico del Ecosistema Circular",
  "Analizá la tasa de cierre y dónde está el cuello de botella",
  "¿En qué pilar debería enfocarse ahora?",
]

function AnaiContent() {
  const activeClientId   = useActiveClient()
  const activeClientName = useActiveClientName()
  const userRole         = useUserRole()
  const canUse           = isAdmin(userRole)

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  if (!canUse) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[0.03] mb-4">
          <Lock className="h-6 w-6 text-foreground/30" />
        </div>
        <p className="text-foreground/50 text-sm">ANAI está disponible solo para el equipo interno.</p>
      </div>
    )
  }

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
      if (!res.ok) { setError(data.error ?? "Error al consultar a ANAI."); return }
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "", tools: data.tools_used ?? [] }])
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado.")
    } finally {
      setLoading(false)
    }
  }

  const empty = messages.length === 0

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 pb-5">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffde21] shadow-[0_0_24px_rgba(255,222,33,0.35)]">
          <Sparkles className="h-5 w-5 text-black" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-none flex items-center gap-2">
            ANAI
            <span className="rounded-md bg-[#ffde21]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ffde21]/80">Beta</span>
          </h1>
          <p className="text-[12px] text-foreground/40 mt-1.5">
            {activeClientName
              ? <>Analizando a <span className="text-foreground/70 font-medium">{activeClientName}</span></>
              : "Sin cliente seleccionado — elegí uno arriba para análisis específico"}
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
            <p className="text-[15px] font-bold text-foreground">Preguntale lo que quieras sobre el negocio</p>
            <p className="text-[13px] text-foreground/40 mt-1 max-w-sm">ANAI cruza la metodología de Ann con los datos reales del cliente.</p>
            <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map(s => (
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
                <div className={`inline-block rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[#ffde21] text-black font-medium"
                    : "bg-foreground/[0.04] text-foreground/90"
                }`}>
                  {m.content}
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
          placeholder="Preguntale a ANAI sobre el negocio…"
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
