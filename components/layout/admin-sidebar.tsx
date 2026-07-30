"use client"

import { useEffect, useState } from "react"
import {
  X, DollarSign, ClipboardList, Table2, Users2,
  UserCheck, Layers, Briefcase, ArrowLeft, ShieldCheck,
  MessageSquareText, UserPlus,
  LayoutDashboard, CalendarDays, Brain, Terminal, CheckSquare, Bell, Share2, Instagram, Sparkles, Activity, RefreshCw, UserCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { canAccessAdminPath, isAdmin } from "@/lib/auth/permissions"
import { useEffectiveRole } from "@/lib/auth/view-as"
import { isOmniOwnerEmail } from "@/lib/omni/owner"
import { BrandLogo } from "@/components/theme/brand-logo"

interface AdminSidebarProps {
  open: boolean
  onClose: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
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

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const [userRole, setUserRole]  = useState<string | null | undefined>(undefined) // undefined = aún cargando
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { setUserRole(null); return }
      setUserEmail(data.user.email ?? null)
      supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
        .then(({ data: prof }) => setUserRole((prof as any)?.role ?? null))
    })
  }, [])

  const isOmniOwner = isOmniOwnerEmail(userEmail)

  // Si admin está en modo "view as setter/team", el sidebar se filtra como ese rol
  const effectiveRole = useEffectiveRole(userRole === undefined ? null : userRole)

  const visibleSections = userRole === undefined
    ? []
    : NAV_SECTIONS
        .map(section => ({ ...section, items: section.items.filter(item => canAccessAdminPath(effectiveRole, item.href)) }))
        .filter(section => section.items.length > 0)

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[220px] transition-transform duration-200 ease-in-out lg:translate-x-0",
          "bg-card flex flex-col pt-[env(safe-area-inset-top)] overflow-hidden",
          "border-r border-foreground/[0.07]",
          "lg:left-4 lg:top-4 lg:bottom-4 lg:h-auto lg:rounded-2xl lg:border lg:border-foreground/[0.08] lg:shadow-[0_10px_36px_-18px_rgba(0,0,0,0.30)]",
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
              className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-all"
              onClick={onClose}
              aria-label="Cerrar menú"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#dafc69]/30 bg-[#dafc69]/[0.08] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#dafc69]">
            <ShieldCheck className="h-2.5 w-2.5" />
            Internal
          </span>
        </div>

        {/* Volver al portal (solo admin) */}
        {isAdmin(effectiveRole) && (
          <div className="px-3 pt-1">
            <Link href="/dashboard" onClick={onClose}>
              <div className="group flex items-center gap-2 rounded-lg border border-foreground/[0.07] bg-foreground/[0.02] px-3 py-2 text-[12px] font-semibold text-foreground/55 hover:text-foreground hover:border-foreground/[0.15] transition-all">
                <ArrowLeft className="h-3.5 w-3.5 flex-shrink-0" />
                Volver al portal
              </div>
            </Link>
          </div>
        )}

        {/* Ann AI (ex Omni) — sistema de IA (destacado, acceso restringido) */}
        {isOmniOwner && (
          <div className="px-3 pt-1">
            <Link href="/admin/omni" onClick={onClose}>
              <div className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all",
                pathname === "/admin/omni"
                  ? "border-[#dafc69]/45 bg-[#dafc69]/[0.14] text-[#dafc69]"
                  : "border-[#dafc69]/20 bg-[#dafc69]/[0.06] text-[#dafc69]/90 hover:bg-[#dafc69]/[0.12] hover:border-[#dafc69]/40"
              )}>
                <Sparkles className="h-4 w-4 flex-shrink-0" />
                <div className="min-w-0 leading-none">
                  <p className="text-[13px] font-bold">Ann AI</p>
                  <p className="mt-1 text-[10px] text-foreground/40">Sistema IA</p>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {visibleSections.map((section, i) => (
            <div key={section.title} className={i > 0 ? "mt-5" : undefined}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/35">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.name} href={item.href} onClick={onClose}>
                      <div className={cn(
                        "flex items-center gap-2.5 rounded-lg py-[7px] px-3 transition-all duration-150",
                        isActive
                          ? "bg-foreground/[0.07] text-[#dafc69]"
                          : "text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground"
                      )}>
                        <item.icon className="h-[14px] w-[14px] flex-shrink-0" />
                        <span className={cn("text-[13px] leading-none", isActive ? "font-semibold" : "font-medium")}>
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
          <div className="flex items-center gap-2.5 rounded-[14px] bg-[#dafc69]/[0.07] px-3 py-2.5 border border-[#dafc69]/15">
            <ShieldCheck className="h-3.5 w-3.5 text-[#dafc69]/80 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-[#dafc69]/80 tracking-widest uppercase">Smart Scale Internal</p>
              <p className="text-[10px] text-foreground/30 mt-0.5">Admin only</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
