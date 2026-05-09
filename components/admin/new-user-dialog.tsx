"use client"

import { useState, useEffect } from "react"
import { X, UserPlus, Copy, Check, AlertCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { ROLE_OPTIONS } from "@/lib/auth/permissions"

interface NewUserDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (user: { id: string; email: string; role: string }) => void
}

interface ClientOption { id: string; name: string }

export function NewUserDialog({ open, onClose, onCreated }: NewUserDialogProps) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<string>("setter")
  const [password, setPassword] = useState("")
  const [autoPassword, setAutoPassword] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ email: string; tempPassword: string | null } | null>(null)
  const [copied, setCopied] = useState(false)

  // Solo se cargan cuando role='client' — selector de cliente para asociar
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientId, setClientId] = useState<string>("")
  const [loadingClients, setLoadingClients] = useState(false)

  useEffect(() => {
    if (!open || role !== "client" || clients.length > 0) return
    const load = async () => {
      setLoadingClients(true)
      try {
        const supabase = createClient()
        // Query directa a la tabla `clients` (la del portal — distinta de `crm_clients`).
        // El FK de profiles.client_id apunta acá, así que el dropdown tiene que
        // mostrar IDs de esta tabla, no de crm_clients.
        const { data, error } = await supabase
          .from("clients")
          .select("id, nombre")
          .order("nombre", { ascending: true })
        if (error) {
          console.error("Failed to load clients", error)
          return
        }
        const list: ClientOption[] = (data ?? []).map((c: any) => ({
          id:   c.id,
          name: c.nombre ?? "(sin nombre)",
        }))
        setClients(list)
      } finally { setLoadingClients(false) }
    }
    load()
  }, [open, role, clients.length])

  if (!open) return null

  function reset() {
    setEmail(""); setName(""); setRole("setter")
    setPassword(""); setAutoPassword(true)
    setClientId("")
    setError(null); setResult(null); setCopied(false)
  }

  function handleClose() {
    if (!loading) { reset(); onClose() }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError("No hay sesión activa"); setLoading(false); return }

      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || null,
          role,
          password: autoPassword ? null : password,
          ...(role === "client" && clientId ? { client_id: clientId } : {}),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json?.error ?? "Error al crear usuario")
        setLoading(false)
        return
      }

      setResult({ email: json.user.email, tempPassword: json.tempPassword })
      onCreated?.(json.user)
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado")
    } finally {
      setLoading(false)
    }
  }

  function copyCredentials() {
    if (!result) return
    const text = `Email: ${result.email}\nContraseña: ${result.tempPassword ?? "(la que el admin definió)"}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ffde21]/40 bg-[#ffde21]/10">
              <UserPlus className="h-4 w-4 text-[#ffde21]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">Nuevo usuario</h2>
              <p className="mt-0.5 text-xs text-foreground/55">
                Crear cuenta — admin / team / setter / cliente
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg p-1 text-foreground/50 hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {result ? (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3">
              <p className="text-sm font-semibold text-foreground">✓ Usuario creado</p>
              <p className="mt-1 text-xs text-foreground/60">
                Compartile estas credenciales al usuario. La contraseña no se va a poder recuperar después.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-foreground/[0.03] p-4 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-foreground/55">Email:</span>
                <span className="text-foreground">{result.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/55">Contraseña:</span>
                <span className="text-foreground">
                  {result.tempPassword ?? "(la que definiste)"}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyCredentials}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-foreground/[0.04] px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-foreground/[0.08] transition-colors"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar credenciales"}
              </button>
              <button
                onClick={handleClose}
                className="flex-1 rounded-xl bg-[#ffde21] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#ffe84d] transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-xs text-foreground">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-foreground/55">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@email.com"
                className="h-11 w-full rounded-xl border border-border bg-foreground/[0.03] px-3 text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-[#ffde21]/50 focus:ring-2 focus:ring-[#ffde21]/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-foreground/55">
                Nombre <span className="text-foreground/30 normal-case">(opcional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del usuario"
                className="h-11 w-full rounded-xl border border-border bg-foreground/[0.03] px-3 text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-[#ffde21]/50 focus:ring-2 focus:ring-[#ffde21]/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-foreground/55">
                Tipo de usuario
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      role === opt.value
                        ? "border-[#ffde21] bg-[#ffde21]/[0.08] text-foreground"
                        : "border-border bg-foreground/[0.02] text-foreground/70 hover:border-foreground/20 hover:text-foreground"
                    }`}
                  >
                    <span className="block text-sm font-bold">{opt.label}</span>
                    <span className="block mt-0.5 text-[10px] leading-tight text-foreground/55">
                      {opt.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de cliente — solo cuando role='client' */}
            {role === "client" && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-foreground/55">
                  Cliente asociado <span className="text-foreground/30 normal-case">(opcional)</span>
                </label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  disabled={loadingClients}
                  className="h-11 w-full rounded-xl border border-border bg-foreground/[0.03] px-3 text-sm text-foreground outline-none focus:border-[#ffde21]/50 focus:ring-2 focus:ring-[#ffde21]/10 disabled:opacity-50"
                >
                  <option value="">— Sin cliente asociado —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-foreground/50 leading-relaxed flex items-start gap-1.5">
                  {loadingClients
                    ? <><Loader2 className="h-3 w-3 animate-spin shrink-0 mt-0.5" /> Cargando clientes…</>
                    : "El usuario va a poder ver el portal del cliente que selecciones. Si lo dejás vacío, lo asociás después desde Clientes."}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-foreground/55">
                <input
                  type="checkbox"
                  checked={autoPassword}
                  onChange={(e) => setAutoPassword(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#ffde21]"
                />
                Generar contraseña temporal automática
              </label>
              {!autoPassword && (
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña (mín 8 caracteres)"
                  minLength={8}
                  required
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-foreground/[0.03] px-3 text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-[#ffde21]/50 focus:ring-2 focus:ring-[#ffde21]/10"
                />
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 rounded-xl border border-border bg-foreground/[0.04] px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-foreground/[0.08] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !email || !role}
                className="flex-1 rounded-xl bg-[#ffde21] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#ffe84d] disabled:opacity-50 transition-colors"
              >
                {loading ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}
