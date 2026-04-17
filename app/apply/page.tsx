"use client"

import { useState, useRef } from "react"
import { Check, AlertCircle, Loader2, ChevronDown } from "lucide-react"

// ─── Field helpers ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder:text-white/25 focus:border-[#ffde21]/50 focus:bg-white/[0.06] focus:outline-none transition-all"

const textareaCls =
  "w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder:text-white/25 focus:border-[#ffde21]/50 focus:bg-white/[0.06] focus:outline-none transition-all resize-none"

const selectCls =
  "w-full appearance-none rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-[15px] text-white focus:border-[#ffde21]/50 focus:bg-white/[0.06] focus:outline-none transition-all cursor-pointer"

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[13px] font-semibold text-white/70 mb-2">
      {children}
      {required && <span className="ml-1 text-[#ffde21]">*</span>}
    </label>
  )
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ffde21] text-[13px] font-black text-black">
        {number}
      </div>
      <h2 className="text-[17px] font-bold text-white">{title}</h2>
    </div>
  )
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>
}

function RadioGroup({
  name, options, value, onChange,
}: {
  name: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-3 cursor-pointer group">
          <span
            onClick={() => onChange(opt)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
              value === opt
                ? "border-[#ffde21] bg-[#ffde21]"
                : "border-white/20 bg-transparent group-hover:border-white/40"
            }`}
          >
            {value === opt && <span className="h-2 w-2 rounded-full bg-black" />}
          </span>
          <span className="text-[14px] text-white/75 group-hover:text-white transition-colors">{opt}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Initial State ─────────────────────────────────────────────────────────────

const INITIAL = {
  first_name:           "",
  last_name:            "",
  email:                "",
  whatsapp:             "",
  instagram_handle:     "",
  primary_channel:      "",
  short_content_link:   "",
  youtube_podcast_link: "",
  email_list_size:      "",
  monthly_revenue:      "",
  paying_clients:       "",
  client_work_style:    "",
  income_goal:          "",
  main_blocker:         "",
  superpowers:          "",
  contribution:         "",
  motivation:           "",
  one_year_goal:        "",
  terms_accepted:       false,
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const [form, setForm]       = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  const set = (key: keyof typeof INITIAL) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm(f => ({ ...f, [key]: e.target.value }))

  const setRadio = (key: keyof typeof INITIAL) => (v: string) =>
    setForm(f => ({ ...f, [key]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side required check
    const required: (keyof typeof INITIAL)[] = [
      "first_name","last_name","email","whatsapp","instagram_handle",
      "primary_channel","short_content_link","youtube_podcast_link",
      "email_list_size","monthly_revenue","paying_clients","client_work_style",
      "income_goal","main_blocker","contribution","motivation",
    ]
    for (const k of required) {
      if (!form[k]) {
        setError("Por favor completá todos los campos obligatorios (*)")
        topRef.current?.scrollIntoView({ behavior: "smooth" })
        return
      }
    }
    if (!form.terms_accepted) {
      setError("Debés aceptar los Términos y Condiciones para continuar.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/apply", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Ocurrió un error. Intentá de nuevo.")
        setLoading(false)
        return
      }
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      setError("Error de conexión. Verificá tu internet e intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#ffde21]">
            <Check className="h-10 w-10 text-black" strokeWidth={3} />
          </div>
          <h1 className="text-3xl font-black text-white">¡Aplicación enviada!</h1>
          <p className="text-white/55 text-[15px] leading-relaxed">
            Gracias por aplicar a Smart Scale. Revisamos cada aplicación personalmente.
            <br /><br />
            Si hay match, nos vamos a contactar por Instagram. Si no, también te avisamos.
          </p>
          <div className="rounded-2xl border border-[#ffde21]/20 bg-[#ffde21]/[0.04] px-6 py-4 text-left space-y-2">
            <p className="text-[13px] font-bold text-[#ffde21]/70 uppercase tracking-widest">Próximos pasos</p>
            <ul className="space-y-1.5 text-[13px] text-white/60">
              <li>✦ Revisamos tu aplicación en detalle</li>
              <li>✦ Si tu aplicación es aprobada, te contactamos por Instagram</li>
              <li>✦ Si no hay match, también te avisamos</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0b]" ref={topRef}>
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0a0a0b]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffde21]">
            <span className="text-[13px] font-black text-black">SS</span>
          </div>
          <span className="text-[13px] font-bold text-white/60 tracking-wide uppercase">Smart Scale™</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-24 pt-10">

        {/* Hero */}
        <div className="mb-10 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ffde21]/20 bg-[#ffde21]/[0.06] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ffde21] animate-pulse" />
            <span className="text-[12px] font-bold text-[#ffde21] uppercase tracking-widest">Aplicación</span>
          </div>
          <h1 className="text-4xl font-black text-white leading-tight">
            Smart Scale<br />Application
          </h1>
          <div className="space-y-3 text-[15px] text-white/55 leading-relaxed">
            <p>
              Estamos buscando un tipo muy específico de creador que sabemos que podemos ayudar a escalar.
            </p>
            <p>
              Ayudanos a entender si sos la persona indicada para sumarte con nosotros.
            </p>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] px-5 py-4">
              <p className="text-amber-300 font-medium">
                ‼️ Importante: solo trabajamos con coaches de negocios/salud, consultores o educadores…
                si sos uno de ellos, lo vas a saber.
              </p>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
            <p className="text-[13px] text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">

          {/* ── 1. Datos personales ─────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-5">
            <SectionHeader number="1" title="Datos personales" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field>
                <Label required>Nombre</Label>
                <input value={form.first_name} onChange={set("first_name")} placeholder="Juan" className={inputCls} />
              </Field>
              <Field>
                <Label required>Apellido</Label>
                <input value={form.last_name} onChange={set("last_name")} placeholder="García" className={inputCls} />
              </Field>
            </div>
            <Field>
              <Label required>Email</Label>
              <input type="email" value={form.email} onChange={set("email")} placeholder="juan@ejemplo.com" className={inputCls} />
            </Field>
            <Field>
              <Label required>Número de WhatsApp</Label>
              <input type="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="+54 9 11 1234 5678" className={inputCls} />
            </Field>
            <Field>
              <Label required>Usuario de Instagram</Label>
              <input value={form.instagram_handle} onChange={set("instagram_handle")} placeholder="@tuusuario" className={inputCls} />
            </Field>
          </div>

          {/* ── 2. Tu negocio + objetivos ───────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-5">
            <SectionHeader number="2" title="Tu Negocio + Objetivos" />
            <Field>
              <Label required>Canal primario de formato corto</Label>
              <RadioGroup
                name="primary_channel"
                options={["Instagram", "Facebook", "Linkedin", "Tik Tok"]}
                value={form.primary_channel}
                onChange={setRadio("primary_channel")}
              />
            </Field>
            <Field>
              <Label required>Link del canal principal de contenido corto 🔗</Label>
              <input type="url" value={form.short_content_link} onChange={set("short_content_link")}
                placeholder="https://instagram.com/tuusuario" className={inputCls} />
            </Field>
            <Field>
              <Label required>Link de tu canal de YouTube o Podcast 🔗</Label>
              <input type="url" value={form.youtube_podcast_link} onChange={set("youtube_podcast_link")}
                placeholder="https://youtube.com/@tucanal" className={inputCls} />
            </Field>
          </div>

          {/* ── 3. Audiencia y métricas ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-5">
            <SectionHeader number="3" title="Audiencia y Métricas" />
            <Field>
              <Label required>¿De qué tamaño es tu lista de emails actualmente?</Label>
              <div className="relative">
                <select value={form.email_list_size} onChange={set("email_list_size")} className={selectCls}>
                  <option value="">Seleccioná una opción</option>
                  <option value="0">0</option>
                  <option value="Menos de 500">Menos de 500</option>
                  <option value="500 - 1000">500 – 1000</option>
                  <option value="1000 - 5000">1000 – 5000</option>
                  <option value="5000 - 10000">5000 – 10000</option>
                  <option value="Mas de 10000">Más de 10.000</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
            </Field>
            <Field>
              <Label required>En promedio, ¿cuánto facturó tu negocio en los últimos 3 meses? (USD)</Label>
              <div className="relative">
                <select value={form.monthly_revenue} onChange={set("monthly_revenue")} className={selectCls}>
                  <option value="">Seleccioná una opción</option>
                  <option value="$0 – $5K / mes">$0 – $5K / mes</option>
                  <option value="$5K – $10K / mes">$5K – $10K / mes</option>
                  <option value="$10K – $20K / mes">$10K – $20K / mes</option>
                  <option value="$20K – $40K / mes">$20K – $40K / mes</option>
                  <option value="$40K – $60K / mes">$40K – $60K / mes</option>
                  <option value="$60K – $80K / mes">$60K – $80K / mes</option>
                  <option value="$80K – $100K / mes">$80K – $100K / mes</option>
                  <option value="$100K+ / mes">$100K+ / mes</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
            </Field>
            <Field>
              <Label required>¿Cuántos clientes pagos tenés actualmente?</Label>
              <input type="number" min="0" value={form.paying_clients} onChange={set("paying_clients")}
                placeholder="Ej: 12" className={inputCls} />
            </Field>
            <Field>
              <Label required>¿Cómo trabajás actualmente con tus clientes?</Label>
              <RadioGroup
                name="client_work_style"
                options={["Solo 1 a 1", "1 a 1 + Grupal (híbrido)", "Solo grupal"]}
                value={form.client_work_style}
                onChange={setRadio("client_work_style")}
              />
            </Field>
          </div>

          {/* ── 4. Objetivos y bloqueos ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-5">
            <SectionHeader number="4" title="Objetivos y Bloqueos" />
            <Field>
              <Label required>¿Cuál es tu objetivo de ingresos mensuales?</Label>
              <input value={form.income_goal} onChange={set("income_goal")}
                placeholder="Ej: $30.000 USD / mes" className={inputCls} />
            </Field>
            <Field>
              <Label required>¿Qué es lo que hoy te está frenando para alcanzar ese objetivo?</Label>
              <textarea value={form.main_blocker} onChange={set("main_blocker")} rows={4}
                placeholder="Contanos con detalle..." className={textareaCls} />
            </Field>
          </div>

          {/* ── 5. Por qué vos ──────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-5">
            <SectionHeader number="5" title="¿Por qué vos?" />
            <p className="text-[13px] text-white/40 -mt-2">
              Smart Scale™️ es una comunidad y red de creadores de alto nivel.
            </p>
            <Field>
              <Label>¿Cuáles son tus superpoderes?</Label>
              <textarea value={form.superpowers} onChange={set("superpowers")} rows={3}
                placeholder="¿En qué sos realmente bueno?" className={textareaCls} />
            </Field>
            <Field>
              <Label required>¿Qué creés que podés aportar al equipo de Smart Scale™️?</Label>
              <textarea value={form.contribution} onChange={set("contribution")} rows={3}
                placeholder="Tu perspectiva, experiencia, habilidades..." className={textareaCls} />
            </Field>
            <Field>
              <Label required>
                ¿Qué fue lo que viste en el contenido o en Smart Scale que te hizo pensar "ok, esto es lo que necesito ahora"?
              </Label>
              <textarea value={form.motivation} onChange={set("motivation")} rows={3}
                placeholder="Sé específico/a..." className={textareaCls} />
            </Field>
            <Field>
              <Label>
                Si en 1 año nos tomáramos un café, ¿qué estaríamos celebrando de verdad en tu negocio?
              </Label>
              <textarea value={form.one_year_goal} onChange={set("one_year_goal")} rows={3}
                placeholder="Tu visión a 12 meses..." className={textareaCls} />
            </Field>
          </div>

          {/* ── 6. Términos ─────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-4">
            <SectionHeader number="6" title="Términos y Condiciones" />
            <label className="flex items-start gap-3 cursor-pointer group">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, terms_accepted: !f.terms_accepted }))}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                  form.terms_accepted
                    ? "border-[#ffde21] bg-[#ffde21]"
                    : "border-white/20 bg-transparent group-hover:border-white/40"
                }`}
              >
                {form.terms_accepted && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
              </button>
              <span className="text-[14px] text-white/65 leading-relaxed">
                Sí, he leído y acepto los{" "}
                <span className="text-[#ffde21] cursor-pointer hover:underline">Términos y Condiciones</span>
                <span className="text-[#ffde21] ml-1">*</span>
              </span>
            </label>
          </div>

          {/* ── Important notice ────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] px-6 py-5 space-y-3">
            <p className="text-[12px] font-black uppercase tracking-widest text-amber-400">⚠️ Importante — leé antes de enviar</p>
            <p className="text-[13px] text-white/55 leading-relaxed">
              Buscamos únicamente creadores comprometidos, enfocados y listos para avanzar.
            </p>
            <ul className="space-y-2 text-[13px] text-white/50">
              <li>→ Por favor no cierres la ventana cuando completes el form</li>
              <li>→ Si tu aplicación es aprobada, te contactamos por Instagram con toda la propuesta</li>
              <li>→ Si vemos que no hay match, también te avisamos por Instagram</li>
            </ul>
          </div>

          {/* ── Submit ──────────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-[#ffde21] text-[16px] font-black text-black hover:bg-[#ffe84d] active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Enviando...</>
            ) : (
              "Enviar aplicación →"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
