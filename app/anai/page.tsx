"use client"

import { DashboardLayout, useActiveClient, useActiveClientName, useUserRole } from "@/components/layout/dashboard-layout"
import { isInternal } from "@/lib/auth/permissions"
import { useState, useRef, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { Sparkles, Send, Loader2, User, Wrench, Plus, MessageSquare, Trash2, ChevronDown, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { MAX_CONVERSATIONS_PER_MONTH, MAX_MESSAGES_PER_CONVERSATION } from "@/app/api/assistant/conversations/route"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Msg { role: "user" | "assistant"; content: string; tools?: string[] }
interface Conv { id: string; title: string; month: string; created_at: string; updated_at: string; message_count: number }
interface Usage { month: string; used: number; limit: number }

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

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? null
}
async function authFetch(path: string, opts: RequestInit = {}) {
  const token = await getToken()
  return fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}`, ...(opts.headers ?? {}) },
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

// ─── Main component ───────────────────────────────────────────────────────────
function AnaiContent() {
  const activeClientId   = useActiveClient()
  const activeClientName = useActiveClientName()
  const userRole         = useUserRole()
  const internal         = isInternal(userRole)

  const [messages,   setMessages]   = useState<Msg[]>([])
  const [input,      setInput]      = useState("")
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // Conversaciones
  const [conversations,   setConversations]   = useState<Conv[]>([])
  const [usage,           setUsage]           = useState<Usage | null>(null)
  const [activeConvId,    setActiveConvId]    = useState<string | null>(null)
  const [loadingConvs,    setLoadingConvs]    = useState(true)
  const [historialOpen,   setHistorialOpen]   = useState(false)
  const [creatingConv,    setCreatingConv]    = useState(false)

  const scrollRef      = useRef<HTMLDivElement | null>(null)
  const historialRef   = useRef<HTMLDivElement | null>(null)

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  // ── Cerrar historial al click fuera ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (historialRef.current && !historialRef.current.contains(e.target as Node)) {
        setHistorialOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ── Cargar lista de conversaciones ───────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoadingConvs(true)
    try {
      const res  = await authFetch("/api/assistant/conversations")
      const data = await res.json()
      if (!res.ok) {
        setError("Error al cargar el historial. Intentá recargar la página.")
        return
      }
      setConversations(data.conversations ?? [])
      setUsage(data.usage ?? null)
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar conversaciones.")
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── Nueva conversación ───────────────────────────────────────────────────────
  const newConversation = async () => {
    if (creatingConv) return
    setCreatingConv(true)
    setError(null)
    try {
      const res  = await authFetch("/api/assistant/conversations", {
        method: "POST",
        body: JSON.stringify({ client_id: activeClientId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Error al crear conversación.")
        return
      }
      const conv: Conv = { ...data.conversation }
      setConversations(prev => [conv, ...prev])
      setUsage(prev => prev ? { ...prev, used: prev.used + 1 } : prev)
      setActiveConvId(conv.id)
      setMessages([])
      setHistorialOpen(false)
    } finally {
      setCreatingConv(false)
    }
  }

  // ── Cargar conversación existente ────────────────────────────────────────────
  const loadConversation = async (conv: Conv) => {
    setHistorialOpen(false)
    setActiveConvId(conv.id)
    setError(null)
    setLoading(true)
    try {
      // Fetch full messages from DB
      const res  = await authFetch(`/api/assistant/conversations?id=${conv.id}`)
      const data = await res.json()
      if (res.ok && Array.isArray(data.messages)) {
        setMessages(data.messages as Msg[])
      } else {
        setMessages([])
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Eliminar conversación ────────────────────────────────────────────────────
  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const res = await authFetch("/api/assistant/conversations", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeConvId === id) {
        setActiveConvId(null)
        setMessages([])
      }
      await loadConversations()
    }
  }

  // ── Enviar mensaje ───────────────────────────────────────────────────────────
  const send = async (text: string) => {
    const content = text.trim()
    if (!content || loading) return

    // 1. Crear conversación si no existe
    let convId = activeConvId
    if (!convId) {
      setCreatingConv(true)
      try {
        const res  = await authFetch("/api/assistant/conversations", {
          method: "POST",
          body: JSON.stringify({ client_id: activeClientId }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? "Error al crear conversación.")
          return
        }
        const conv: Conv = { ...data.conversation }
        setConversations(prev => [conv, ...prev])
        setUsage(prev => prev ? { ...prev, used: prev.used + 1 } : prev)
        convId = conv.id
        setActiveConvId(conv.id)
      } finally {
        setCreatingConv(false)
      }
    }

    // 2. Si falló la creación, convId sigue null → salir
    if (!convId) return

    // 3. Solo después de tener conversación: actualizar estado y enviar
    setError(null)
    const next = [...messages, { role: "user" as const, content }]
    setMessages(next)
    setInput("")
    setLoading(true)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55000)

    try {
      const token = await getToken()
      if (!token) { setError("Sesión expirada."); return }

      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages:        next.map(m => ({ role: m.role, content: m.content })),
          client_id:       activeClientId,
          client_name:     activeClientName,
          conversation_id: convId,
        }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Error al consultar a Ann AI.")
        // Si era límite de mensajes, mostrar info
        if (data.limitReached) setActiveConvId(null)
        return
      }
      const reply: Msg = { role: "assistant", content: data.reply ?? "", tools: data.tools_used ?? [] }
      setMessages(prev => [...prev, reply])

      // Actualizar título en la lista local
      if (convId && next.length === 1) {
        const newTitle = content.slice(0, 60) + (content.length > 60 ? "…" : "")
        setConversations(prev =>
          prev.map(c => c.id === convId ? { ...c, title: newTitle, message_count: c.message_count + 2 } : c)
        )
      } else if (convId) {
        setConversations(prev =>
          prev.map(c => c.id === convId ? { ...c, message_count: c.message_count + 2 } : c)
        )
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("La respuesta tardó demasiado. Intentá de nuevo.")
      } else {
        setError(err?.message ?? "Error inesperado.")
      }
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const empty              = messages.length === 0
  const suggestions        = internal ? SUGGESTIONS_INTERNAL : SUGGESTIONS_CLIENT
  const activeConv         = conversations.find(c => c.id === activeConvId)
  const msgCount           = messages.length
  const atMsgLimit         = msgCount >= MAX_MESSAGES_PER_CONVERSATION
  const nearMsgLimit       = msgCount >= MAX_MESSAGES_PER_CONVERSATION - 4
  const atMonthLimit       = (usage?.used ?? 0) >= MAX_CONVERSATIONS_PER_MONTH
  const thisMonthConvs     = conversations.filter(c => c.month === usage?.month)
  const olderConvs         = conversations.filter(c => c.month !== usage?.month)

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-4">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffde21] shadow-[0_0_24px_rgba(255,222,33,0.35)]">
          <Sparkles className="h-5 w-5 text-black" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-none flex items-center gap-2">
            Ann AI
          </h1>
          <p className="text-[12px] text-foreground/40 mt-1">
            {internal
              ? (activeClientName
                  ? <>Analizando a <span className="text-foreground/70 font-medium">{activeClientName}</span></>
                  : "Sin cliente seleccionado")
              : "Tu asistente de negocio personal"}
          </p>
        </div>
      </div>

      {/* ── Barra de conversación ─────────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-2">
        {/* Botón nueva conversación */}
        <button
          onClick={newConversation}
          disabled={creatingConv || atMonthLimit}
          className="flex items-center gap-1.5 rounded-xl bg-[#ffde21] px-3 py-1.5 text-xs font-bold text-black transition hover:bg-[#ffe46b] active:scale-95 disabled:opacity-40 shrink-0"
        >
          {creatingConv ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Nueva
        </button>

        {/* Título de la conversación activa / selector */}
        <div ref={historialRef} className="relative flex-1 min-w-0">
          <button
            onClick={() => setHistorialOpen(v => !v)}
            className="flex w-full items-center gap-2 rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] px-3 py-1.5 text-left transition hover:bg-foreground/[0.05]"
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-foreground/30" />
            <span className="flex-1 truncate text-[12.5px] text-foreground/70">
              {activeConv ? activeConv.title : "Sin conversación activa"}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-foreground/30 transition-transform ${historialOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown historial */}
          {historialOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-2xl border border-foreground/[0.08] bg-card shadow-xl overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                {loadingConvs ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-foreground/30" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="px-4 py-4 text-center text-[12px] text-foreground/40">No hay conversaciones todavía.</p>
                ) : (
                  <>
                    {thisMonthConvs.length > 0 && (
                      <>
                        <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-foreground/25">Este mes</p>
                        {thisMonthConvs.map(c => (
                          <ConvItem
                            key={c.id} conv={c} active={c.id === activeConvId}
                            onSelect={() => loadConversation(c)}
                            onDelete={(e) => deleteConversation(c.id, e)}
                          />
                        ))}
                      </>
                    )}
                    {olderConvs.length > 0 && (
                      <>
                        <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-foreground/25">Anteriores</p>
                        {olderConvs.map(c => (
                          <ConvItem
                            key={c.id} conv={c} active={c.id === activeConvId}
                            onSelect={() => loadConversation(c)}
                            onDelete={(e) => deleteConversation(c.id, e)}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Contador mensual */}
        {usage && (
          <div className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tabular-nums ${
            atMonthLimit
              ? "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400"
              : usage.used >= usage.limit - 1
                ? "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "bg-foreground/[0.05] text-foreground/40"
          }`}>
            {usage.used}/{usage.limit}
          </div>
        )}
      </div>

      {/* ── Mensajes ──────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-2xl border border-foreground/[0.07] bg-card p-5 space-y-5">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1a1a1d] to-[#0f0f10] border border-[#ffde21]/25 mb-4">
              <Sparkles className="h-6 w-6 text-[#ffde21]" />
            </div>
            <p className="text-[15px] font-bold text-foreground">Preguntale lo que quieras sobre {internal ? "el negocio" : "tu negocio"}</p>
            <p className="text-[13px] text-foreground/40 mt-1 max-w-sm">Ann AI cruza la metodología de Ann con {internal ? "los datos reales del cliente" : "tus datos reales"}.</p>
            {atMonthLimit ? (
              <p className="mt-6 rounded-xl border border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                Usaste las {MAX_CONVERSATIONS_PER_MONTH} conversaciones de este mes. Volvé el mes que viene.
              </p>
            ) : (
              <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {suggestions.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] px-4 py-3 text-left text-[12.5px] text-foreground/70 transition-all hover:border-[#ffde21]/30 hover:bg-[#ffde21]/[0.04] hover:text-foreground">
                    {s}
                  </button>
                ))}
              </div>
            )}
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

      {/* ── Aviso límite de mensajes ──────────────────────────────────────── */}
      {atMsgLimit && (
        <div className="mt-2 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5">
          <p className="text-[12.5px] text-amber-700 dark:text-amber-400">
            Límite de {MAX_MESSAGES_PER_CONVERSATION} mensajes alcanzado en esta conversación.
          </p>
          <button
            onClick={newConversation}
            disabled={atMonthLimit || creatingConv}
            className="ml-3 shrink-0 rounded-lg bg-amber-500/20 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/30 transition disabled:opacity-40"
          >
            Nueva conversación
          </button>
        </div>
      )}

      {nearMsgLimit && !atMsgLimit && (
        <p className="mt-1.5 text-center text-[11px] text-foreground/30">
          {MAX_MESSAGES_PER_CONVERSATION - msgCount} mensajes restantes en esta conversación
        </p>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4 mt-0.5 shrink-0 opacity-50 hover:opacity-100" /></button>
        </div>
      )}

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input) }}
        className="mt-3 flex items-end gap-2 rounded-2xl border border-foreground/[0.08] bg-card p-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder={
            atMsgLimit        ? "Iniciá una nueva conversación para continuar…"
            : atMonthLimit    ? "Límite mensual alcanzado."
            : internal        ? "Preguntale a Ann AI sobre el negocio…"
            :                   "Preguntale a Ann AI sobre tu negocio…"
          }
          rows={1}
          disabled={loading || atMsgLimit || atMonthLimit}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim() || atMsgLimit || atMonthLimit}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffde21] text-black transition hover:bg-[#ffe46b] disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  )
}

// ─── Conversation list item ───────────────────────────────────────────────────
function ConvItem({
  conv, active, onSelect, onDelete,
}: {
  conv: Conv; active: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-foreground/[0.04] ${
        active ? "bg-[#ffde21]/[0.06]" : ""
      }`}
    >
      <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#ffde21]/70" : "text-foreground/25"}`} />
      <div className="flex-1 min-w-0">
        <p className={`truncate text-[12.5px] font-medium ${active ? "text-foreground" : "text-foreground/70"}`}>
          {conv.title}
        </p>
        <p className="text-[10.5px] text-foreground/30 mt-0.5">
          {fmtDate(conv.updated_at)} · {conv.message_count} msg
        </p>
      </div>
      <button
        onClick={onDelete}
        className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-foreground/20 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </button>
  )
}

export default function AnaiPage() {
  return (
    <DashboardLayout>
      <AnaiContent />
    </DashboardLayout>
  )
}
