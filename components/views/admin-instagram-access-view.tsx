"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { Loader2, RefreshCw, Instagram, Trash2, AlertCircle } from "lucide-react"

interface IgRequest {
  id: string
  name: string
  instagram: string
  email: string | null
  is_professional: boolean
  status: string
  created_at: string
}

const STATUSES = ["nueva", "invitado", "conectado", "rechazado"] as const

function fmtDate(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${dd}/${mm}/${yy} ${hh}:${mi}`
}

function igHref(v: string) {
  const s = (v ?? "").trim()
  if (/^https?:\/\//i.test(s)) return s
  return `https://instagram.com/${s.replace(/^@+/, "")}`
}

export function AdminInstagramAccessView() {
  const [items, setItems]     = useState<IgRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [migrated, setMigrated] = useState(true)
  const [search, setSearch]   = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const getSession = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSession()
      if (!session) return
      const res = await fetch("/api/admin/instagram-access", {
        headers: { "Authorization": `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      setItems(json.requests ?? [])
      setMigrated(json.migrated !== false)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const updateStatus = async (id: string, status: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    const session = await getSession()
    if (!session) return
    await fetch("/api/admin/instagram-access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, status }),
    })
  }

  const handleDelete = async (item: IgRequest) => {
    if (!window.confirm(`¿Eliminar la solicitud de ${item.name}?`)) return
    setDeletingId(item.id)
    const session = await getSession()
    if (!session) { setDeletingId(null); return }
    await fetch("/api/admin/instagram-access", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: item.id }),
    })
    setItems(prev => prev.filter(i => i.id !== item.id))
    setDeletingId(null)
  }

  const filtered = items.filter(i => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [i.name, i.instagram, i.email, i.status].some(v => v?.toLowerCase().includes(q))
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Instagram · Acceso a métricas</h1>
          <p className="text-sm text-foreground/40 mt-0.5">{items.length} solicitud{items.length !== 1 ? "es" : ""} desde el form público</p>
        </div>
        <button onClick={fetchItems} disabled={loading}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] text-foreground/40 hover:text-foreground hover:border-foreground/20 transition-all disabled:opacity-40">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Link del form */}
      <div className="rounded-[14px] border border-foreground/[0.07] bg-card px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/30 mb-2">Link del formulario (compartilo con los clientes)</p>
        <code className="rounded-lg bg-foreground/[0.04] px-3 py-2 text-[12px] text-foreground/60 font-mono">/conectar-instagram</code>
      </div>

      {!migrated && (
        <div className="flex items-start gap-2.5 rounded-[14px] border border-amber-400 bg-amber-100 px-4 py-3 dark:border-amber-400/20 dark:bg-amber-500/[0.06]">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-[13px] text-amber-900 dark:text-amber-200/80 leading-relaxed">
            La tabla todavía no existe. Aplicá la migración <span className="font-semibold">20260623000001_instagram_access_requests.sql</span> en Supabase para empezar a guardar y ver las solicitudes.
          </p>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por nombre, instagram, email..."
        className="h-9 rounded-xl border border-foreground/[0.08] bg-card px-4 text-sm text-foreground placeholder:text-foreground/25 focus:border-foreground/20 focus:outline-none w-full max-w-sm"
      />

      {/* Table */}
      <div className="overflow-hidden rounded-[14px] border border-foreground/[0.08] bg-card">
        <div className="overflow-x-auto" style={{ backgroundColor: "var(--card)" }}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
                {["Nombre","Instagram","Email","Profesional","Estado","Fecha",""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/40 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="inline h-5 w-5 animate-spin text-foreground/30" /></td></tr>
              ) : !filtered.length ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-foreground/25">
                  {items.length ? "No hay solicitudes con esa búsqueda." : "Todavía no llegó ninguna solicitud."}
                </td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="border-b border-foreground/[0.04] hover:bg-muted transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[14px] font-semibold text-foreground">{item.name}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a href={igHref(item.instagram)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex max-w-[220px] items-center gap-1.5 text-[13px] text-foreground/70 hover:text-foreground transition-colors">
                      <Instagram className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 truncate">{item.instagram}</span>
                    </a>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[13px] text-foreground/70">{item.email || <span className="text-foreground/25">—</span>}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      item.is_professional
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-foreground/[0.05] text-foreground/40"
                    }`}>
                      {item.is_professional ? "Sí" : "No confirmó"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <select
                      value={item.status}
                      onChange={e => updateStatus(item.id, e.target.value)}
                      className="h-8 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-2 text-[12px] font-medium text-foreground capitalize focus:border-foreground/20 focus:outline-none"
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[12px] tabular-nums text-foreground/55">{fmtDate(item.created_at)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => handleDelete(item)} disabled={deletingId === item.id}
                      title="Eliminar"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/25 hover:text-foreground hover:bg-foreground/[0.06] transition-all disabled:opacity-40">
                      {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
