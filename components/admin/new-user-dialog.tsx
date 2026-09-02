"use client"

import { useState, useEffect } from "react"
import { X, UserPlus, Copy, Check, AlertCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { ROLE_OPTIONS } from "@/lib/auth/permissions"
import { isPlatformOwnerEmail } from "@/lib/auth/platform-owner"

interface NewUserDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (user: { id: string; email: string; role: string }) => void
  /** Provisionamiento del sector interno de UN cliente puntual (botón "Sector
   * interno" en /admin/clients) — fija el tenant y oculta el selector, en vez
   * de dejar que el platform owner elija de la lista completa. Restringe los
   * roles disponibles a los internos (no tiene sentido crear un 'cliente'
   * portal desde acá). */
  fixedTenant?: { id: string; name: string } | null
}

interface ClientOption { id: string; name: string }

const INTERNAL_ROLES = new Set(["admin", "developer", "team", "setter"])

export function NewUserDialog({ open, onClose, onCreated, fixedTenant }: NewUserDialogProps) {
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

  // Solo relevante para el platform owner creando un rol interno — elige a
  // qué sector interno (Leads/Setting/Prospección) pertenece el usuario
  // nuevo. Cualquier otro admin no ve este selector: hereda su propio
  // sector en silencio (resuelto server-side).
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [internalTenants, setInternalTenants] = useState<ClientOption[]>([])
  const [internalTenantId, setInternalTenantId] = useState<string>("")
  const [loadingTenants, setLoadingTenants] = useState(false)

  const isOwner = isPlatformOwnerEmail(currentUserEmail)
  const showTenantSelector = !fixedTenant && INTERNAL_ROLES.has(role) && isOwner
  const roleOptions = fixedTenant ? ROLE_OPTIONS.filter(o => INTERNAL_ROLES.has(o.value)) : ROLE_OPTIONS

  useEffect(() => {
    if (!open || currentUserEmail) return
    createClient().auth.getUser().then(({ data }) => setCurrentUserEmail(data?.user?.email ?? null))
  }, [open, currentUserEmail])

  // Provisionamiento de sector interno: tenant y rol por defecto ya resueltos,
  // sin esperar a que el usuario elija nada en el selector (que ni se muestra).
  useEffect(() => {
    if (open && fixedTenant) {
      setRole("admin")
      setInternalTenantId(fixedTenant.id)
    }
  }, [open, fixedTenant])

  useEffect(() => {
    if (!open || role !== "client" || clients.length > 0) return
    const load = async () => {
      setLoadingClients(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        // El dropdown lista los clientes del CRM (`crm_clients`) — universo
        // grande de clientes activos. Si el client_id elegido todavía no
        // tiene row en la tabla `clients` (portal), el route /api/admin/users/create
        // copia automáticamente el row antes de hacer el upsert al profile.
        const res = await fetch("/api/admin/clients", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const json = await res.json()
        const list: ClientOption[] = (json.clients ?? []).map((c: any) => ({ id: c.id, name: c.name }))
        list.sort((a, b) => a.name.localeCompare(b.name))
        setClients(list)
      } finally { setLoadingClients(false) }
    }
    load()
  }, [open, role, clients.length])

  useEffect(() => {
    if (!open || !showTenantSelector || internalTenants.length > 0) return
    const load = async () => {
      setLoadingTenants(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch("/api/admin/internal-tenants", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const json = await res.json()
        const list: ClientOption[] = (json.tenants ?? []).map((t: any) => ({
          id: t.id,
          name: t.is_internal_workspace ? `${t.name} (interno)` : (t.name || t.nombre || "Sin nombre"),
        }))
        setInternalTenants(list)
      } finally { setLoadingTenants(false) }
    }
    load()
  }, [open, showTenantSelector, internalTenants.length])

  if (!open) return null

  function reset() {
    setEmail(""); setName(""); setRole("setter")
    setPassword(""); setAutoPassword(true)
    setClientId(""); setInternalTenantId("")
    setError(null); setResult(null); setCopied(false)
  }

  function handleClose() {
    if (!loading) { reset(); onClose() }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setLoading(true)

    if (showTenantSelector && !internalTenantId) {
      setError("Elegí el sector interno para este usuario")
      setLoading(false)
      return
    }

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
          ...(INTERNAL_ROLES.has(role) && internalTenantId ? { internal_tenant_id: internalTenantId } : {}),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        // Caso conocido: este cliente tiene UUIDs distintos entre crm_clients
        // y clients (ver MIGRATION_PENDING.md, 4 clientes afectados) — el id
        // que le pasamos como internal_tenant_id no existe en `clients`.
        const isTenantMismatch = fixedTenant && /internal_tenant_id inválido/i.test(json?.error ?? "")
        setError(
          isTenantMismatch
            ? `${fixedTenant!.name} tiene un UUID distinto entre el CRM y el portal (caso conocido, ver MIGRATION_PENDING.md). No se puede provisionar su sector interno hasta resolver esa migración — avisale a Juampi.`
            : (json?.error ?? "Error al crear usuario")
        )
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
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-border bg-popover text-popover-foreground shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-accent-soft">
              <UserPlus className="h-4 w-4 text-accent-ink" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-foreground">
                {fixedTenant ? "Usuario del sector interno" : "Nuevo usuario"}
              </h2>
              <p className="mt-0.5 text-[13px] text-text-2">
                {fixedTenant ? `Sector interno de ${fixedTenant.name} — Leads / Setting / Prospección` : "Crear cuenta — admin / team / setter / cliente"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg p-1 text-text-2 hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {result ? (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3">
              <p className="text-[13px] font-semibold text-foreground">✓ Usuario creado</p>
              <p className="mt-1 text-[13px] text-text-2">
                Compartile estas credenciales al usuario. La contraseña no se va a poder recuperar después.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-secondary p-4 font-mono text-[13px]">
              <div className="flex justify-between">
                <span className="text-text-2">Email:</span>
                <span className="text-foreground">{result.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-2">Contraseña:</span>
                <span className="text-foreground">
                  {result.tempPassword ?? "(la que definiste)"}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyCredentials}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar credenciales"}
              </button>
              <button
                onClick={handleClose}
                className="flex-1 rounded-xl btn-accent px-4 py-2.5 text-[13px] font-bold transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[13px] text-foreground">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-text-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@email.com"
                className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-[13px] text-foreground outline-none placeholder:text-text-3 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-text-2">
                Nombre <span className="text-text-3 normal-case">(opcional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del usuario"
                className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-[13px] text-foreground outline-none placeholder:text-text-3 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-text-2">
                Tipo de usuario
              </label>
              <div className="grid grid-cols-2 gap-2">
                {roleOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      role === opt.value
                        ? "border-accent bg-secondary text-foreground"
                        : "border-border bg-elevated text-foreground hover:border-border-hover hover:text-foreground"
                    }`}
                  >
                    <span className="block text-[13px] font-bold">{opt.label}</span>
                    <span className="block mt-0.5 text-[13px] leading-tight text-text-2">
                      {opt.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de cliente — solo cuando role='client' */}
            {role === "client" && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-text-2">
                  Cliente asociado <span className="text-text-3 normal-case">(opcional)</span>
                </label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  disabled={loadingClients}
                  className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                >
                  <option value="">— Sin cliente asociado —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[13px] text-text-2 leading-relaxed flex items-start gap-1.5">
                  {loadingClients
                    ? <><Loader2 className="h-3 w-3 animate-spin shrink-0 mt-0.5" /> Cargando clientes…</>
                    : "El usuario va a poder ver el portal del cliente que selecciones. Si lo dejás vacío, lo asociás después desde Clientes."}
                </p>
              </div>
            )}

            {/* Selector de sector interno — solo platform owner + rol interno */}
            {showTenantSelector && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-text-2">
                  Sector interno
                </label>
                <select
                  value={internalTenantId}
                  onChange={e => setInternalTenantId(e.target.value)}
                  disabled={loadingTenants}
                  required
                  className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                >
                  <option value="">— Elegí un sector —</option>
                  {internalTenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[13px] text-text-2 leading-relaxed flex items-start gap-1.5">
                  {loadingTenants
                    ? <><Loader2 className="h-3 w-3 animate-spin shrink-0 mt-0.5" /> Cargando sectores…</>
                    : "El usuario va a ver Leads/Setting/Prospección del sector que elijas — nunca los de otro cliente."}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-text-2">
                <input
                  type="checkbox"
                  checked={autoPassword}
                  onChange={(e) => setAutoPassword(e.target.checked)}
                  className="h-3.5 w-3.5 accent-accent"
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
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-secondary px-3 text-[13px] text-foreground outline-none placeholder:text-text-3 focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 rounded-xl border border-border bg-elevated px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !email || !role || (showTenantSelector && !internalTenantId)}
                className="flex-1 rounded-xl btn-accent px-4 py-2.5 text-[13px] font-bold disabled:opacity-50 transition-colors"
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
