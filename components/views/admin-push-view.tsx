"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Bell, Send, Loader2, Check, AlertTriangle, Users, Shield, Globe, User } from "lucide-react"

const supabase = createClient()

type Audience = "clients" | "internal" | "all" | "me"

async function authFetch(path: string, opts: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}`, ...(opts.headers ?? {}) },
  })
}

const AUDIENCES: { key: Audience; label: string; desc: string; Icon: typeof Users }[] = [
  { key: "clients", label: "Clientes", desc: "Todos los clientes del programa", Icon: Users },
  { key: "internal", label: "Equipo", desc: "Admin, team y setters", Icon: Shield },
  { key: "all", label: "Todos", desc: "Todos los dispositivos suscriptos", Icon: Globe },
  { key: "me", label: "Solo a mí", desc: "Para probar antes de enviar", Icon: User },
]

export function AdminPushView() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [url, setUrl] = useState("")
  const [audience, setAudience] = useState<Audience>("clients")
  const [reach, setReach] = useState<{ clients: number; internal: number; all: number } | null>(null)
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle")
  const [msg, setMsg] = useState<string | null>(null)

  const loadReach = useCallback(async () => {
    const res = await authFetch("/api/admin/push")
    if (res.ok) { const d = await res.json(); setReach(d.reach) }
  }, [])
  useEffect(() => { loadReach() }, [loadReach])

  const reachFor = (a: Audience) =>
    a === "me" ? 1 : a === "clients" ? reach?.clients : a === "internal" ? reach?.internal : reach?.all

  const send = async () => {
    if (!title.trim() || !body.trim()) { setState("error"); setMsg("Completá título y mensaje."); return }
    const target = AUDIENCES.find((a) => a.key === audience)!
    if (audience !== "me" && !window.confirm(`Enviar "${title}" a: ${target.label}. ¿Confirmás?`)) return
    setState("sending"); setMsg(null)
    try {
      const res = await authFetch("/api/admin/push", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: url.trim() || undefined, audience }),
      })
      const d = await res.json()
      if (res.ok) {
        setState("ok")
        setMsg(audience === "me" ? "Enviada a tu dispositivo." : `Enviada a ${d.recipients} ${d.recipients === 1 ? "persona" : "personas"} (${d.devices ?? "?"} dispositivos).`)
        loadReach()
      } else { setState("error"); setMsg(d.error ?? "No se pudo enviar.") }
    } catch { setState("error"); setMsg("Error de red.") }
  }

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-text-2 outline-none focus:border-accent transition-colors"

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft">
          <Bell className="h-6 w-6 text-accent-ink" />
        </span>
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground leading-none">Notificaciones</h1>
          <p className="text-[13px] text-text-2 mt-1">Lanzá una notificación push a clientes o equipo.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Título</label>
          <input className={inputCls} value={title} maxLength={60} placeholder="Ej: 📞 Hoy hay llamada" onChange={(e) => { setTitle(e.target.value); setState("idle") }} />
          <p className="mt-1 text-[13px] text-text-3 text-right">{title.length}/60</p>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Mensaje</label>
          <textarea className={`${inputCls} resize-none`} rows={3} value={body} maxLength={160} placeholder="Ej: A las 13:00 (Miami). Te esperamos 👇" onChange={(e) => { setBody(e.target.value); setState("idle") }} />
          <p className="mt-1 text-[13px] text-text-3 text-right">{body.length}/160</p>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-foreground mb-1.5">Link al tocar <span className="text-text-3">(opcional)</span></label>
          <input className={inputCls} value={url} placeholder="/calendar o https://zoom.us/…" onChange={(e) => setUrl(e.target.value)} />
        </div>
      </section>

      {/* Audiencia */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-[13px] font-semibold text-foreground mb-3">¿A quién?</h2>
        <div className="grid grid-cols-2 gap-3">
          {AUDIENCES.map((a) => {
            const n = reachFor(a.key)
            const active = audience === a.key
            return (
              <button key={a.key} onClick={() => setAudience(a.key)}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${active ? "border-accent bg-secondary" : "border-border bg-background/40 hover:bg-secondary"}`}>
                <a.Icon className={`h-4 w-4 mt-0.5 shrink-0 ${active ? "text-accent-ink" : "text-text-2"}`} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{a.label}</p>
                  <p className="text-[13px] text-text-2">{a.desc}</p>
                  {a.key !== "me" && <p className="text-[13px] text-text-3 mt-0.5">{n ?? "…"} dispositivos</p>}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {msg && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] ${
          state === "error"
            ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
        }`}>
          {state === "error" ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
          {msg}
        </div>
      )}

      <button onClick={send} disabled={state === "sending"}
      className="inline-flex items-center gap-2 rounded-xl btn-accent px-5 py-2.5 text-[13px] font-bold transition active:scale-[0.98] disabled:opacity-50">
        {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Enviar notificación
      </button>
      <p className="text-[13px] text-text-3">Tip: probá primero con <strong>"Solo a mí"</strong> para ver cómo queda antes de mandarla a todos.</p>
    </div>
  )
}
