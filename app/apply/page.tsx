"use client"

import { useState, useRef } from "react"
import { Check, AlertCircle, Loader2, ChevronDown, ArrowRight } from "lucide-react"

// ─── Shared input styles (inline bg for Tailwind arbitrary-color safety) ───────

const inputBase =
  "w-full rounded-xl border px-4 py-3 text-[15px] text-white placeholder:text-white/30 focus:outline-none transition-all"

function inputStyle(focused = false) {
  return {
    backgroundColor: focused ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
    borderColor:     focused ? "rgba(255,222,33,0.45)"  : "rgba(255,255,255,0.09)",
  }
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[13px] font-semibold text-white/60 mb-2 tracking-wide">
      {children}
      {required && <span className="ml-1 text-[#ffde21]">*</span>}
    </label>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-white/[0.07] p-7 space-y-6"
      style={{ backgroundColor: "#111113" }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-4 pb-1">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ffde21] text-[13px] font-black text-black mt-0.5">
        {number}
      </div>
      <div>
        <h2 className="text-[18px] font-bold text-white leading-tight">{title}</h2>
        {subtitle && <p className="text-[13px] text-white/40 mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      style={inputStyle(focused)}
      className={inputBase}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e  => { setFocused(false); props.onBlur?.(e) }}
    />
  )
}

function StyledTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      {...props}
      style={inputStyle(focused)}
      className={inputBase + " resize-none"}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e  => { setFocused(false); props.onBlur?.(e) }}
    />
  )
}

function StyledSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="relative">
      <select
        {...props}
        style={{ ...inputStyle(focused), backgroundColor: "#111113" }}
        className={inputBase + " appearance-none cursor-pointer"}
        onFocus={e => { setFocused(true); props.onFocus?.(e) }}
        onBlur={e  => { setFocused(false); props.onBlur?.(e) }}
      />
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
    </div>
  )
}

