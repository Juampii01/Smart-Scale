"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { useMonthlyReports } from "@/hooks/use-monthly-reports"
import { cn } from "@/lib/utils"
import { User, Camera, Loader2, Check, Lock, Plus, X, Trash2 } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Ctx = Record<string, string>

const TABS = [
  { id: "location", label: "Ubicación y cuenta"   },
  { id: "about",    label: "Sobre vos"             },
  { id: "business", label: "Sobre tu negocio"      },
  { id: "numbers",  label: "Los números"           },
  { id: "customer", label: "Tu cliente"            },
  { id: "content",  label: "Contenido y audiencia" },
  { id: "origin",   label: "Cómo llegaste acá"     },
] as const
type TabId = typeof TABS[number]["id"]

type SaveState = "idle" | "saving" | "ok" | "error"

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelCls = "block text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/40 mb-2"
const hintCls  = "text-[12px] text-foreground/35 mt-2 leading-relaxed"

const areaCls = cn(
  "w-full rounded-[8px] border border-foreground/[0.08] bg-foreground/[0.03]",
  "px-4 py-3 text-[14px] text-foreground placeholder:text-foreground/25",
  "outline-none focus:border-foreground/[0.22] transition-colors resize-none"
)
const inputCls = cn(
  "w-full rounded-[8px] border border-foreground/[0.08] bg-foreground/[0.03]",
  "px-3 py-2 text-[14px] text-foreground placeholder:text-foreground/25",
  "outline-none focus:border-foreground/[0.22] transition-colors"
)

// ─── Field components ─────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  )
}

function MultiEntry({
  label, hint, values, onChange, placeholder = "Agregar…",
}: {
  label: string; hint?: string; values: string[]
  onChange: (v: string[]) => void; placeholder?: string
}) {
  const add = () => onChange([...values, ""])
  const upd = (i: number, v: string) => onChange(values.map((x, j) => j === i ? v : x))
  const del = (i: number) => onChange(values.filter((_, j) => j !== i))
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input className={cn(inputCls, "flex-1")} value={v} onChange={e => upd(i, e.target.value)} placeholder={placeholder} />
            <button onClick={() => del(i)} className="h-9 w-9 flex items-center justify-center rounded-[8px] border border-foreground/[0.08] text-foreground/40 hover:text-danger hover:border-danger/30 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button onClick={add} className="flex items-center gap-2 rounded-[8px] border border-foreground/[0.10] px-3 py-2 text-[12px] font-semibold text-foreground/60 hover:text-foreground hover:border-foreground/[0.20] transition-colors">
          <Plus className="h-3.5 w-3.5" /> Agregar
        </button>
      </div>
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  )
}

// ─── Account API ──────────────────────────────────────────────────────────────

interface AccountApi {
  avatarUrl: string | null
  photoBusy: boolean
  photoMsg: string | null
  onPickPhoto: (f: File) => void
  onRemovePhoto: () => void
  pw: { cur: string; n1: string; n2: string }
  setPw: (v: { cur: string; n1: string; n2: string }) => void
  pwState: SaveState
  pwMsg: string | null
  onSavePassword: () => void
}

// ─── Tab: Ubicación y cuenta ──────────────────────────────────────────────────

