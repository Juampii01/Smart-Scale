"use client"

import { useMemo, useRef, useState } from "react"
import { Check, AlertCircle } from "lucide-react"
import {
  CONTACT_FIELD_IDS,
  getFormByRole,
  type FormField,
  type RoleForm,
} from "@/lib/team-application-forms"

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputBase =
  "w-full rounded-xl border px-4 py-3 text-[15px] text-foreground placeholder:text-foreground/30 focus:outline-none transition-all"

function inputStyle(focused = false) {
  return {
    backgroundColor: focused ? "color-mix(in srgb, var(--foreground) 5%, transparent)" : "color-mix(in srgb, var(--foreground) 3%, transparent)",
    borderColor: focused ? "rgba(255, 222, 33, 0.45)" : "var(--border)",
  }
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[13px] font-semibold text-foreground/60 mb-2 tracking-wide leading-snug">
      {children}
      {required && <span className="ml-1 text-[#dafc69]">*</span>}
    </label>
  )
}

function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="-mt-1 mb-1 text-[12px] text-foreground/40 leading-relaxed">{children}</p>
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-foreground/[0.07] p-5 sm:p-7 space-y-5 sm:space-y-6"
      style={{ backgroundColor: "var(--card)" }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-start gap-4 pb-1">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dafc69] text-[13px] font-black text-black mt-0.5">
        {number}
      </div>
      <h2 className="text-[18px] font-bold text-foreground leading-tight pt-1.5">{title}</h2>
    </div>
  )
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
      rows={4}
      className={inputBase + " resize-none"}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e  => { setFocused(false); props.onBlur?.(e) }}
    />
  )
}