function RadioGroup({ name, options, value, onChange }: {
  name: string; options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-3 cursor-pointer group" onClick={() => onChange(opt)}>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
            value === opt ? "border-[#ffde21] bg-[#ffde21]" : "border-white/20 group-hover:border-white/40"
          }`}>
            {value === opt && <span className="h-2 w-2 rounded-full bg-black" />}
          </span>
          <span className="text-[14px] text-white/70 group-hover:text-white transition-colors">{opt}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL = {
  first_name: "", last_name: "", email: "", whatsapp: "", instagram_handle: "",
  primary_channel: "", short_content_link: "", youtube_podcast_link: "",
  email_list_size: "", monthly_revenue: "", paying_clients: "", client_work_style: "",
  income_goal: "", main_blocker: "", superpowers: "", contribution: "",
  motivation: "", one_year_goal: "", terms_accepted: false,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplyPage() {
  const [form, setForm]           = useState(INITIAL)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)

  const set = (key: keyof typeof INITIAL) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))

  const setRadio = (key: keyof typeof INITIAL) => (v: string) =>
    setForm(f => ({ ...f, [key]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

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
      topRef.current?.scrollIntoView({ behavior: "smooth" })
      return
    }

    setLoading(true)
    try {
      const res  = await fetch("/api/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Ocurrió un error. Intentá de nuevo."); return }
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
      <div className="min-h-screen flex items-center justify-center px-4 py-20" style={{ backgroundColor: "#0a0a0b" }}>
        <div className="max-w-md w-full text-center space-y-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#ffde21]">
            <Check className="h-10 w-10 text-black" strokeWidth={3} />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-white">¡Aplicación enviada!</h1>
            <p className="text-white/50 text-[15px] leading-relaxed">
              Revisamos cada aplicación personalmente. Si hay match, te contactamos por Instagram.
            </p>
          </div>
          <div className="rounded-2xl border border-[#ffde21]/15 p-6 text-left space-y-3" style={{ backgroundColor: "#111113" }}>
            <p className="text-[11px] font-black text-[#ffde21]/60 uppercase tracking-[0.2em]">Próximos pasos</p>
            <ul className="space-y-2.5 text-[13px] text-white/55">
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#ffde21] shrink-0" />
                Revisamos tu aplicación en detalle
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#ffde21] shrink-0" />
                Si tu aplicación es aprobada, te contactamos por Instagram
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#ffde21] shrink-0" />
                Si no hay match, también te avisamos
              </li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0b" }} ref={topRef}>

      {/* ── Top bar (same style as portal header) */}
      <div
        className="sticky top-0 z-10 border-b border-white/[0.07] backdrop-blur-md"
        style={{ backgroundColor: "rgba(10,10,11,0.96)" }}
      >
        <div className="mx-auto max-w-2xl px-5 py-3.5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <span className="text-white text-[17px] font-bold tracking-tight">Smart</span>
            <span className="rounded-md bg-white px-2 py-0.5 text-[14px] font-bold tracking-tight text-black shadow-sm">
              Scale
            </span>
            <span className="text-[9px] font-semibold text-white/25 tracking-widest uppercase ml-0.5">v2.0</span>
          </a>
          <span className="text-[11px] font-bold text-white/25 uppercase tracking-[0.18em]">Application</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 pb-28 pt-12 space-y-5">

        {/* ── Hero */}
        <div className="space-y-5 pb-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ffde21]/20 px-4 py-1.5" style={{ backgroundColor: "rgba(255,222,33,0.06)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#ffde21] animate-pulse" />
            <span className="text-[11px] font-bold text-[#ffde21] uppercase tracking-[0.18em]">Smart Scale™</span>
          </div>
          <h1 className="text-[38px] font-black text-white leading-[1.1] tracking-tight">
            Aplicá a<br />Smart Scale
          </h1>
          <p className="text-[15px] text-white/50 leading-relaxed max-w-lg">
            Estamos buscando un tipo muy específico de creador que sabemos que podemos ayudar a escalar.
            Ayudanos a entender si sos la persona indicada.
          </p>
          <div className="rounded-xl border border-amber-500/20 px-5 py-4" style={{ backgroundColor: "rgba(245,158,11,0.05)" }}>
            <p className="text-[13px] text-amber-300/80 leading-relaxed">
              <span className="font-bold text-amber-300">Solo trabajamos con</span> coaches de negocios o salud, consultores y educadores.
              Si sos uno de ellos, lo vas a saber.
            </p>
          </div>
        </div>

        {/* ── Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/25 px-4 py-3.5" style={{ backgroundColor: "rgba(239,68,68,0.07)" }}>
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <p className="text-[13px] text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* 1. Datos personales */}
          <SectionCard>
            <SectionHeader number="1" title="Datos personales" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field>
                <Label required>Nombre</Label>
                <StyledInput value={form.first_name} onChange={set("first_name")} placeholder="Juan" />
              </Field>
              <Field>
                <Label required>Apellido</Label>
                <StyledInput value={form.last_name} onChange={set("last_name")} placeholder="García" />
              </Field>
            </div>
            <Field>
              <Label required>Email</Label>
              <StyledInput type="email" value={form.email} onChange={set("email")} placeholder="juan@ejemplo.com" />
            </Field>
            <Field>
              <Label required>Número de WhatsApp</Label>
              <StyledInput type="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="+54 9 11 1234 5678" />
            </Field>
            <Field>
              <Label required>Usuario de Instagram</Label>
              <StyledInput value={form.instagram_handle} onChange={set("instagram_handle")} placeholder="@tuusuario" />
            </Field>
          </SectionCard>

          {/* 2. Tu negocio */}
          <SectionCard>
            <SectionHeader number="2" title="Tu Negocio" subtitle="Contanos sobre tu canal y presencia digital" />
            <Field>
              <Label required>Canal principal de contenido corto</Label>
              <RadioGroup
                name="primary_channel"
                options={["Instagram", "Facebook", "LinkedIn", "TikTok"]}
                value={form.primary_channel}
                onChange={setRadio("primary_channel")}
              />
            </Field>
            <Field>
              <Label required>Link del canal principal 🔗</Label>
              <StyledInput type="url" value={form.short_content_link} onChange={set("short_content_link")}
                placeholder="https://instagram.com/tuusuario" />
            </Field>
            <Field>
              <Label required>Link de YouTube o Podcast 🔗</Label>
              <StyledInput type="url" value={form.youtube_podcast_link} onChange={set("youtube_podcast_link")}
                placeholder="https://youtube.com/@tucanal" />
            </Field>
          </SectionCard>

          {/* 3. Audiencia y métricas */}
          <SectionCard>
            <SectionHeader number="3" title="Audiencia y Métricas" />
            <Field>
              <Label required>Tamaño de tu lista de emails</Label>
              <StyledSelect value={form.email_list_size} onChange={set("email_list_size")}>
                <option value="">Seleccioná una opción</option>
                <option value="0">0</option>
                <option value="Menos de 500">Menos de 500</option>
                <option value="500 - 1000">500 – 1.000</option>
                <option value="1000 - 5000">1.000 – 5.000</option>
                <option value="5000 - 10000">5.000 – 10.000</option>
                <option value="Mas de 10000">Más de 10.000</option>
              </StyledSelect>
            </Field>
            <Field>
              <Label required>Facturación promedio (últimos 3 meses, en USD)</Label>
              <StyledSelect value={form.monthly_revenue} onChange={set("monthly_revenue")}>
                <option value="">Seleccioná una opción</option>
                <option value="$0 – $5K / mes">$0 – $5K / mes</option>
                <option value="$5K – $10K / mes">$5K – $10K / mes</option>
                <option value="$10K – $20K / mes">$10K – $20K / mes</option>
                <option value="$20K – $40K / mes">$20K – $40K / mes</option>
                <option value="$40K – $60K / mes">$40K – $60K / mes</option>
                <option value="$60K – $80K / mes">$60K – $80K / mes</option>
                <option value="$80K – $100K / mes">$80K – $100K / mes</option>
                <option value="$100K+ / mes">$100K+ / mes</option>
              </StyledSelect>
            </Field>
            <Field>
              <Label required>Clientes pagos actualmente</Label>
              <StyledInput type="number" min="0" value={form.paying_clients} onChange={set("paying_clients")}
                placeholder="Ej: 12" />
            </Field>
            <Field>
              <Label required>¿Cómo trabajás con tus clientes?</Label>
              <RadioGroup
                name="client_work_style"
                options={["Solo 1 a 1", "1 a 1 + Grupal (híbrido)", "Solo grupal"]}
                value={form.client_work_style}
                onChange={setRadio("client_work_style")}
              />
            </Field>
          </SectionCard>

          {/* 4. Objetivos y bloqueos */}
          <SectionCard>
            <SectionHeader number="4" title="Objetivos y Bloqueos" />
            <Field>
              <Label required>¿Cuál es tu objetivo de ingresos mensuales?</Label>
              <StyledInput value={form.income_goal} onChange={set("income_goal")}
                placeholder="Ej: $30.000 USD / mes" />
            </Field>
            <Field>
              <Label required>¿Qué te está frenando para llegar ahí?</Label>
              <StyledTextarea value={form.main_blocker} onChange={set("main_blocker")} rows={4}
                placeholder="Contanos con detalle..." />
            </Field>
          </SectionCard>

          {/* 5. ¿Por qué vos? */}
          <SectionCard>
            <SectionHeader number="5" title="¿Por qué vos?"
              subtitle="Smart Scale™ es una comunidad de creadores de alto nivel." />
            <Field>
              <Label>¿Cuáles son tus superpoderes?</Label>
              <StyledTextarea value={form.superpowers} onChange={set("superpowers")} rows={3}
                placeholder="¿En qué sos realmente bueno/a?" />
            </Field>
            <Field>
              <Label required>¿Qué podés aportar al equipo de Smart Scale™?</Label>
              <StyledTextarea value={form.contribution} onChange={set("contribution")} rows={3}
                placeholder="Tu perspectiva, experiencia, habilidades..." />
            </Field>
            <Field>
              <Label required>¿Qué viste en Smart Scale que te hizo pensar "esto es lo que necesito"?</Label>
              <StyledTextarea value={form.motivation} onChange={set("motivation")} rows={3}
                placeholder="Sé específico/a..." />
            </Field>
            <Field>
              <Label>Si en 1 año nos tomáramos un café, ¿qué estaríamos celebrando?</Label>
              <StyledTextarea value={form.one_year_goal} onChange={set("one_year_goal")} rows={3}
                placeholder="Tu visión a 12 meses..." />
            </Field>
          </SectionCard>

          {/* 6. Términos */}
          <SectionCard>
            <SectionHeader number="6" title="Términos y Condiciones" />
            <label className="flex items-start gap-3 cursor-pointer group"
              onClick={() => setForm(f => ({ ...f, terms_accepted: !f.terms_accepted }))}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                form.terms_accepted
                  ? "border-[#ffde21] bg-[#ffde21]"
                  : "border-white/20 group-hover:border-white/40"
              }`}>
                {form.terms_accepted && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
              </span>
              <span className="text-[14px] text-white/60 leading-relaxed group-hover:text-white/80 transition-colors">
                He leído y acepto los{" "}
                <span className="text-[#ffde21] hover:underline">Términos y Condiciones</span>
                <span className="text-[#ffde21] ml-1">*</span>
              </span>
            </label>
          </SectionCard>

          {/* Notice */}
          <div className="rounded-xl border border-white/[0.06] px-5 py-4 space-y-2" style={{ backgroundColor: "#111113" }}>
            <p className="text-[11px] font-black text-white/30 uppercase tracking-[0.18em]">Antes de enviar</p>
            <ul className="space-y-1.5 text-[13px] text-white/40">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-white/20 shrink-0" />
                No cierres la ventana mientras se envía el formulario
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-white/20 shrink-0" />
                Si tu aplicación es aprobada, te contactamos por Instagram con toda la propuesta
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-white/20 shrink-0" />
                Si no hay match, también te avisamos
              </li>
            </ul>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl text-[16px] font-black text-black hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all"
            style={{ backgroundColor: "#ffde21" }}
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Enviando...</>
            ) : (
              <><span>Enviar aplicación</span><ArrowRight className="h-5 w-5" /></>
            )}
          </button>

        </form>
      </div>
    </div>
  )
}