function LocationTab({
  name, email, account,
  onSaveName, onSaveEmail,
  setName, nameState,
  setEmail, emailState,
  ctx, set,
}: {
  name: string; email: string; account: AccountApi
  onSaveName: () => void; onSaveEmail: () => void
  setName: (v: string) => void; nameState: SaveState
  setEmail: (v: string) => void; emailState: SaveState
  ctx: Ctx; set: (k: string, v: string) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  return (
    <div className="space-y-8">
      <p className={hintCls}>Datos de identidad — se guardan en tu perfil.</p>

      {/* Foto */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ffde21]/40 bg-[#ffde21]/10">
          {account.avatarUrl
            ? <img src={account.avatarUrl} alt="Perfil" className="h-full w-full object-cover" />
            : <User className="h-7 w-7 text-[#ffde21]" />}
          <span className="absolute inset-0 hidden items-center justify-center bg-black/45 group-hover:flex">
            {account.photoBusy ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
          </span>
        </button>
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} disabled={account.photoBusy}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-foreground/[0.10] px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-foreground/[0.05] transition disabled:opacity-50">
              <Camera className="h-3.5 w-3.5" /> {account.avatarUrl ? "Cambiar foto" : "Subir foto"}
            </button>
            {account.avatarUrl && (
              <button onClick={account.onRemovePhoto} disabled={account.photoBusy}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-foreground/[0.10] px-3 py-1.5 text-[12px] font-semibold text-danger hover:bg-foreground/[0.05] transition disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" /> Quitar
              </button>
            )}
          </div>
          <p className="text-[11px] text-foreground/35">JPG, PNG o WebP. Máximo 2MB.</p>
          {account.photoMsg && <p className="text-[11px] text-success">{account.photoMsg}</p>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) account.onPickPhoto(f); e.target.value = "" }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Field label="Nombre">
          <div className="flex gap-2">
            <input className={cn(inputCls, "flex-1")} value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
            <button onClick={onSaveName} disabled={nameState === "saving"}
              className="px-3 py-2 rounded-[8px] bg-[#ffde21] text-black text-[13px] font-semibold hover:bg-[#ffe84d] disabled:opacity-50 transition-colors">
              {nameState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : nameState === "ok" ? <Check className="h-3.5 w-3.5" /> : "Guardar"}
            </button>
          </div>
        </Field>

        <Field label="Email">
          <div className="flex gap-2">
            <input className={cn(inputCls, "flex-1")} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <button onClick={onSaveEmail} disabled={emailState === "saving"}
              className="px-3 py-2 rounded-[8px] bg-foreground/[0.06] border border-foreground/[0.10] text-foreground text-[13px] font-semibold hover:bg-foreground/[0.10] disabled:opacity-50 transition-colors">
              {emailState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : emailState === "ok" ? <Check className="h-3.5 w-3.5" /> : "Guardar"}
            </button>
          </div>
        </Field>

        <Field label="Teléfono">
          <input className={inputCls} value={ctx.phone ?? ""} onChange={e => set("phone", e.target.value)} placeholder="(+54) 11 1234 5678" />
        </Field>
        <Field label="Cumpleaños">
          <input className={inputCls} type="date" value={ctx.birthday ?? ""} onChange={e => set("birthday", e.target.value)} />
        </Field>
        <Field label="País">
          <input className={inputCls} value={ctx.country ?? ""} onChange={e => set("country", e.target.value)} placeholder="Argentina" />
        </Field>
        <Field label="Ciudad">
          <input className={inputCls} value={ctx.city ?? ""} onChange={e => set("city", e.target.value)} placeholder="Buenos Aires" />
        </Field>
        <Field label="Dirección línea 1">
          <input className={inputCls} value={ctx.address1 ?? ""} onChange={e => set("address1", e.target.value)} />
        </Field>
        <Field label="Dirección línea 2">
          <input className={inputCls} value={ctx.address2 ?? ""} onChange={e => set("address2", e.target.value)} />
        </Field>
        <Field label="Código postal">
          <input className={inputCls} value={ctx.zip ?? ""} onChange={e => set("zip", e.target.value)} />
        </Field>
      </div>

      {/* Contraseña */}
      <div className="pt-6 border-t border-foreground/[0.07]">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-4 w-4 text-foreground/40" />
          <h3 className="text-[13px] font-bold text-foreground">Contraseña</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
          <input className={inputCls} type="password" autoComplete="current-password" placeholder="Actual"
            value={account.pw.cur} onChange={e => account.setPw({ ...account.pw, cur: e.target.value })} />
          <input className={inputCls} type="password" autoComplete="new-password" placeholder="Nueva (mín 6)"
            value={account.pw.n1} onChange={e => account.setPw({ ...account.pw, n1: e.target.value })} />
          <input className={inputCls} type="password" autoComplete="new-password" placeholder="Repetir nueva"
            value={account.pw.n2} onChange={e => account.setPw({ ...account.pw, n2: e.target.value })} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={account.onSavePassword} disabled={account.pwState === "saving" || !account.pw.cur || !account.pw.n1}
            className="rounded-[8px] bg-[#ffde21] px-4 py-2 text-[13px] font-semibold text-black hover:bg-[#ffe84d] disabled:opacity-50 transition-colors">
            {account.pwState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : account.pwState === "ok" ? "✓ Actualizada" : "Actualizar contraseña"}
          </button>
          {account.pwMsg && <p className={cn("text-[12px]", account.pwState === "error" ? "text-danger" : "text-success")}>{account.pwMsg}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Sobre vos ───────────────────────────────────────────────────────────

function AboutYouTab({ ctx, set }: { ctx: Ctx; set: (k: string, v: string) => void }) {
  return (
    <div className="space-y-8">
      <p className={hintCls}>Tu historia, tu energía, cómo trabajás de verdad.</p>

      <Field label="Contanos cómo terminaste haciendo esto"
        hint="Nota de voz o texto. La historia real, la versión que contarías tomando algo. Dónde empezaste, qué te hizo cambiar de rumbo, cómo llegaste a este negocio.">
        <textarea className={areaCls} rows={4} value={ctx.story ?? ""} onChange={e => set("story", e.target.value)} placeholder="Escribí tu historia…" />
      </Field>

      <Field label="¿Qué hacías antes de este negocio?"
        hint="Carrera, rol, industria. Aunque hayan sido tres cosas distintas. Nos da contexto del material con el que trabajamos.">
        <textarea className={areaCls} rows={3} value={ctx.before ?? ""} onChange={e => set("before", e.target.value)} />
      </Field>

      <Field label="Contanos sobre tu situación familiar"
        hint="¿Pareja? ¿Hijos? ¿Dónde entran en tu semana? Tu economía de tiempo y energía nos importa. Te estamos acompañando a vos, la persona; el negocio viene después.">
        <textarea className={areaCls} rows={3} value={ctx.family ?? ""} onChange={e => set("family", e.target.value)} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-6">
        <Field label="¿Dónde estás basado?" hint="La zona horaria importa — las llamadas y reuniones dependen de esto.">
          <input className={inputCls} value={ctx.location ?? ""} onChange={e => set("location", e.target.value)} placeholder="Ciudad, país" />
        </Field>
        <Field label="¿A qué hora te levantás normalmente?" hint="El número real, sé honesto.">
          <input className={inputCls} type="time" value={ctx.wakeTime ?? ""} onChange={e => set("wakeTime", e.target.value)} />
        </Field>
        <Field label="¿A qué hora te acostás normalmente?" hint="Igual — el número honesto.">
          <input className={inputCls} type="time" value={ctx.sleepTime ?? ""} onChange={e => set("sleepTime", e.target.value)} />
        </Field>
        <Field label="¿En qué momento del día estás más lúcido?" hint="Sé específico. 'A la mañana' no nos dice nada. Acá va tu trabajo profundo.">
          <input className={inputCls} value={ctx.sharpest ?? ""} onChange={e => set("sharpest", e.target.value)} placeholder="ej. 6–8am, 10am–mediodía" />
        </Field>
      </div>

      <Field label="¿Qué hacés cuando no estás trabajando?" hint="Hobbies, deportes, obsesiones raras, lo que llene tus fines de semana.">
        <input className={inputCls} value={ctx.hobbies ?? ""} onChange={e => set("hobbies", e.target.value)} />
      </Field>

      <Field label="Introvertido (1) a Extrovertido (10) — ¿dónde te ubicás?" hint="¿Cómo recargás energía de verdad? ¿Tiempo solo o con gente?">
        <div className="flex items-center gap-4">
          <input type="range" min={1} max={10} value={ctx.introvert ?? "5"} onChange={e => set("introvert", e.target.value)} className="flex-1" />
          <span className="text-[18px] font-bold tabular-nums text-foreground w-10 text-center">{ctx.introvert ?? "5"}/10</span>
        </div>
      </Field>

      <Field label="¿Qué parte de tu trabajo te drena por completo?" hint="Sé específico. ¿Llamadas de venta? ¿Slack? ¿Admin? ¿Onboarding de clientes?">
        <textarea className={areaCls} rows={3} value={ctx.drains ?? ""} onChange={e => set("drains", e.target.value)} />
      </Field>

      <Field label="¿Qué parte de tu trabajo te enciende de verdad?" hint="¿Escribir? ¿Filmar? ¿Estrategia? ¿Avances de clientes? ¿Hablar en público?">
        <textarea className={areaCls} rows={3} value={ctx.lights ?? ""} onChange={e => set("lights", e.target.value)} />
      </Field>
    </div>
  )
}

// ─── Tab: Sobre tu negocio ────────────────────────────────────────────────────

function AboutBusinessTab({ ctx, set, getArr, setArr }: { ctx: Ctx; set: (k: string, v: string) => void; getArr: (k: string) => string[]; setArr: (k: string, v: string[]) => void }) {
  return (
    <div className="space-y-8">
      <p className={hintCls}>Cuanto más completa sea la foto que nos des, más fugas y oportunidades podemos detectar.</p>

      <Field label="Contanos tu oferta actual en detalle"
        hint="Nombre de la oferta, qué entrega, formato (1-a-1, grupal, híbrido), duración del trabajo, qué incluye. Como si se lo explicaras a un amigo que está pensando en sumarse.">
        <textarea className={areaCls} rows={5} value={ctx.offer ?? ""} onChange={e => set("offer", e.target.value)} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-6">
        <Field label="¿Cuánto cuesta tu oferta?" hint="Precio total (USD). Si tenés niveles, usá el precio principal.">
          <input className={inputCls} value={ctx.price ?? ""} onChange={e => set("price", e.target.value)} placeholder="$ USD" />
        </Field>
        <Field label="Opciones de pago y niveles" hint="Planes, cuotas, precios por nivel.">
          <textarea className={areaCls} rows={3} value={ctx.paymentOptions ?? ""} onChange={e => set("paymentOptions", e.target.value)} />
        </Field>
      </div>

      <MultiEntry label="Historial de precios" hint="Cada cambio de precio desde que lanzaste la oferta. 'Mediados de 2024' está bien como fecha."
        values={getArr("pricingHistory")} onChange={v => setArr("pricingHistory", v)} placeholder="Ej: $2,000 — Jul 2024" />

      <MultiEntry label="Contanos sobre tu equipo" hint="Una entrada por persona. Dejá vacío si sos solo vos."
        values={getArr("team")} onChange={v => setArr("team", v)} placeholder="Nombre — Rol" />

      <MultiEntry label="¿Qué herramientas usás en tu negocio hoy?"
        hint="Plataforma de email, pagos, comunidad, scheduler, CRM, gestión de proyectos — todo lo que pagues mensualmente."
        values={getArr("tools")} onChange={v => setArr("tools", v)} placeholder="Herramienta — para qué la usás" />

      <Field label="Tu offer doc, sales page o pitch deck actual"
        hint="Pegá el contenido o un link al PDF / Google Doc / Notion. Lo que un prospecto ve antes de comprar.">
        <textarea className={areaCls} rows={4} value={ctx.offerDoc ?? ""} onChange={e => set("offerDoc", e.target.value)} placeholder="https:// o pegá el contenido acá…" />
      </Field>
    </div>
  )
}

// ─── Tab: Los números ─────────────────────────────────────────────────────────

function TheNumbersTab({ ctx, set, reports }: { ctx: Ctx; set: (k: string, v: string) => void; reports: ReturnType<typeof useMonthlyReports>["reports"] }) {
  const months = reports.slice(-12)
  const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  const fmtMonthLabel = (m: string) => {
    const [y, mo] = m.split("-")
    return `${monthNames[parseInt(mo, 10) - 1]} ${y}`
  }

  return (
    <div className="space-y-8">
      <p className={hintCls}>Números reales, sin redondear para arriba. Pre-llenado desde tus reportes mensuales.</p>

      <div>
        <label className={labelCls}>Revenue de los últimos 12 meses, mes a mes (USD)</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
          {months.length > 0 ? months.map(r => (
            <div key={r.month} className="rounded-[8px] border border-foreground/[0.08] bg-foreground/[0.02] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1.5">{fmtMonthLabel(r.month)}</p>
              <div className="flex items-center gap-1">
                <span className="text-foreground/40 text-[13px]">$</span>
                <input
                  className="flex-1 bg-transparent text-[15px] font-bold tabular-nums text-foreground outline-none border-0 border-b border-foreground/[0.10] pb-0.5 focus:border-[#ffde21]/60 transition-colors"
                  defaultValue={Math.round(r.total_revenue) || ""} placeholder="0" type="number"
                  onChange={e => set(`rev_${r.month}`, e.target.value)}
                />
              </div>
            </div>
          )) : Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="rounded-[8px] border border-foreground/[0.08] bg-foreground/[0.02] p-3">
              <div className="flex items-center gap-1">
                <span className="text-foreground/40 text-[13px]">$</span>
                <input className="flex-1 bg-transparent text-[15px] font-bold tabular-nums text-foreground outline-none border-0 border-b border-foreground/[0.10] pb-0.5" placeholder="0" type="number" />
              </div>
            </div>
          ))}
        </div>
        <p className={hintCls}>Los valores vienen de tus reportes mensuales y son editables.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <Field label="Del revenue del mes pasado, ¿qué % fue recurrente?"
          hint="Recurrente = suscripción, retainer, cuotas que se siguen pagando. Único = pagado completo. Una división aproximada está bien.">
          <input className={inputCls} value={ctx.recurringPct ?? ""} onChange={e => set("recurringPct", e.target.value)} placeholder="ej. 60%" />
        </Field>
        <Field label="Cash realmente cobrado el mes pasado (USD)"
          hint="Lo que efectivamente entró a tu cuenta. Si hacés planes de pago, puede ser muy distinto a lo que facturaste.">
          <input className={inputCls} type="number" value={ctx.cashLastMonth ?? ""} onChange={e => set("cashLastMonth", e.target.value)} placeholder="$" />
        </Field>
        <Field label="Aproximadamente, ¿cuál es tu margen de ganancia (%)?"
          hint="Revenue menos todos los gastos, dividido revenue. La mejor estimación sirve.">
          <input className={inputCls} value={ctx.margin ?? ""} onChange={e => set("margin", e.target.value)} placeholder="ej. 40%" />
        </Field>
        <Field label="Valor de vida promedio por cliente / LTV (USD)"
          hint="Precio promedio × estadía promedio. Si la mayoría se queda 6 meses a $2k/mes, son $12k de LTV.">
          <input className={inputCls} type="number" value={ctx.ltv ?? ""} onChange={e => set("ltv", e.target.value)} placeholder="$" />
        </Field>
        <Field label="Tasa de cierre actual (%)"
          hint="De cada 10 prospectos calificados que entran a tu proceso de venta, ¿cuántos compran?">
          <input className={inputCls} value={ctx.closeRate ?? ""} onChange={e => set("closeRate", e.target.value)} placeholder="ej. 30%" />
        </Field>
        <Field label="Clientes activos pagando ahora">
          <input className={inputCls} type="number" value={ctx.activeClients ?? ""} onChange={e => set("activeClients", e.target.value)} />
        </Field>
        <Field label="Clientes que se fueron en los últimos 90 días"
          hint="Dejaron de pagar o terminaron y no renovaron.">
          <input className={inputCls} type="number" value={ctx.churnClients ?? ""} onChange={e => set("churnClients", e.target.value)} />
        </Field>
      </div>
    </div>
  )
}

// ─── Tab: Tu cliente ──────────────────────────────────────────────────────────

function YourCustomerTab({ ctx, set, getArr, setArr }: { ctx: Ctx; set: (k: string, v: string) => void; getArr: (k: string) => string[]; setArr: (k: string, v: string[]) => void }) {
  return (
    <div className="space-y-8">
      <Field label="¿Quién es tu cliente futuro perfecto?"
        hint="Nicho, rango de facturación, situación, qué está tratando de lograr. Como si se lo describieras a alguien que tiene que escribirle mañana.">
        <textarea className={areaCls} rows={4} value={ctx.perfectClient ?? ""} onChange={e => set("perfectClient", e.target.value)} />
      </Field>
      <Field label="Contanos sobre tu mejor cliente"
        hint="Su historia. Dónde empezó, qué construyeron juntos, a dónde llegó. Números si los tenés.">
        <textarea className={areaCls} rows={4} value={ctx.bestClient ?? ""} onChange={e => set("bestClient", e.target.value)} />
      </Field>
      <Field label="Contanos sobre un cliente que no funcionó"
        hint="Sin nombres. ¿Qué salió mal? Nos dice dónde tu filtro tiene agujeros.">
        <textarea className={areaCls} rows={3} value={ctx.badClient ?? ""} onChange={e => set("badClient", e.target.value)} />
      </Field>
      <MultiEntry label="¿De dónde vienen realmente tus clientes ahora?"
        hint="Una entrada por canal. Porcentajes aproximados — no necesitan sumar exactamente 100."
        values={getArr("acquisitionChannels")} onChange={v => setArr("acquisitionChannels", v)}
        placeholder="Ej: Instagram orgánico — 50%" />
      <MultiEntry label="Videos de casos de éxito"
        hint="Dejá un link por cada video de caso de éxito que hayas grabado. Loom, YouTube, Drive — donde podamos verlo."
        values={getArr("caseStudies")} onChange={v => setArr("caseStudies", v)} placeholder="https://..." />
    </div>
  )
}

// ─── Tab: Contenido y audiencia ───────────────────────────────────────────────

function ContentAudienceTab({ ctx, set, getArr, setArr }: { ctx: Ctx; set: (k: string, v: string) => void; getArr: (k: string) => string[]; setArr: (k: string, v: string[]) => void }) {
  return (
    <div className="space-y-8">
      <MultiEntry label="Cada plataforma en la que estás activo ahora"
        hint="Una entrada por plataforma en la que realmente publicás."
        values={getArr("platforms")} onChange={v => setArr("platforms", v)} placeholder="Instagram — 3x / semana" />
      <div className="grid sm:grid-cols-2 gap-6">
        <Field label="Tamaño de tu lista de email">
          <input className={inputCls} type="number" value={ctx.emailListSize ?? ""} onChange={e => set("emailListSize", e.target.value)} />
        </Field>
        <Field label="Tasa de apertura promedio, últimos 30 días (%)">
          <input className={inputCls} value={ctx.emailOpenRate ?? ""} onChange={e => set("emailOpenRate", e.target.value)} placeholder="ej. 35%" />
        </Field>
        <Field label="¿Cada cuánto enviás emails?">
          <input className={inputCls} value={ctx.broadcastFreq ?? ""} onChange={e => set("broadcastFreq", e.target.value)} placeholder="ej. semanal, todos los martes" />
        </Field>
      </div>
      {[1,2,3,4,5].map(i => (
        <Field key={i} label={`Email reciente #${i}`}>
          <textarea className={areaCls} rows={2} value={ctx[`email${i}` as keyof Ctx] ?? ""} onChange={e => set(`email${i}`, e.target.value)} placeholder="Pegá el contenido del email o un link…" />
        </Field>
      ))}
      {[1,2,3].map(i => (
        <Field key={i} label={`Pieza de contenido largo más reciente #${i}`}>
          <input className={inputCls} value={ctx[`longform${i}` as keyof Ctx] ?? ""} onChange={e => set(`longform${i}`, e.target.value)} placeholder="https://..." />
        </Field>
      ))}
      <Field label="¿Qué hooks, temas o ángulos funcionan consistentemente con tu audiencia?"
        hint="Sé específico. 'Todo lo de ventas high-ticket sin llamadas pega' sirve. 'A mi audiencia le gusta el contenido de negocios' no.">
        <textarea className={areaCls} rows={3} value={ctx.hooksLand ?? ""} onChange={e => set("hooksLand", e.target.value)} />
      </Field>
      <Field label="¿Qué fracasó que pensabas que iba a funcionar?"
        hint="Nos sirve para saber hacia qué NO empujarte.">
        <textarea className={areaCls} rows={3} value={ctx.flopped ?? ""} onChange={e => set("flopped", e.target.value)} />
      </Field>
    </div>
  )
}

// ─── Tab: Cómo llegaste acá ───────────────────────────────────────────────────

function HowYouGotHereTab({ ctx, set }: { ctx: Ctx; set: (k: string, v: string) => void }) {
  const sel = (k: string, opts: string[]) => (
    <select className={cn(inputCls, "cursor-pointer")} value={ctx[k] ?? ""} onChange={e => set(k, e.target.value)}>
      <option value="">Elegí…</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  return (
    <div className="space-y-8">
      <p className={hintCls}>Nos ayuda a sumar gente como vos, y nos dice a qué tipo de contenido respondés.</p>
      <Field label="¿Cómo te enteraste de Smart Scale?">
        {sel("howFound", ["Instagram", "YouTube", "Referido", "LinkedIn", "Podcast", "Evento", "Otro"])}
      </Field>
      <div className="grid sm:grid-cols-2 gap-6">
        <Field label="¿Hace cuánto, más o menos?">
          <input className={inputCls} value={ctx.whenFound ?? ""} onChange={e => set("whenFound", e.target.value)} placeholder="ej. hace 4 meses" />
        </Field>
        <Field label="¿Primera pieza de nuestro contenido que recordás haber consumido?">
          <input className={inputCls} value={ctx.firstContent ?? ""} onChange={e => set("firstContent", e.target.value)} placeholder="Video, post, podcast…" />
        </Field>
      </div>
      <Field label="¿Qué pieza de contenido te hizo decir 'con estos quiero trabajar'?"
        hint="Título, tema o descripción aproximada.">
        <textarea className={areaCls} rows={2} value={ctx.decidingContent ?? ""} onChange={e => set("decidingContent", e.target.value)} />
      </Field>
      <Field label="¿Qué caso de éxito o miembro te hizo pensar 'ese soy yo'?">
        <textarea className={areaCls} rows={2} value={ctx.caseStudyResonated ?? ""} onChange={e => set("caseStudyResonated", e.target.value)} />
      </Field>
      <Field label="¿Nos escribiste por DM, por email, o te anotaste solo?">
        {sel("howJoined", ["DM en Instagram", "Email", "Me anoté solo", "Llamada", "Otro"])}
      </Field>
      <Field label="¿A quién más consideraste seriamente antes de decidirte por Smart Scale?"
        hint="Otros mentores, programas, coaches. Sin juzgar — nos sirve saber nuestra competencia real.">
        <textarea className={areaCls} rows={2} value={ctx.competitors ?? ""} onChange={e => set("competitors", e.target.value)} />
      </Field>
      <Field label="¿Estás en otro programa ahora mismo?" hint="Respuesta honesta. Muchos de nuestros mejores miembros están en varios. Nos da contexto.">
        <textarea className={areaCls} rows={2} value={ctx.otherPrograms ?? ""} onChange={e => set("otherPrograms", e.target.value)} />
      </Field>
      <Field label="¿Cuánto pasó desde que nos conociste hasta que decidiste?">
        {sel("timeToDecide", ["El mismo día", "Menos de una semana", "1-2 semanas", "Un mes", "Más de un mes"])}
      </Field>
      <Field label="¿Cuál fue la objeción que casi te frena?"
        hint="¿Precio? ¿Timing? ¿Duda de que el modelo funcione en tu nicho?">
        <textarea className={areaCls} rows={3} value={ctx.objection ?? ""} onChange={e => set("objection", e.target.value)} />
      </Field>
      <Field label="¿Cuál fue el momento o la cosa específica que te terminó de convencer?"
        hint="La respuesta más valiosa de todo el formulario. Sé específico.">
        <textarea className={areaCls} rows={3} value={ctx.tippingPoint ?? ""} onChange={e => set("tippingPoint", e.target.value)} />
      </Field>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ContextRoomView() {
  const [tab, setTab] = useState<TabId>("location")

  const supabase = createClient()
  const [userId, setUserId]   = useState<string | null>(null)
  const [name,   setNameVal]  = useState("")
  const [email,  setEmailVal] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [, setAuthLoading] = useState(true)
  const [nameState,  setNameState]  = useState<SaveState>("idle")
  const [emailState, setEmailState] = useState<SaveState>("idle")
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMsg,  setPhotoMsg]  = useState<string | null>(null)
  const [pw, setPw] = useState({ cur: "", n1: "", n2: "" })
  const [pwState, setPwState] = useState<SaveState>("idle")
  const [pwMsg,   setPwMsg]   = useState<string | null>(null)

  const getToken = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null, [])

  const [ctx, setCtx]  = useState<Ctx>({})
  const saveTimer      = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [saved, setSaved] = useState(false)

  const { reports } = useMonthlyReports()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthLoading(false); return }
      setUserId(user.id)
      setEmailVal(user.email ?? "")
      try {
        const { data: prof } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle()
        setNameVal((prof as any)?.name ?? "")
      } catch {}
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (token) {
          const res = await fetch("/api/profile/avatar", { headers: { Authorization: `Bearer ${token}` } })
          if (res.ok) { const d = await res.json(); setAvatarUrl(d.url ?? null) }
        }
      } catch {}
      try {
        const stored = localStorage.getItem(`ss_ctx_${user.id}`)
        if (stored) setCtx(JSON.parse(stored))
      } catch {}
      setAuthLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (!userId || Object.keys(ctx).length === 0) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(`ss_ctx_${userId}`, JSON.stringify(ctx))
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch {}
    }, 600)
  }, [ctx, userId])

  const set    = useCallback((k: string, v: string) => setCtx(prev => ({ ...prev, [k]: v })), [])
  const getArr = useCallback((k: string): string[] => { try { return JSON.parse(ctx[k] || "[]") } catch { return [] } }, [ctx])
  const setArr = useCallback((k: string, v: string[]) => set(k, JSON.stringify(v)), [set])

  const saveName = async () => {
    setNameState("saving")
    try {
      const token = await getToken(); if (!token) { setNameState("error"); return }
      const res = await fetch("/api/profile", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) })
      if (res.ok) {
        setNameState("ok")
        window.dispatchEvent(new CustomEvent("ss:profile-updated", { detail: { name: name.trim() } }))
      } else setNameState("error")
    } catch { setNameState("error") }
  }

  const saveEmail = async () => {
    setEmailState("saving")
    const { error } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() })
    setEmailState(error ? "error" : "ok")
  }

  const onPickPhoto = async (file: File) => {
    if (photoBusy) return
    setPhotoBusy(true); setPhotoMsg(null)
    try {
      const token = await getToken(); if (!token) return
      const fd = new FormData(); fd.append("file", file)
      const res = await fetch("/api/profile/avatar", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
      const d = await res.json()
      if (res.ok && d.url) {
        setAvatarUrl(d.url); setPhotoMsg("Foto actualizada")
        window.dispatchEvent(new CustomEvent("ss:profile-updated", { detail: { avatarUrl: d.url } }))
      } else setPhotoMsg(d.error ?? "No se pudo subir")
    } finally { setPhotoBusy(false) }
  }

  const onRemovePhoto = async () => {
    if (photoBusy || !avatarUrl) return
    setPhotoBusy(true); setPhotoMsg(null)
    try {
      const token = await getToken(); if (!token) return
      const res = await fetch("/api/profile/avatar", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        setAvatarUrl(null); setPhotoMsg("Foto eliminada")
        window.dispatchEvent(new CustomEvent("ss:profile-updated", { detail: { avatarUrl: null } }))
      } else setPhotoMsg("No se pudo eliminar")
    } finally { setPhotoBusy(false) }
  }

  const onSavePassword = async () => {
    if (pw.n1.length < 6) { setPwState("error"); setPwMsg("Mínimo 6 caracteres"); return }
    if (pw.n1 !== pw.n2)  { setPwState("error"); setPwMsg("Las contraseñas no coinciden"); return }
    setPwState("saving"); setPwMsg(null)
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: pw.cur })
    if (reauthErr) { setPwState("error"); setPwMsg("La contraseña actual es incorrecta"); return }
    const { error } = await supabase.auth.updateUser({ password: pw.n1 })
    if (error) { setPwState("error"); setPwMsg(error.message) }
    else { setPwState("ok"); setPwMsg("Contraseña actualizada"); setPw({ cur: "", n1: "", n2: "" }) }
  }

  const account: AccountApi = { avatarUrl, photoBusy, photoMsg, onPickPhoto, onRemovePhoto, pw, setPw, pwState, pwMsg, onSavePassword }

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-[22px] font-bold text-foreground leading-tight">Context Room</h1>
          <p className="text-[13px] text-foreground/50 mt-0.5">
            Tu contexto le da forma a todo lo que Smart Scale construye con vos. Los cambios se guardan automáticamente.
          </p>
        </div>
        {saved && (
          <div className="flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-[12px] font-semibold text-success">
            <Check className="h-3.5 w-3.5" /> Guardado
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="border-b border-foreground/[0.07] mt-5 mb-8 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative pb-3 px-4 text-[13px] font-semibold whitespace-nowrap transition-colors",
                tab === t.id
                  ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#ffde21] after:rounded-full"
                  : "text-foreground/40 hover:text-foreground/70"
              )}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "location" && <LocationTab name={name} email={email} account={account} onSaveName={saveName} onSaveEmail={saveEmail} setName={setNameVal} nameState={nameState} setEmail={setEmailVal} emailState={emailState} ctx={ctx} set={set} />}
      {tab === "about"    && <AboutYouTab ctx={ctx} set={set} />}
      {tab === "business" && <AboutBusinessTab ctx={ctx} set={set} getArr={getArr} setArr={setArr} />}
      {tab === "numbers"  && <TheNumbersTab ctx={ctx} set={set} reports={reports} />}
      {tab === "customer" && <YourCustomerTab ctx={ctx} set={set} getArr={getArr} setArr={setArr} />}
      {tab === "content"  && <ContentAudienceTab ctx={ctx} set={set} getArr={getArr} setArr={setArr} />}
      {tab === "origin"   && <HowYouGotHereTab ctx={ctx} set={set} />}
    </div>
  )
}
