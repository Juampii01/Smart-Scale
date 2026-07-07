"use client"

import { useEffect, useState } from "react"
import {
  X, DollarSign, ClipboardList, Table2, Users2,
  UserCheck, Layers, Briefcase, ArrowLeft, ShieldCheck,
  MessageSquareText, UserPlus,
  LayoutDashboard, CalendarDays, Brain, Terminal, CheckSquare, Bell, Share2, Instagram, Sparkles, Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { canAccessAdminPath, isAdmin } from "@/lib/auth/permissions"
import { useEffectiveRole } from "@/lib/auth/view-as"
import { isOmniOwnerEmail } from "@/lib/omni/owner"

interface AdminSidebarProps {
  open: boolean
  onClose: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

const ADMIN_NAV_ITEMS = [
  { name: "Dashboard",         href: "/admin/executive-dashboard", icon: LayoutDashboard },
  { name: "Adquisition Stats", href: "/admin/data",             icon: Table2 },
  { name: "Leads",            href: "/admin/leads",             icon: Users2 },
  { name: "Setting",          href: "/admin/setting",           icon: MessageSquareText },
  { name: "Onboarding",       href: "/admin/onboarding",        icon: UserPlus },
  { name: "Pagos",            href: "/admin/payments",          icon: DollarSign },
  { name: "Clientes",         href: "/admin/clients",           icon: UserCheck },
  { name: "Aplicaciones",     href: "/admin/applications",      icon: ClipboardList },
  { name: "Contratación",     href: "/admin/team-applications", icon: Briefcase },
  { name: "Centro Operativo", href: "/admin/centro-operativo",  icon: Layers },
  { name: "Cerebro de Ann",   href: "/admin/ann-knowledge",     icon: Brain },
  { name: "Tareas",           href: "/admin/tareas",            icon: CheckSquare },
  { name: "Notificaciones",   href: "/admin/notificaciones",    icon: Bell },
]

// Sección "Desarrollador" — herramientas técnicas, al final del sidebar.
const DEV_NAV_ITEMS = [
  { name: "Agenda",     href: "/admin/agenda",              icon: CalendarDays },
  { name: "Conexiones", href: "/admin/conexiones",          icon: Share2 },
  { name: "Actividad",  href: "/admin/actividad-clientes",  icon: Activity },
  { name: "Dev Logs",   href: "/admin/dev-logs",            icon: Terminal },
  { name: "Instagram",  href: "/admin/instagram-access",    icon: Instagram },
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

  const visibleItems = userRole === undefined
    ? []
    : ADMIN_NAV_ITEMS.filter(item => canAccessAdminPath(effectiveRole, item.href))

  const visibleDevItems = userRole === undefined
    ? []
    : DEV_NAV_ITEMS.filter(item => canAccessAdminPath(effectiveRole, item.href))

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
            <a href="/admin/clients" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <span className="text-foreground text-xl font-bold tracking-tight leading-none">Smart</span>
              <span className="rounded-md bg-foreground px-2 py-1 text-xl font-bold tracking-tight text-background shadow-sm leading-none">Scale</span>
            </a>
            <button
              className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-all"
              onClick={onClose}
              aria-label="Cerrar menú"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#ffde21]/30 bg-[#ffde21]/[0.08] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#ffde21]">
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

        {/* Omni — sistema de IA (destacado, solo dueño del proyecto + Ann) */}
        {isOmniOwner && (
          <div className="px-3 pt-1">
            <Link href="/admin/omni" onClick={onClose}>
              <div className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all",
                pathname === "/admin/omni"
                  ? "border-[#ffde21]/45 bg-[#ffde21]/[0.14] text-[#ffde21]"
                  : "border-[#ffde21]/20 bg-[#ffde21]/[0.06] text-[#ffde21]/90 hover:bg-[#ffde21]/[0.12] hover:border-[#ffde21]/40"
              )}>
                <Sparkles className="h-4 w-4 flex-shrink-0" />
                <div className="min-w-0 leading-none">
                  <p className="text-[13px] font-bold">Omni</p>
                  <p className="mt-1 text-[10px] text-foreground/40">Sistema IA · Ann</p>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/35">
            Smart Scale CRM
          </p>
          <div className="space-y-0.5">
            {visibleItems.map(item => {
              const isActive = pathname === item.href
              return (
                <Link key={item.name} href={item.href} onClick={onClose}>
                  <div className={cn(
                    "flex items-center gap-2.5 rounded-lg py-[7px] px-3 transition-all duration-150",
                    isActive
                      ? "bg-foreground/[0.07] text-[#ffde21]"
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

          {visibleDevItems.length > 0 && (
            <>
              <p className="px-3 mt-5 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/35">
                Desarrollador
              </p>
              <div className="space-y-0.5">
                {visibleDevItems.map(item => {
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.name} href={item.href} onClick={onClose}>
                      <div className={cn(
                        "flex items-center gap-2.5 rounded-lg py-[7px] px-3 transition-all duration-150",
                        isActive
                          ? "bg-foreground/[0.07] text-[#ffde21]"
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
            </>
          )}
        </nav>

        {/* Footer — sin línea divisoria */}
        <div className="flex-shrink-0 p-3">
          <div className="flex items-center gap-2.5 rounded-[14px] bg-[#ffde21]/[0.07] px-3 py-2.5 border border-[#ffde21]/15">
            <ShieldCheck className="h-3.5 w-3.5 text-[#ffde21]/80 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-[#ffde21]/80 tracking-widest uppercase">Smart Scale Internal</p>
              <p className="text-[10px] text-foreground/30 mt-0.5">Admin only</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
