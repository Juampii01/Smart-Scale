"use client"

import { useEffect, useMemo, useState } from "react"
import { Save, MessageCircle, MessageCircleReply, Star, FileText, ArrowDownToLine, Phone, Loader2, AlertCircle, Check, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase"

type Log = {
  id: string
  setter_id: string
  date: string
  new_conversations: number
  conversations_replied: number
  qualified_leads: number
  offer_docs_sent: number
  offer_doc_responses: number
  calls_done: number
  notes: string | null
  created_at: string
  updated_at: string
}

const FIELDS = [
  { key: "new_conversations",     label: "Conversaciones nuevas",     icon: MessageCircle,        hint: "Cuántas convos abriste hoy" },
  { key: "conversations_replied", label: "Respuestas a las convos",   icon: MessageCircleReply,   hint: "Cuántas personas respondieron" },
  { key: "qualified_leads",       label: "Leads 4-5 estrellas",       icon: Star,                 hint: "Calificados como prospects" },
  { key: "offer_docs_sent",       label: "Offer docs enviadas",       icon: FileText,             hint: "Documentos enviados a leads" },
  { key: "offer_doc_responses",   label: "Respuestas a offer doc",    icon: ArrowDownToLine,      hint: "Cuántas respondieron al doc" },
  { key: "calls_done",            label: "Llamadas hechas",           icon: Phone,                hint: "Llamadas si tenían dudas" },
] as const

type FieldKey = (typeof FIELDS)[number]["key"]

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function pct(num: number, den: number): string {
  if (!den) return "—"
  return `${Math.round((num / den) * 100)}%`
}

export function AdminSettingView() {
  const [date, setDate]     = useState<string>(todayISO())
  const [values, setValues] = useState<Record<FieldKey, number>>({
    new_conversations: 0, conversations_replied: 0, qualified_leads: 0,
    offer_docs_sent: 0, offer_doc_responses: 0, calls_done: 0,
  })
  const [notes, setNotes]   = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [logs, setLogs]     = useState<Log[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  async function loadLogs() {
    setLoadingLogs(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoadingLogs(false); return }

      const res = await fetch("/api/admin/setting/log", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (res.ok) setLogs(json.logs ?? [])
    } catch (e) {
      // silent
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => { loadLogs() }, [])

  // Cuando cambia la fecha, si ya hay log de ese día lo precarga en el form
  useEffect(() => {
    const existing = logs.find(l => l.date === date)
    if (existing) {
      setValues({
        new_conversations: existing.new_conversations,
        conversations_replied: existing.conversations_replied,
        qualified_leads: existing.qualified_leads,
        offer_docs_sent: existing.offer_docs_sent,
        offer_doc_responses: existing.offer_doc_responses,
        calls_done: existing.calls_done,
      })
      setNotes(existing.notes ?? "")
    } else {
      setValues({
        new_conversations: 0, conversations_replied: 0, qualified_leads: 0,
        offer_docs_sent: 0, offer_doc_responses: 0, calls_done: 0,
      })
      setNotes("")
    }
  }, [date, logs])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSaving(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("No hay sesión activa"); setSaving(false); return }

      const res = await fetch("/api/admin/setting/log", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ date, ...values, notes: notes || null }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json?.error ?? "Error al guardar"); setSaving(false); return }
      setSavedAt(Date.now())
      await loadLogs()
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado")
    } finally {
      setSaving(false)
    }
  }

  // Métricas calculadas sobre los últimos 30 logs
  const metrics = useMemo(() => {
    const recent = logs.slice(0, 30)
    const sum = (k: FieldKey) => recent.reduce((acc, l) => acc + (l[k] ?? 0), 0)
    const totalConvos     = sum("new_conversations")
    const totalReplies    = sum("conversations_replied")
    const totalQualified  = sum("qualified_leads")
    const totalOffers     = sum("offer_docs_sent")
    const totalOfferReps  = sum("offer_doc_responses")
    const totalCalls      = sum("calls_done")

    return [
      { label: "Response rate",      value: pct(totalReplies, totalConvos),      hint: "respuestas / convos" },
      { label: "Qualification rate", value: pct(totalQualified, totalReplies),   hint: "4-5⭐ / respuestas" },
      { label: "Offer doc rate",     value: pct(totalOffers, totalQualified),    hint: "docs / calificados" },
      { label: "Doc response rate",  value: pct(totalOfferReps, totalOffers),    hint: "respondieron al doc" },
      { label: "Call rate",          value: pct(totalCalls, totalOfferReps),     hint: "llamadas / respuestas" },
    ]
  }, [logs])

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">Setting CRM</h1>
        </div>
        <p className="text-xs text-foreground/30 ml-[18px]">
          Carga diaria del setter — conversaciones, calificación, offer docs y llamadas.
        </p>
      </div>

      {/* Form de carga */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-card p-5 space-y-5"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-bold uppercase tracking-widest text-foreground/55">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={e => setDate(e.target.value)}
              className="h-9 rounded-lg border border-border bg-foreground/[0.03] px-3 text-sm text-foreground outline-none focus:border-[#ffde21]/50"
            />
            {logs.find(l => l.date === date) && (
              <span className="text-[11px] text-foreground/55">
                · Editando registro existente
              </span>
            )}
          </div>

          {savedAt && (Date.now() - savedAt) < 3000 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500">
              <Check className="h-3.5 w-3.5" /> Guardado
            </span>
          )}
        </div>

        {/* Grid de inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FIELDS.map(({ key, label, icon: Icon, hint }) => (
            <div key={key} className="rounded-xl border border-border bg-foreground/[0.02] px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-3.5 w-3.5 text-[#ffde21]" />
                <label className="text-[11px] font-bold uppercase tracking-wider text-foreground/65">
                  {label}
                </label>
              </div>
              <input
                type="number"
                min={0}
                step={1}
                value={values[key] || ""}
                onChange={e => setValues(v => ({ ...v, [key]: Number(e.target.value) || 0 }))}
                placeholder="0"
                className="w-full h-10 rounded-lg border border-transparent bg-transparent px-2 text-2xl font-bold text-foreground tabular-nums outline-none focus:border-[#ffde21]/50 focus:bg-foreground/[0.03]"
              />
              <p className="mt-0.5 text-[10px] text-foreground/40">{hint}</p>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-foreground/55 mb-1.5">
            Notas <span className="text-foreground/30 normal-case">(opcional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Algo relevante de hoy: nichos, copies, observaciones…"
            className="w-full rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-[#ffde21]/50"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-2.5 text-xs text-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#ffe84d] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Guardando…" : "Guardar día"}
          </button>
        </div>
      </form>

      {/* Métricas calculadas */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-[#ffde21]" />
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground/55">
            Funnel últimos 30 días
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {metrics.map(m => (
            <div key={m.label} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-foreground/45">{m.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{m.value}</p>
              <p className="mt-0.5 text-[10px] text-foreground/35">{m.hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Histórico */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground/55">
            Histórico
          </h2>
          <span className="text-[10px] text-foreground/40">{logs.length} días registrados</span>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {loadingLogs ? (
            <div className="px-6 py-12 flex items-center justify-center text-sm text-foreground/40">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
            </div>
          ) : logs.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-foreground/40">
              Aún no cargaste ningún día. Empezá completando el form de arriba.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-foreground/[0.02]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/55">Fecha</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/55">Convos</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/55">Respuestas</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/55">4-5⭐</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/55">Docs</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/55">Resp. doc</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-foreground/55">Calls</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr
                      key={log.id}
                      onClick={() => setDate(log.date)}
                      className="border-b border-border last:border-0 hover:bg-foreground/[0.03] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 text-foreground font-medium">{log.date}</td>
                      <td className="px-3 py-2.5 text-right text-foreground tabular-nums">{log.new_conversations}</td>
                      <td className="px-3 py-2.5 text-right text-foreground tabular-nums">{log.conversations_replied}</td>
                      <td className="px-3 py-2.5 text-right text-foreground tabular-nums">{log.qualified_leads}</td>
                      <td className="px-3 py-2.5 text-right text-foreground tabular-nums">{log.offer_docs_sent}</td>
                      <td className="px-3 py-2.5 text-right text-foreground tabular-nums">{log.offer_doc_responses}</td>
                      <td className="px-3 py-2.5 text-right text-foreground tabular-nums">{log.calls_done}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="mt-2 text-[10px] text-foreground/35">
          Click en un día del histórico para editarlo
        </p>
      </div>
    </div>
  )
}
