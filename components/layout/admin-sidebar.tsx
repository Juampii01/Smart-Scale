"use client"

import { useEffect, useState } from "react"
import {
  X, DollarSign, ClipboardList, Table2, Users2,
  UserCheck, Layers, Briefcase, ArrowLeft, ShieldCheck,
  ChevronLeft, ChevronRight, MessageSquareText, UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { canAccessAdminPath, isAdmin } from "@/lib/auth/permissions"
import { useEffectiveRole } from "@/lib/auth/view-as"

interface AdminSidebarProps {
  open: boolean
  onClose: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

const ADMIN_NAV_ITEMS = [
  { name: "Adquisition Stats", href: "/admin/data",             icon: Table2 },
  { name: "Leads",            href: "/admin/leads",             icon: Users2 },
  { name: "Setting",          href: "/admin/setting",           icon: MessageSquareText },
  { name: "Onboarding",       href: "/admin/onboarding",        icon: UserPlus },
  { name: "Pagos",            href: "/admin/payments",          icon: DollarSign },
  { name: "Clientes",         href: "/admin/clients",           icon: UserCheck },
  { name: "Aplicaciones",     href: "/admin/applications",      icon: ClipboardList },
  { name: "Contratación",     href: "/admin/team-applications", icon: Briefcase },
  { name: "Centro Operativo", href: "/admin/centro-operativo",  icon: Layers },
]

export function AdminSidebar({ open, onClose, collapsed = false, onToggleCollapsed }: AdminSidebarProps) {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string | null | undefined>(undefined) // undefined = aún cargando

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { setUserRole(null); return }
      supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
        .then(({ data: prof }) => setUserRole((prof as any)?.role ?? null))
    })
  }, [])

  // Si admin está en modo "view as setter/team", el sidebar se filtra como ese rol
  const effectiveRole = useEffectiveRole(userRole === undefined ? null : userRole)

  // Filtrar items según permisos del rol. Mientras carga (undefined) no mostramos
  // nada para evitar el flash de "todos visible y luego se filtra".
  const visibleItems = userRole === undefined
    ? []
    : ADMIN_NAV_ITEMS.filter(item => canAccessAdminPath(effectiveRole, item.href))

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[220px] border-r border-foreground/[0.07] transition-all duration-200 ease-in-out lg:translate-x-0",
          "bg-card flex flex-col",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed && "lg:w-[64px]",
        )}
      >
        {/* Logo + collapse toggle (siempre en la misma fila) */}
        <div className={cn("flex-shrink-0 border-b border-foreground/[0.07] py-3", collapsed ? "lg:px-2 px-5" : "px-5")}>
          <div className={cn("flex items-center", collapsed ? "lg:justify-center justify-between" : "justify-between")}>
            {!collapsed && (
              <a href="/admin/clients" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                <span className="text-foreground text-xl font-bold tracking-tight leading-none">Smart</span>
                <span className="rounded-md bg-foreground px-2 py-1 text-xl font-bold tracking-tight text-background shadow-sm leading-none">
                  Scale
                </span>
              </a>
            )}
            <div className="flex items-center gap-1.5">
              {onToggleCollapsed && (
                <button
                  className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-foreground/40 hover:text-[#ffde21] hover:bg-[#ffde21]/[0.08] transition-all border border-transparent hover:border-[#ffde21]/20"
                  onClick={onToggleCollapsed}
                  aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
                  title={collapsed ? "Expandir (Cmd+\\)" : "Colapsar (Cmd+\\)"}
                >
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
              )}
              <button
                className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-all"
                onClick={onClose}
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {!collapsed && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#ffde21]/30 bg-[#ffde21]/[0.08] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#ffde21]">
              <ShieldCheck className="h-2.5 w-2.5" />
              Internal
            </span>
          )}
        </div>

        {/* Back to portal — solo para admin (setter/team no tienen portal de cliente) */}
        {isAdmin(effectiveRole) && (
          <div className={cn("pt-3", collapsed ? "lg:px-2 px-3" : "px-3")}>
            <Link href="/dashboard" onClick={onClose} title={collapsed ? "Volver al portal" : undefined}>
              <div className={cn(
                "group flex items-center gap-2 rounded-lg border border-foreground/[0.07] bg-foreground/[0.02] py-2 text-[12px] font-semibold text-foreground/55 hover:text-foreground hover:border-foreground/[0.15] transition-all",
                collapsed ? "lg:justify-center lg:px-2 px-3" : "px-3"
              )}>
                <ArrowLeft className="h-3.5 w-3.5 flex-shrink-0" />
                {!collapsed && "Volver al portal"}
              </div>
            </Link>
          </div>
        )}

        {/* Section header */}
        {!collapsed && (
          <div className="mx-2 mt-4 mb-2 flex items-center gap-2">
            <div className="flex-1 h-px bg-foreground/[0.07]" />
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#ffde21]/40 whitespace-nowrap">
              Smart Scale CRM
            </span>
            <div className="flex-1 h-px bg-foreground/[0.07]" />
          </div>
        )}
        {collapsed && <div className="mx-2 mt-4 mb-2 h-px bg-foreground/[0.07]" />}

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto pb-4 space-y-0.5", collapsed ? "lg:px-2 px-3" : "px-3")}>
          {visibleItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link key={item.name} href={item.href} onClick={onClose} title={collapsed ? item.name : undefined}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg py-[7px] transition-all duration-150",
                    collapsed ? "lg:justify-center lg:px-2 px-3" : "px-3",
                    isActive
                      ? "bg-foreground/[0.07] text-[#ffde21]"
                      : "text-foreground/80 hover:bg-foreground/[0.05] hover:text-foreground"
                  )}
                >
                  <item.icon className="h-[14px] w-[14px] flex-shrink-0 text-[#ffde21]" />
                  {!collapsed && (
                    <span className={cn(
                      "text-[13px] leading-none",
                      isActive ? "font-semibold" : "font-medium"
                    )}>
                      {item.name}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="flex-shrink-0 border-t border-foreground/[0.07] p-4">
            <div className="flex items-center gap-2.5 rounded-xl bg-[#ffde21]/[0.07] px-3 py-2.5 border border-[#ffde21]/15">
              <ShieldCheck className="h-3.5 w-3.5 text-[#ffde21]/80 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-[#ffde21]/80 tracking-widest uppercase">Smart Scale Internal</p>
                <p className="text-[10px] text-foreground/30 mt-0.5">Admin only</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
