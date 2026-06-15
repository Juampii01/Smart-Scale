"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { useMonthlyReports } from "@/hooks/use-monthly-reports"
import { cn } from "@/lib/utils"
import { User, Camera, Loader2, Check, Lock, Mail, Plus, X, Trash2 } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Ctx = Record<string, string>

const TABS = [
  { id: "location", label: "Location & Account" },
  { id: "about",    label: "About you"           },
  { id: "business", label: "About your business" },
  { id: "numbers",  label: "The numbers"         },
  { id: "customer", label: "Your customer"       },
  { id: "content",  label: "Content & audience"  },
  { id: "origin",   label: "How you got here"    },
] as const
type TabId = typeof TABS[number]["id"]

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
            <input
              className={cn(inputCls, "flex-1")}
              value={v}
              onChange={e => upd(i, e.target.value)}
              placeholder={placeholder}
            />
            <button onClick={() => del(i)} className="h-9 w-9 flex items-center justify-center rounded-[8px] border border-foreground/[0.08] text-foreground/40 hover:text-danger hover:border-danger/30 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={add}
          className="flex items-center gap-2 rounded-[8px] border border-foreground/[0.10] px-3 py-2 text-[12px] font-semibold text-foreground/60 hover:text-foreground hover:border-foreground/[0.20] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add entry
        </button>
      </div>
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  )
}

// ─── Tab contents ─────────────────────────────────────────────────────────────

interface AccountApi {
  avatarUrl: string | null
  photoBusy: boolean
  photoMsg: string | null
  onPickPhoto: (f: File) => void
  onRemovePhoto: () => void
  pw: { cur: string; n1: string; n2: string }
  setPw: (v: { cur: string; n1: string; n2: string }) => void
  pwState: "idle" | "saving" | "ok" | "error"
  pwMsg: string | null
  onSavePassword: () => void
}

