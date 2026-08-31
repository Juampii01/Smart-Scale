"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

// ─── Shared styles (mismo criterio que context-room-view.tsx) ────────────────

const labelCls = "block text-[11px] font-bold uppercase tracking-[0.10em] text-text-2 mb-2"
const hintCls  = "text-[13px] text-text-3 mt-2 leading-relaxed"

const areaCls = cn(
  "w-full rounded-[8px] border border-border bg-foreground/[0.03]",
  "px-4 py-3 text-[15px] text-foreground placeholder:text-text-3",
  "outline-none focus:border-border-hover transition-colors resize-none"
)
const inputCls = cn(
  "w-full rounded-[8px] border border-border bg-foreground/[0.03]",
  "px-3 py-2 text-[15px] text-foreground placeholder:text-text-3",
  "outline-none focus:border-border-hover transition-colors"
)

type Ctx = Record<string, string>

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  )
}

export function TeamContextRoomView() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [ctx, setCtx] = useState<Ctx>({})
  const [ctxLoaded, setCtxLoaded] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    let alive = true
    if (!userId) return
    setCtxLoaded(false)
    supabase
      .from("team_member_context")
      .select("context")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        setCtx(((data as any)?.context as Ctx) ?? {})
        setCtxLoaded(true)
      })
    return () => { alive = false }
  }, [userId])

  useEffect(() => {
    if (!userId || !ctxLoaded) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("team_member_context")
        .upsert({ user_id: userId, context: ctx }, { onConflict: "user_id" })
      if (!error) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }, 600)
  }, [ctx, userId, ctxLoaded])

  const set = useCallback((k: string, v: string) => setCtx(prev => ({ ...prev, [k]: v })), [])

  return (
    <div className="pb-10">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-[24px] font-bold text-foreground leading-tight">Mi Context Room</h1>
          <p className="text-[13px] text-text-2 mt-0.5">
            Tu espacio personal — nada de negocio ni de números acá, solo vos. Los cambios se guardan automáticamente.
          </p>
        </div>
        {saved && (
          <div className="flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-[13px] font-semibold text-success">
            <Check className="h-3.5 w-3.5" /> Guardado
          </div>
        )}
      </div>

      <div className="mt-8 space-y-8 max-w-2xl">
        <Field label="Contanos cómo llegaste a formar parte de Smart Scale"
          hint="La historia real — dónde estabas antes, qué te hizo sumarte.">
          <textarea className={areaCls} rows={4} value={ctx.story ?? ""} onChange={e => set("story", e.target.value)} placeholder="Escribí tu historia…" />
        </Field>

        <Field label="¿A qué te dedicabas antes de sumarte al equipo?"
          hint="Carrera, rol, industria. Nos da contexto de con quién estamos trabajando.">
          <textarea className={areaCls} rows={3} value={ctx.before ?? ""} onChange={e => set("before", e.target.value)} />
        </Field>

        <Field label="Contanos sobre tu situación familiar"
          hint="¿Pareja? ¿Hijos? ¿Dónde entran en tu semana? Te acompañamos a vos, la persona.">
          <textarea className={areaCls} rows={3} value={ctx.family ?? ""} onChange={e => set("family", e.target.value)} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-6">
          <Field label="¿Dónde estás basado?" hint="La zona horaria importa para calls y reuniones.">
            <input className={inputCls} value={ctx.location ?? ""} onChange={e => set("location", e.target.value)} placeholder="Ciudad, país" />
          </Field>
          <Field label="¿A qué hora te levantás normalmente?" hint="El número real, sé honesto.">
            <input className={inputCls} type="time" value={ctx.wakeTime ?? ""} onChange={e => set("wakeTime", e.target.value)} />
          </Field>
          <Field label="¿A qué hora te acostás normalmente?" hint="Igual — el número honesto.">
            <input className={inputCls} type="time" value={ctx.sleepTime ?? ""} onChange={e => set("sleepTime", e.target.value)} />
          </Field>
          <Field label="¿En qué momento del día estás más lúcido?" hint="Sé específico. 'A la mañana' no nos dice nada.">
            <input className={inputCls} value={ctx.sharpest ?? ""} onChange={e => set("sharpest", e.target.value)} placeholder="ej. 6–8am, 10am–mediodía" />
          </Field>
        </div>

        <Field label="¿Qué hacés cuando no estás trabajando?" hint="Hobbies, deportes, obsesiones raras.">
          <input className={inputCls} value={ctx.hobbies ?? ""} onChange={e => set("hobbies", e.target.value)} />
        </Field>

        <Field label="Introvertido (1) a Extrovertido (10) — ¿dónde te ubicás?" hint="¿Cómo recargás energía de verdad? ¿Tiempo solo o con gente?">
          <div className="flex items-center gap-4">
            <input type="range" min={1} max={10} value={ctx.introvert ?? "5"} onChange={e => set("introvert", e.target.value)} className="flex-1" />
            <span className="text-[18px] font-bold tabular-nums text-foreground w-10 text-center">{ctx.introvert ?? "5"}/10</span>
          </div>
        </Field>

        <Field label="¿Qué parte de tu trabajo en Smart Scale te drena por completo?" hint="Sé específico. ¿Llamadas? ¿Slack? ¿Admin? ¿Reportes?">
          <textarea className={areaCls} rows={3} value={ctx.drains ?? ""} onChange={e => set("drains", e.target.value)} />
        </Field>

        <Field label="¿Qué parte de tu trabajo en Smart Scale te enciende de verdad?" hint="¿Hablar con clientes? ¿Resolver algo técnico? ¿Estrategia?">
          <textarea className={areaCls} rows={3} value={ctx.lights ?? ""} onChange={e => set("lights", e.target.value)} />
        </Field>

        <Field label="¿Qué es lo que más te frustra de tu día a día hoy?" hint="Sin filtro. Nos ayuda a saber dónde ajustar.">
          <textarea className={areaCls} rows={3} value={ctx.frustration ?? ""} onChange={e => set("frustration", e.target.value)} />
        </Field>
      </div>
    </div>
  )
}