function RadioGroup({
  options, value, onChange,
}: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-3 cursor-pointer group" onClick={() => onChange(opt)}>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
            value === opt ? "border-[#dafc69] bg-[#dafc69]" : "border-foreground/20 group-hover:border-foreground/40"
          }`}>
            {value === opt && <span className="h-2 w-2 rounded-full bg-black" />}
          </span>
          <span className="text-[14px] text-foreground/70 group-hover:text-foreground transition-colors">{opt}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export function TeamApplicationForm({ rol }: { rol: string }) {
  const form = useMemo(() => getFormByRole(rol), [rol])

  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [gated, setGated] = useState<{ message: string } | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  // ── Rol no encontrado ───────────────────────────────────────────────────────
  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-20" style={{ backgroundColor: "var(--background)" }}>
        <div className="max-w-md w-full text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-400/30">
            <AlertCircle className="h-8 w-8 text-amber-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-foreground">Puesto no disponible</h1>
            <p className="text-foreground/50 text-[14px] leading-relaxed">
              No encontramos el puesto <span className="font-mono text-amber-300">{rol}</span>. Puede que el link esté desactualizado o el puesto haya sido cerrado.
            </p>
          </div>
          <a href="/" className="inline-block rounded-xl bg-[#dafc69] px-5 py-2.5 text-[13px] font-bold text-black hover:bg-[#f2ffc0] transition">
            Volver al inicio
          </a>
        </div>
      </div>
    )
  }

  const setVal = (id: string, v: string) => {
    setValues(prev => ({ ...prev, [id]: v }))
    const field = findField(form, id)
    if (field?.gate && v === field.gate.value) {
      setGated({ message: field.gate.message })
    } else if (gated) {
      const stillGated = anyGateTriggered(form, { ...values, [id]: v })
      if (!stillGated) setGated(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (gated) return

    for (const section of form.sections) {
      if (!section.fields) continue
      for (const field of section.fields) {
        if (field.required && !(values[field.id] ?? "").trim()) {
          setError("Por favor completá todos los campos obligatorios (*).")
          topRef.current?.scrollIntoView({ behavior: "smooth" })
          return
        }
      }
    }

    const contact: Record<string, string> = {}
    const answers: Record<string, string> = {}
    for (const [k, v] of Object.entries(values)) {
      if (CONTACT_FIELD_IDS.includes(k)) contact[k] = v
      else answers[k] = v
    }

    setLoading(true)
    try {
      const res = await fetch("/api/team-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: form.role, ...contact, answers }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json?.gated) {
          setGated({ message: json.error })
        } else {
          setError(json?.error ?? "Ocurrió un error. Intentá de nuevo.")
        }
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
      <div className="min-h-screen flex items-center justify-center px-4 py-20" style={{ backgroundColor: "var(--background)" }}>
        <div className="max-w-md w-full text-center space-y-6 sm:space-y-8 px-2">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#dafc69]">
            <Check className="h-10 w-10 text-black" strokeWidth={3} />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-foreground">¡Aplicación enviada!</h1>
            <p className="text-foreground/50 text-[15px] leading-relaxed">
              Revisamos cada aplicación. Si hay fit, te contactamos en los próximos días.
              Si no recibís respuesta en 7 días, no hubo match por ahora — pero guardamos tu perfil para futuras aperturas.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }} ref={topRef}>

      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-foreground/[0.07] backdrop-blur-md" style={{ backgroundColor: "color-mix(in srgb, var(--background) 96%, transparent)" }}>
        <div className="mx-auto max-w-2xl px-5 py-3.5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <span className="text-foreground text-[17px] font-bold tracking-tight">Smart</span>
            <span className="rounded-md bg-foreground px-2 py-0.5 text-[14px] font-bold tracking-tight text-background shadow-sm">Scale</span>
            <span className="text-[9px] font-semibold text-foreground/25 tracking-widest uppercase ml-0.5">v2.0</span>
          </a>
          <span className="text-[11px] font-bold text-foreground/25 uppercase tracking-[0.18em]">Equipo</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 sm:px-5 pb-20 sm:pb-28 pt-8 sm:pt-12 space-y-4 sm:space-y-5">

        {/* Hero */}
        <div className="space-y-5 pb-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dafc69]/20 px-4 py-1.5" style={{ backgroundColor: "rgba(255,222,33,0.06)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#dafc69] animate-pulse" />
            <span className="text-[11px] font-bold text-[#dafc69] uppercase tracking-[0.18em]">Smart Scale Team</span>
          </div>
          <h1 className="text-[28px] sm:text-[38px] font-black text-foreground leading-[1.1] tracking-tight">
            {form.title}
          </h1>
          {form.subtitle && (
            <p className="text-[15px] text-foreground/50 leading-relaxed max-w-lg whitespace-pre-line">
              {form.subtitle}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/25 px-4 py-3.5" style={{ backgroundColor: "rgba(239,68,68,0.07)" }}>
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <p className="text-[13px] text-red-300">{error}</p>
          </div>
        )}

        {/* Gated banner */}
        {gated && (
          <div className="rounded-2xl border border-amber-500/25 px-5 py-4" style={{ backgroundColor: "rgba(245,158,11,0.06)" }}>
            <p className="text-[11px] font-bold text-amber-300/80 uppercase tracking-[0.18em] mb-2">Este puesto no es para vos</p>
            <p className="text-[14px] text-amber-200/85 leading-relaxed">{gated.message}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.sections.map((section, sIdx) => {
            const number = String(sIdx + 1)

            if (section.info) {
              return (
                <SectionCard key={`info-${sIdx}`}>
                  <SectionHeader number={number} title={section.title} />
                  <div className="text-[14px] text-foreground/65 leading-relaxed whitespace-pre-line pl-[52px]">
                    {section.info}
                  </div>
                </SectionCard>
              )
            }

            return (
              <SectionCard key={`s-${sIdx}`}>
                <SectionHeader number={number} title={section.title} />
                <div className="space-y-5 pl-[52px]">
                  {section.fields?.map(field => (
                    <FieldRenderer
                      key={field.id}
                      field={field}
                      value={values[field.id] ?? ""}
                      onChange={(v) => setVal(field.id, v)}
                    />
                  ))}
                </div>
              </SectionCard>
            )
          })}

          <button
            type="submit"
            disabled={loading || !!gated}
            className="w-full rounded-2xl bg-[#dafc69] px-6 py-4 text-[15px] font-black text-black transition hover:bg-[#f2ffc0] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando…" : gated ? "Aplicación bloqueada" : "Enviar aplicación"}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Field renderer ───────────────────────────────────────────────────────────

function FieldRenderer({ field, value, onChange }: {
  field: FormField
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label required={field.required}>{field.label}</Label>
      {field.help && <HelpText>{field.help}</HelpText>}
      {field.type === "textarea" && (
        <StyledTextarea value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
      )}
      {field.type === "radio" && field.options && (
        <RadioGroup options={field.options} value={value} onChange={onChange} />
      )}
      {(field.type === "text" || field.type === "email" || field.type === "tel") && (
        <StyledInput
          type={field.type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findField(form: RoleForm, id: string): FormField | undefined {
  for (const section of form.sections) {
    const f = section.fields?.find(fld => fld.id === id)
    if (f) return f
  }
  return undefined
}

function anyGateTriggered(form: RoleForm, values: Record<string, string>): boolean {
  for (const section of form.sections) {
    if (!section.fields) continue
    for (const field of section.fields) {
      if (field.gate && values[field.id] === field.gate.value) return true
    }
  }
  return false
}