function LocationTab({
  name, email, account,
  onSaveName, onSaveEmail,
  setName, nameState,
  setEmail, emailState,
  ctx, set,
}: {
  name: string; email: string; account: AccountApi
  onSaveName: () => void; onSaveEmail: () => void
  setName: (v: string) => void; nameState: "idle" | "saving" | "ok" | "error"
  setEmail: (v: string) => void; emailState: "idle" | "saving" | "ok" | "error"
  ctx: Ctx; set: (k: string, v: string) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  return (
    <div className="space-y-8">
      <p className={hintCls}>Identity info — kept on your profile.</p>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ffde21]/40 bg-[#ffde21]/10"
        >
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
        {/* Name */}
        <Field label="Name">
          <div className="flex gap-2">
            <input className={cn(inputCls, "flex-1")} value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
            <button
              onClick={onSaveName}
              disabled={nameState === "saving"}
              className="px-3 py-2 rounded-[8px] bg-[#ffde21] text-black text-[13px] font-semibold hover:bg-[#ffe84d] disabled:opacity-50 transition-colors"
            >
              {nameState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : nameState === "ok" ? <Check className="h-3.5 w-3.5" /> : "Save"}
            </button>
          </div>
        </Field>

        {/* Email */}
        <Field label="Email">
          <div className="flex gap-2">
            <input className={cn(inputCls, "flex-1")} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <button
              onClick={onSaveEmail}
              disabled={emailState === "saving"}
              className="px-3 py-2 rounded-[8px] bg-foreground/[0.06] border border-foreground/[0.10] text-foreground text-[13px] font-semibold hover:bg-foreground/[0.10] disabled:opacity-50 transition-colors"
            >
              {emailState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : emailState === "ok" ? <Check className="h-3.5 w-3.5" /> : "Save"}
            </button>
          </div>
        </Field>

        <Field label="Phone Number">
          <input className={inputCls} value={ctx.phone ?? ""} onChange={e => set("phone", e.target.value)} placeholder="(+54) 11 1234 5678" />
        </Field>

        <Field label="Birthday">
          <input className={inputCls} type="date" value={ctx.birthday ?? ""} onChange={e => set("birthday", e.target.value)} />
        </Field>

        <Field label="Country">
          <input className={inputCls} value={ctx.country ?? ""} onChange={e => set("country", e.target.value)} placeholder="Argentina" />
        </Field>

        <Field label="City">
          <input className={inputCls} value={ctx.city ?? ""} onChange={e => set("city", e.target.value)} placeholder="Buenos Aires" />
        </Field>

        <Field label="Address Line 1">
          <input className={inputCls} value={ctx.address1 ?? ""} onChange={e => set("address1", e.target.value)} />
        </Field>

        <Field label="Address Line 2">
          <input className={inputCls} value={ctx.address2 ?? ""} onChange={e => set("address2", e.target.value)} />
        </Field>

        <Field label="ZIP / Postal Code">
          <input className={inputCls} value={ctx.zip ?? ""} onChange={e => set("zip", e.target.value)} />
        </Field>
      </div>

      {/* Password */}
      <div className="pt-6 border-t border-foreground/[0.07]">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-4 w-4 text-foreground/40" />
          <h3 className="text-[13px] font-bold text-foreground">Contraseña</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
          <input className={inputCls} type="password" autoComplete="current-password" placeholder="Actual"
            value={account.pw.cur} onChange={e => account.setPw({ ...account.pw, cur: e.target.value })} />
          <input className={inputCls} type="password" autoComplete="new-password" placeholder="Nueva (min 6)"
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

function AboutYouTab({ ctx, set, getArr, setArr }: { ctx: Ctx; set: (k: string, v: string) => void; getArr: (k: string) => string[]; setArr: (k: string, v: string[]) => void }) {
  return (
    <div className="space-y-8">
      <p className={hintCls}>Your story, your energy, how you actually work.</p>

      <Field label="Tell us how you actually ended up doing this"
        hint="Voice note or text. Real story, the version you'd tell over a pint. Where you started, what made you switch lanes, how you landed on this business.">
        <textarea className={areaCls} rows={4} value={ctx.story ?? ""} onChange={e => set("story", e.target.value)} placeholder="Escribí tu historia…" />
      </Field>

      <Field label="What were you doing before this business?"
        hint="Career, role, industry. Even if it was three things stacked. Useful context on the raw materials we're working with.">
        <textarea className={areaCls} rows={3} value={ctx.before ?? ""} onChange={e => set("before", e.target.value)} />
      </Field>

      <Field label="Tell us about your family setup"
        hint="Partner? Kids? Where do they fit into your week? Your time and energy economics matter to us.">
        <textarea className={areaCls} rows={3} value={ctx.family ?? ""} onChange={e => set("family", e.target.value)} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-6">
        <Field label="Where in the world are you based?" hint="Time zone matters — calls, check-ins, and meetings all key off this.">
          <input className={inputCls} value={ctx.location ?? ""} onChange={e => set("location", e.target.value)} placeholder="Ciudad, país" />
        </Field>
        <Field label="What time do you usually wake up?" hint="Real number, be honest.">
          <input className={inputCls} type="time" value={ctx.wakeTime ?? ""} onChange={e => set("wakeTime", e.target.value)} />
        </Field>
        <Field label="What time do you usually go to bed?" hint="Same — honest number.">
          <input className={inputCls} type="time" value={ctx.sleepTime ?? ""} onChange={e => set("sleepTime", e.target.value)} />
        </Field>
        <Field label="When in the day are you genuinely at your sharpest?" hint="Be specific. 'Morning' doesn't tell us anything.">
          <input className={inputCls} value={ctx.sharpest ?? ""} onChange={e => set("sharpest", e.target.value)} placeholder="e.g. 6–8am, 10am–noon" />
        </Field>
      </div>

      <Field label="What do you do when you're not working?"
        hint="Hobbies, sports, weird obsessions, whatever fills your weekends.">
        <input className={inputCls} value={ctx.hobbies ?? ""} onChange={e => set("hobbies", e.target.value)} />
      </Field>

      <Field label="Introvert (1) to Extrovert (10) — where do you sit?" hint="How do you actually recharge? Solo time or with people?">
        <div className="flex items-center gap-4">
          <input type="range" min={1} max={10} value={ctx.introvert ?? "5"} onChange={e => set("introvert", e.target.value)} className="flex-1" />
          <span className="text-[18px] font-bold tabular-nums text-foreground w-10 text-center">{ctx.introvert ?? "5"}/10</span>
        </div>
      </Field>

      <Field label="What part of your work absolutely drains you?"
        hint="Be specific. Sales calls? Slack? Admin? Client onboarding?">
        <textarea className={areaCls} rows={3} value={ctx.drains ?? ""} onChange={e => set("drains", e.target.value)} />
      </Field>

      <Field label="What part of your work genuinely lights you up?"
        hint="Writing? Filming? Strategy? Client breakthroughs? Speaking?">
        <textarea className={areaCls} rows={3} value={ctx.lights ?? ""} onChange={e => set("lights", e.target.value)} />
      </Field>
    </div>
  )
}

function AboutBusinessTab({ ctx, set, getArr, setArr }: { ctx: Ctx; set: (k: string, v: string) => void; getArr: (k: string) => string[]; setArr: (k: string, v: string[]) => void }) {
  return (
    <div className="space-y-8">
      <p className={hintCls}>Fuller the picture you give us, the more we can spot leaks and opportunities.</p>

      <Field label="Walk us through your current offer in detail"
        hint="Name of the offer, what it delivers, format (1-on-1, group, hybrid), length of engagement, what's included.">
        <textarea className={areaCls} rows={5} value={ctx.offer ?? ""} onChange={e => set("offer", e.target.value)} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-6">
        <Field label="What does your offer cost?" hint="Total price (USD). If you have tiers, use the headline price.">
          <input className={inputCls} value={ctx.price ?? ""} onChange={e => set("price", e.target.value)} placeholder="$ USD" />
        </Field>
        <Field label="Payment options & tiers" hint="Plans, instalments, tiered pricing.">
          <textarea className={areaCls} rows={3} value={ctx.paymentOptions ?? ""} onChange={e => set("paymentOptions", e.target.value)} />
        </Field>
      </div>

      <MultiEntry label="Pricing history" hint="Every price change since you launched. 'Around summer 2024' is fine for a date."
        values={getArr("pricingHistory")} onChange={v => setArr("pricingHistory", v)} placeholder="Ej: $2,000 — Jul 2024" />

      <MultiEntry label="Walk us through your team" hint="Add an entry per person. Leave blank if it's just you."
        values={getArr("team")} onChange={v => setArr("team", v)} placeholder="Nombre — Rol" />

      <MultiEntry label="What tools are running your business right now?"
        hint="Email platform, payment, community, scheduler, CRM, project management — anything you pay for monthly."
        values={getArr("tools")} onChange={v => setArr("tools", v)} placeholder="Herramienta — para qué la usás" />

      <Field label="Your current offer doc, sales page, or pitch deck"
        hint="Paste the content or a link to the PDF / Google Doc / Notion page. Whatever a prospect sees before they buy.">
        <textarea className={areaCls} rows={4} value={ctx.offerDoc ?? ""} onChange={e => set("offerDoc", e.target.value)} placeholder="https:// o pegá el contenido acá…" />
      </Field>
    </div>
  )
}

function TheNumbersTab({ ctx, set, reports }: { ctx: Ctx; set: (k: string, v: string) => void; reports: ReturnType<typeof useMonthlyReports>["reports"] }) {
  const months = reports.slice(-12)
  const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
  const fmtMonthLabel = (m: string) => {
    const [y, mo] = m.split("-")
    return `${monthNames[parseInt(mo, 10) - 1]} ${y}`
  }

  return (
    <div className="space-y-8">
      <p className={hintCls}>Real numbers, no rounding up. Pre-llenado desde tus reportes mensuales.</p>

      {/* 12-month revenue grid */}
      <div>
        <label className={labelCls}>Last 12 months revenue, month by month (USD)</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
          {months.length > 0 ? months.map(r => (
            <div key={r.month} className="rounded-[8px] border border-foreground/[0.08] bg-foreground/[0.02] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1.5">{fmtMonthLabel(r.month)}</p>
              <div className="flex items-center gap-1">
                <span className="text-foreground/40 text-[13px]">$</span>
                <input
                  className="flex-1 bg-transparent text-[15px] font-bold tabular-nums text-foreground outline-none border-0 border-b border-foreground/[0.10] pb-0.5 focus:border-[#ffde21]/60 transition-colors"
                  defaultValue={Math.round(r.total_revenue) || ""}
                  placeholder="0"
                  type="number"
                  onChange={e => set(`rev_${r.month}`, e.target.value)}
                />
              </div>
            </div>
          )) : (
            Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="rounded-[8px] border border-foreground/[0.08] bg-foreground/[0.02] p-3">
                <div className="flex items-center gap-1">
                  <span className="text-foreground/40 text-[13px]">$</span>
                  <input className="flex-1 bg-transparent text-[15px] font-bold tabular-nums text-foreground outline-none border-0 border-b border-foreground/[0.10] pb-0.5" placeholder="0" type="number" />
                </div>
              </div>
            ))
          )}
        </div>
        <p className={hintCls}>Los valores vienen de tus reportes mensuales y son editables.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <Field label="Of last month's revenue, what % was recurring?"
          hint="Recurring = subscription, retainer, instalments. One-time = paid in full. Rough split is fine.">
          <input className={inputCls} value={ctx.recurringPct ?? ""} onChange={e => set("recurringPct", e.target.value)} placeholder="e.g. 60%" />
        </Field>
        <Field label="Cash actually collected last month (USD)"
          hint="What actually hit your bank account. If you do payment plans, this can be very different from what you billed.">
          <input className={inputCls} type="number" value={ctx.cashLastMonth ?? ""} onChange={e => set("cashLastMonth", e.target.value)} placeholder="$" />
        </Field>
        <Field label="Roughly, what's your profit margin (%)?"
          hint="Revenue minus all expenses divided by revenue. Best guess fine.">
          <input className={inputCls} value={ctx.margin ?? ""} onChange={e => set("margin", e.target.value)} placeholder="e.g. 40%" />
        </Field>
        <Field label="Average client lifetime value (USD)"
          hint="Average price × average stay. If most stay 6 months at $2k/month, that's $12k LTV.">
          <input className={inputCls} type="number" value={ctx.ltv ?? ""} onChange={e => set("ltv", e.target.value)} placeholder="$" />
        </Field>
        <Field label="Current close rate (%)"
          hint="Of every 10 qualified prospects who enter your sales process, how many actually buy?">
          <input className={inputCls} value={ctx.closeRate ?? ""} onChange={e => set("closeRate", e.target.value)} placeholder="e.g. 30%" />
        </Field>
        <Field label="Active paying clients right now">
          <input className={inputCls} type="number" value={ctx.activeClients ?? ""} onChange={e => set("activeClients", e.target.value)} />
        </Field>
        <Field label="Clients who left in the last 90 days"
          hint="Stopped paying or finished and didn't renew.">
          <input className={inputCls} type="number" value={ctx.churnClients ?? ""} onChange={e => set("churnClients", e.target.value)} />
        </Field>
      </div>
    </div>
  )
}

function YourCustomerTab({ ctx, set, getArr, setArr }: { ctx: Ctx; set: (k: string, v: string) => void; getArr: (k: string) => string[]; setArr: (k: string, v: string[]) => void }) {
  return (
    <div className="space-y-8">
      <Field label="Who is your Perfect Future Client?"
        hint="Niche, revenue range, situation, what they're trying to do. Pretend you're describing them to a content editor who needs to write to them tomorrow.">
        <textarea className={areaCls} rows={4} value={ctx.perfectClient ?? ""} onChange={e => set("perfectClient", e.target.value)} />
      </Field>
      <Field label="Tell us about your best client"
        hint="Their story. Where they started, what you built together, where they got to. Numbers if you have them.">
        <textarea className={areaCls} rows={4} value={ctx.bestClient ?? ""} onChange={e => set("bestClient", e.target.value)} />
      </Field>
      <Field label="Tell us about a client who didn't work out"
        hint="No names needed. What went wrong? Tells us where your filter's got holes.">
        <textarea className={areaCls} rows={3} value={ctx.badClient ?? ""} onChange={e => set("badClient", e.target.value)} />
      </Field>
      <MultiEntry label="Where are your clients actually coming from right now?"
        hint="Add an entry per channel. Rough percentages — they don't need to add to exactly 100."
        values={getArr("acquisitionChannels")} onChange={v => setArr("acquisitionChannels", v)}
        placeholder="Ej: Instagram orgánico — 50%" />
      <MultiEntry label="Case study videos"
        hint="Drop a link for each case study video you've recorded. Loom, YouTube, Drive — anywhere we can watch it."
        values={getArr("caseStudies")} onChange={v => setArr("caseStudies", v)} placeholder="https://..." />
    </div>
  )
}

function ContentAudienceTab({ ctx, set, getArr, setArr }: { ctx: Ctx; set: (k: string, v: string) => void; getArr: (k: string) => string[]; setArr: (k: string, v: string[]) => void }) {
  return (
    <div className="space-y-8">
      <MultiEntry label="Every platform you're active on right now"
        hint="Add an entry per platform you actually post on."
        values={getArr("platforms")} onChange={v => setArr("platforms", v)} placeholder="Instagram — 3x / semana" />
      <div className="grid sm:grid-cols-2 gap-6">
        <Field label="Email list size">
          <input className={inputCls} type="number" value={ctx.emailListSize ?? ""} onChange={e => set("emailListSize", e.target.value)} />
        </Field>
        <Field label="Average open rate, last 30 days (%)">
          <input className={inputCls} value={ctx.emailOpenRate ?? ""} onChange={e => set("emailOpenRate", e.target.value)} placeholder="e.g. 35%" />
        </Field>
        <Field label="How often do you broadcast?">
          <input className={inputCls} value={ctx.broadcastFreq ?? ""} onChange={e => set("broadcastFreq", e.target.value)} placeholder="e.g. weekly, every Tuesday" />
        </Field>
      </div>
      {[1,2,3,4,5].map(i => (
        <Field key={i} label={`Recent broadcast email #${i}`}>
          <textarea className={areaCls} rows={2} value={ctx[`email${i}` as keyof Ctx] ?? ""} onChange={e => set(`email${i}`, e.target.value)} placeholder="Paste the email content or a link…" />
        </Field>
      ))}
      {[1,2,3].map(i => (
        <Field key={i} label={`Most recent long-form piece #${i}`}>
          <input className={inputCls} value={ctx[`longform${i}` as keyof Ctx] ?? ""} onChange={e => set(`longform${i}`, e.target.value)} placeholder="https://..." />
        </Field>
      ))}
      <Field label="What hooks, topics or angles consistently land with your audience?"
        hint="Be specific. 'Anything about high-ticket sales without calls hits' is useful.">
        <textarea className={areaCls} rows={3} value={ctx.hooksLand ?? ""} onChange={e => set("hooksLand", e.target.value)} />
      </Field>
      <Field label="What's flopped that you thought would land?"
        hint="Useful for us to know what NOT to push you toward.">
        <textarea className={areaCls} rows={3} value={ctx.flopped ?? ""} onChange={e => set("flopped", e.target.value)} />
      </Field>
    </div>
  )
}

function HowYouGotHereTab({ ctx, set }: { ctx: Ctx; set: (k: string, v: string) => void }) {
  const sel = (k: string, v: string, opts: string[]) => (
    <select className={cn(inputCls, "cursor-pointer")} value={ctx[k] ?? ""} onChange={e => set(k, e.target.value)}>
      <option value="">Select…</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  return (
    <div className="space-y-8">
      <p className={hintCls}>Helps us fill the crew with folks like you, and tells us what kind of content you respond to.</p>
      <Field label="How did you first hear about Smart Scale?">
        {sel("howFound", "", ["Instagram", "YouTube", "Referido", "LinkedIn", "Podcast", "Evento", "Otro"])}
      </Field>
      <div className="grid sm:grid-cols-2 gap-6">
        <Field label="Roughly when?">
          <input className={inputCls} value={ctx.whenFound ?? ""} onChange={e => set("whenFound", e.target.value)} placeholder="e.g. 4 months ago" />
        </Field>
        <Field label="First piece of our content you remember consuming?">
          <input className={inputCls} value={ctx.firstContent ?? ""} onChange={e => set("firstContent", e.target.value)} placeholder="Video, post, podcast…" />
        </Field>
      </div>
      <Field label="What piece of content made you go 'this is who I want to work with'?"
        hint="Title, topic, or rough description.">
        <textarea className={areaCls} rows={2} value={ctx.decidingContent ?? ""} onChange={e => set("decidingContent", e.target.value)} />
      </Field>
      <Field label="Which case study or member made you think 'that's me'?">
        <textarea className={areaCls} rows={2} value={ctx.caseStudyResonated ?? ""} onChange={e => set("caseStudyResonated", e.target.value)} />
      </Field>
      <Field label="Did you DM us, email us, or self-checkout?">
        {sel("howJoined", "", ["DM en Instagram", "Email", "Self-checkout", "Llamada", "Otro"])}
      </Field>
      <Field label="Who else did you seriously consider before deciding on Smart Scale?"
        hint="Other mentors, programs, coaches. No judgement — useful to know our actual competition.">
        <textarea className={areaCls} rows={2} value={ctx.competitors ?? ""} onChange={e => set("competitors", e.target.value)} />
      </Field>
      <Field label="Are you in another program right now?"
        hint="Honest answer. Useful context.">
        <textarea className={areaCls} rows={2} value={ctx.otherPrograms ?? ""} onChange={e => set("otherPrograms", e.target.value)} />
      </Field>
      <Field label="How long from first hearing about us to deciding?">
        {sel("timeToDecide", "", ["Mismo día", "Menos de una semana", "1-2 semanas", "Un mes", "Más de un mes"])}
      </Field>
      <Field label="What was the objection that almost stopped you?"
        hint="Price? Timing? Doubt the model would work for your niche?">
        <textarea className={areaCls} rows={3} value={ctx.objection ?? ""} onChange={e => set("objection", e.target.value)} />
      </Field>
      <Field label="What was the specific moment or thing that pushed you over the edge?"
        hint="Most valuable answer in this whole form. Be specific.">
        <textarea className={areaCls} rows={3} value={ctx.tippingPoint ?? ""} onChange={e => set("tippingPoint", e.target.value)} />
      </Field>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ContextRoomView() {
  const [tab, setTab] = useState<TabId>("location")

  // Auth profile
  const supabase = createClient()
  const [userId, setUserId]   = useState<string | null>(null)
  const [name,   setNameVal]  = useState("")
  const [email,  setEmailVal] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [nameState,  setNameState]  = useState<"idle"|"saving"|"ok"|"error">("idle")
  const [emailState, setEmailState] = useState<"idle"|"saving"|"ok"|"error">("idle")
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMsg,  setPhotoMsg]  = useState<string | null>(null)
  const [pw, setPw] = useState({ cur: "", n1: "", n2: "" })
  const [pwState, setPwState] = useState<"idle"|"saving"|"ok"|"error">("idle")
  const [pwMsg,   setPwMsg]   = useState<string | null>(null)

  const getToken = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null, [])

  // Context data (localStorage)
  const [ctx, setCtx]  = useState<Ctx>({})
  const saveTimer      = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [saved, setSaved] = useState(false)

  const { reports } = useMonthlyReports()

  // Load auth + ctx from localStorage
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthLoading(false); return }
      setUserId(user.id)
      setEmailVal(user.email ?? "")

      // Name from profiles
      try {
        const { data: prof } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle()
        setNameVal((prof as any)?.name ?? "")
      } catch {}

      // Avatar
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (token) {
          const res = await fetch("/api/profile/avatar", { headers: { Authorization: `Bearer ${token}` } })
          if (res.ok) { const d = await res.json(); setAvatarUrl(d.url ?? null) }
        }
      } catch {}

      // Load context from localStorage
      try {
        const stored = localStorage.getItem(`ss_ctx_${user.id}`)
        if (stored) setCtx(JSON.parse(stored))
      } catch {}

      setAuthLoading(false)
    }
    init()
  }, [])

  // Auto-save ctx to localStorage (debounced 600ms)
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
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) { setNameState("error"); return }
      const res = await fetch("/api/profile", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) })
      setNameState(res.ok ? "ok" : "error")
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

  const account: AccountApi = {
    avatarUrl, photoBusy, photoMsg, onPickPhoto, onRemovePhoto,
    pw, setPw, pwState, pwMsg, onSavePassword,
  }

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
      {tab === "about"    && <AboutYouTab ctx={ctx} set={set} getArr={getArr} setArr={setArr} />}
      {tab === "business" && <AboutBusinessTab ctx={ctx} set={set} getArr={getArr} setArr={setArr} />}
      {tab === "numbers"  && <TheNumbersTab ctx={ctx} set={set} reports={reports} />}
      {tab === "customer" && <YourCustomerTab ctx={ctx} set={set} getArr={getArr} setArr={setArr} />}
      {tab === "content"  && <ContentAudienceTab ctx={ctx} set={set} getArr={getArr} setArr={setArr} />}
      {tab === "origin"   && <HowYouGotHereTab ctx={ctx} set={set} />}
    </div>
  )
}
