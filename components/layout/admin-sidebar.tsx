"use client"

import { useEffect, useState } from "react"
import {
  X, DollarSign, ClipboardList, Table2, Users2,
  UserCheck, Layers, Briefcase, ArrowLeft, ShieldCheck,
  MessageSquareText, UserPlus,
  LayoutDashboard, CalendarDays, Brain, Terminal, CheckSquare, Bell, Share2, Instagram, Sparkles, Activity, RefreshCw, UserCircle, Wallet,
  Building2, Loader2, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { canAccessAdminPath, isAdmin } from "@/lib/auth/permissions"
import { useEffectiveRole, useViewAsTenant, setViewAsTenant, type ViewAsTenant } from "@/lib/auth/view-as"
import { isOmniOwnerEmail } from "@/lib/omni/owner"
import { isPlatformOwnerEmail } from "@/lib/auth/platform-owner"
import { BrandLogo } from "@/components/theme/brand-logo"

interface AdminSidebarProps {
  open: boolean
  onClose: () => void
}

// El sidebar se organiza en 4 sectores — cada uno con su propio label, para
// que cada rol entienda de un vistazo qué es "lo suyo" (mismo criterio que
// ya filtra canAccessAdminPath por rol, solo se reagrupa visualmente).
const FOUNDER_NAV_ITEMS = [
  { name: "Dashboard",         href: "/admin/executive-dashboard", icon: LayoutDashboard },
  { name: "Adquisition Stats", href: "/admin/data",             icon: Table2 },
  { name: "Pagos",            href: "/admin/payments",          icon: DollarSign },
  { name: "Clientes",         href: "/admin/clients",           icon: UserCheck },
  { name: "Contratación",     href: "/admin/team-applications", icon: Briefcase },
  { name: "Notificaciones",   href: "/admin/notificaciones",    icon: Bell },
  { name: "Actualizar Sistema", href: "/admin/actualizar-sistema", icon: RefreshCw },
  { name: "Check-in Trimestral", href: "/admin/founder-checkins", icon: Wallet },
  { name: "POSI",               href: "/admin/posi",              icon: ClipboardList },
]

const PROSPECCION_NAV_ITEMS = [
  { name: "Leads",       href: "/admin/leads",        icon: Users2 },
  { name: "Setting",     href: "/admin/setting",      icon: MessageSquareText },
  { name: "Onboarding",  href: "/admin/onboarding",   icon: UserPlus },
  { name: "Aplicaciones", href: "/admin/applications", icon: ClipboardList },
]

const OPERACIONES_NAV_ITEMS = [
  { name: "Centro Operativo", href: "/admin/centro-operativo", icon: Layers },
  { name: "Tareas",           href: "/admin/tareas",           icon: CheckSquare },
  { name: "Mi Context Room",  href: "/admin/mi-context-room",  icon: UserCircle },
]

const DESARROLLADOR_NAV_ITEMS = [
  { name: "Cerebro de Ann", href: "/admin/ann-knowledge",       icon: Brain },
  { name: "Agenda",         href: "/admin/agenda",              icon: CalendarDays },
  { name: "Conexiones",     href: "/admin/conexiones",          icon: Share2 },
  { name: "Actividad",      href: "/admin/actividad-clientes",  icon: Activity },
  { name: "Dev Logs",       href: "/admin/dev-logs",            icon: Terminal },
  { name: "Instagram",      href: "/admin/instagram-access",    icon: Instagram },
]

const NAV_SECTIONS = [
  { title: "Founder",       items: FOUNDER_NAV_ITEMS },
  { title: "Prospección",   items: PROSPECCION_NAV_ITEMS },
  { title: "Operaciones",   items: OPERACIONES_NAV_ITEMS },
  { title: "Desarrollador", items: DESARROLLADOR_NAV_ITEMS },
]

// El sector interno de un cliente (no Smart Scale) solo ve el "kit mínimo"
// replicable: Leads, Setting, y Centro Operativo (donde vive el tab de
// Prospección) — nada de Founder/Operaciones/Desarrollador, que son
// exclusivos del negocio de Ann.
const CLIENT_SECTOR_HREFS = new Set(["/admin/leads", "/admin/setting", "/admin/centro-operativo"])

interface TenantEntry { id: string; name: string; is_internal_workspace: boolean }

/** Selector "Ver Clientes" — exclusivo del platform owner. */
function VerClientesPicker({ ownTenant }: { ownTenant: TenantEntry | null }) {
  const viewAsTenant = useViewAsTenant()
  const [openMenu, setOpenMenu] = useState(false)
  const [tenants, setTenants] = useState<TenantEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!openMenu || tenants.length > 0) return
    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch("/api/admin/internal-tenants", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const json = await res.json()
        setTenants(json.tenants ?? [])
      } finally { setLoading(false) }
    }
    load()
  }, [openMenu, tenants.length])

  function pick(t: TenantEntry) {
    setViewAsTenant({ id: t.id, name: t.name, isInternalWorkspace: t.is_internal_workspace })
    setOpenMenu(false)
  }

  const activeLabel = viewAsTenant ? viewAsTenant.name : (ownTenant?.name ?? "Smart Scale")

  return (
    <div className="relative">
      <button
        onClick={() => setOpenMenu(v => !v)}
        title="Ver Clientes — navegar el sector interno de cualquier cliente"
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 transition-all",
          viewAsTenant
            ? "border-amber-400/50 bg-amber-400/[0.12] text-amber-700 dark:text-amber-300"
            : "border-border bg-foreground/[0.02] text-text-2 hover:text-foreground hover:border-border-hover"
        )}
      >
        <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold">
          {viewAsTenant ? activeLabel : "Ver Clientes"}
        </span>
      </button>

      {openMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(false)} />
          <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-text-2" />
              </div>
            ) : (
              <>
                {viewAsTenant && (
                  <button
                    onClick={() => { setViewAsTenant(null); setOpenMenu(false) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold text-foreground hover:bg-foreground/[0.06] hover:text-foreground transition-colors border-b border-border"
                  >
                    <ArrowLeft className="h-3 w-3" /> Volver a mi sector
                  </button>
                )}
                {tenants.map(t => (
                  <button
                    key={t.id}
                    onClick={() => pick(t)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
                  >
                    <span className="truncate">{t.is_internal_workspace ? `${t.name} (interno)` : t.name}</span>
                    {viewAsTenant?.id === t.id && <Check className="h-3 w-3 shrink-0 text-amber-500" />}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const [userRole, setUserRole]  = useState<string | null | undefined>(undefined) // undefined = aún cargando
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [ownTenant, setOwnTenant] = useState<TenantEntry | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { setUserRole(null); return }
      setUserEmail(data.user.email ?? null)
      supabase.from("profiles").select("role, internal_tenant_id").eq("id", data.user.id).maybeSingle()
        .then(({ data: prof }) => {
          setUserRole((prof as any)?.role ?? null)
          const tenantId = (prof as any)?.internal_tenant_id
          if (!tenantId) return
          supabase.from("clients").select("id, name, nombre, is_internal_workspace").eq("id", tenantId).maybeSingle()
            .then(({ data: tenant }) => {
              if (!tenant) return
              setOwnTenant({
                id: (tenant as any).id,
                name: (tenant as any).name || (tenant as any).nombre || "Sin nombre",
                is_internal_workspace: Boolean((tenant as any).is_internal_workspace),
              })
            })
        })
    })
  }, [])

  const isOmniOwner = isOmniOwnerEmail(userEmail)
  const isPlatformOwner = isPlatformOwnerEmail(userEmail)

  // Si admin está en modo "view as setter/team", el sidebar se filtra como ese rol
  const effectiveRole = useEffectiveRole(userRole === undefined ? null : userRole)

  // "Ver Clientes" — solo platform owner. Mientras esté activo, el sector
  // efectivo es el del tenant elegido, no el propio.
  const viewAsTenant = useViewAsTenant()
  const isOwnSectorInternal = viewAsTenant
    ? viewAsTenant.isInternalWorkspace
    : (ownTenant?.is_internal_workspace ?? true) // default true mientras carga, para no ocultar de golpe

  const visibleSections = userRole === undefined
    ? []
    : NAV_SECTIONS
        .map(section => ({ ...section, items: section.items.filter(item => canAccessAdminPath(effectiveRole, item.href)) }))
        .map(section => isOwnSectorInternal ? section : { ...section, items: section.items.filter(item => CLIENT_SECTOR_HREFS.has(item.href)) })
        .filter(section => section.items.length > 0)

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[240px] transition-transform duration-200 ease-in-out lg:translate-x-0",
          "bg-card flex flex-col pt-[env(safe-area-inset-top)] overflow-hidden",
          "border-r border-border",
          "lg:left-4 lg:top-4 lg:bottom-4 lg:h-auto lg:rounded-2xl lg:border lg:border-border lg:shadow-[0_10px_36px_-18px_rgba(0,0,0,0.30)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo + INTERNAL badge (sin línea divisoria) */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <a href="/admin/clients" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <BrandLogo />
            </a>
            <button
              className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-text-2 hover:text-foreground hover:bg-foreground/10 transition-all"
              onClick={onClose}
              aria-label="Cerrar menú"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.15em] text-accent-ink">
            <ShieldCheck className="h-2.5 w-2.5" />
            Internal
          </span>
        </div>

        {/* "Ver Clientes" — exclusivo del platform owner */}
        {isPlatformOwner && (
          <div className="pt-1 px-3">
            <VerClientesPicker ownTenant={ownTenant} />
          </div>
        )}

        {/* Volver al portal (solo admin) */}
        {isAdmin(effectiveRole) && (
          <div className="pt-1 px-3">
            <Link href="/dashboard" onClick={onClose} title="Volver al portal">
              <div className="group flex items-center gap-2 rounded-lg border border-border bg-foreground/[0.02] px-3 py-2 text-[15px] font-semibold text-text-2 hover:text-foreground hover:border-border-hover transition-all">
                <ArrowLeft className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Volver al portal</span>
              </div>
            </Link>
          </div>
        )}

        {/* Ann AI (ex Omni) — sistema de IA (destacado, acceso restringido) */}
        {isOmniOwner && (
          <div className="pt-1 px-3">
            <Link href="/admin/omni" onClick={onClose} title="Ann AI — Sistema IA">
              <div className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all",
                pathname === "/admin/omni"
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-accent/25 bg-accent-soft text-accent-ink/90 hover:bg-accent-soft/70 hover:border-accent/45"
              )}>
                <Sparkles className="h-4 w-4 flex-shrink-0" />
                <div className="min-w-0 leading-none">
                  <p className="text-[15px] font-bold">Ann AI</p>
                  <p className="mt-1 text-[13px] text-text-2">Sistema IA</p>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {visibleSections.map((section, i) => (
            <div key={section.title} className={i > 0 ? "mt-5" : undefined}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.name} href={item.href} onClick={onClose}>
                      <div className={cn(
                        "flex h-[34px] items-center gap-2.5 rounded-lg px-3 transition-all duration-150",
                        isActive
                          ? "bg-secondary text-accent-ink"
                          : "text-foreground hover:bg-foreground/[0.05] hover:text-foreground"
                      )}>
                        <item.icon className="h-[14px] w-[14px] flex-shrink-0" />
                        <span className={cn("text-[15px] leading-none", isActive ? "font-semibold" : "font-medium")}>
                          {item.name}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer — sin línea divisoria */}
        <div className="flex-shrink-0 p-3">
          <div className="flex items-center gap-2.5 rounded-[14px] bg-accent-soft px-3 py-2.5 border border-accent/20">
            <ShieldCheck className="h-3.5 w-3.5 text-accent-ink/80 shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-accent-ink/80 tracking-widest uppercase">Smart Scale Internal</p>
              <p className="text-[13px] text-text-3 mt-0.5">Admin only</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
