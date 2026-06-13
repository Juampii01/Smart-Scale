"use client"

import {
  X, BarChart3, Radio, DollarSign, MessageSquare, Wrench,
  CalendarDays, Lock, LayoutGrid, ClipboardList,
  Zap, Globe, FileVideo,
  ChevronDown, ShieldCheck, ArrowRight,
  ChevronLeft, ChevronRight, Sparkles, PenLine, Instagram, Youtube,
  User, Pencil,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

interface SidebarProps {
  open: boolean
  onClose: () => void
  isAdmin?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  // Perfil — para el bloque de avatar al pie del sidebar (link a /perfil)
  avatarUrl?: string | null
  displayName?: string | null
  email?: string | null
}

const NAV_GROUPS = [
  {
    label: "Performance",
    items: [
      { name: "Performance Center", href: "/dashboard",  icon: BarChart3 },
      { name: "Channels",           href: "/channels",   icon: Radio },
      { name: "Sales",              href: "/sales",      icon: DollarSign },
      { name: "Reflection",         href: "/reflection", icon: MessageSquare },
      { name: "All Metrics",        href: "/metrics",    icon: LayoutGrid },
    ],
  },
  {
    label: "Programa",
    items: [
      { name: "Audit",          href: "/audit",             icon: ClipboardList },
      { name: "Implementacion", href: "/program-checklist", icon: Zap },
      { name: "Tools",          href: "/tools",             icon: Wrench },
      { name: "Agenda",         href: "/calendar",          icon: CalendarDays },
    ],
  },
  {
    label: "Mis reportes",
    items: [
      { name: "Llenar reporte", href: "/llenar", icon: PenLine },
    ],
  },
  {
    label: "Contenido",
    items: [
      { name: "Mi Instagram",         href: "/mi-instagram",        icon: Instagram },
      { name: "Mi YouTube",           href: "/mi-youtube",          icon: Youtube },
      { name: "Competitor Research",  href: "/competitor-research", icon: Globe },
      { name: "Transcript de Videos", href: "/transcript",          icon: FileVideo },
    ],
  },
  // La página /renovacion existe pero NO va en el sidebar:
  // el equipo le envía el link directo al cliente cuando corresponde.
]


export function Sidebar({
  open, onClose, isAdmin = false, collapsed = false, onToggleCollapsed,
  avatarUrl, displayName, email,
}: SidebarProps) {
  const pathname = usePathname()
  const [groupsCollapsed, setGroupsCollapsed] = useState<Record<string, boolean>>({})

  const toggleGroup = (label: string) => {
    setGroupsCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const profileLabel = displayName ?? email ?? "Mi perfil"
  const hasProfile = Boolean(displayName || email)

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[220px] transition-all duration-200 ease-in-out lg:translate-x-0",
          "bg-card flex flex-col pt-[env(safe-area-inset-top)] overflow-hidden",
          "border-r border-foreground/[0.07]",                                        // borde drawer (mobile)
          // Flotante en desktop: despegado, redondeado, con sombra suave
          "lg:left-4 lg:top-4 lg:bottom-4 lg:h-auto lg:rounded-2xl lg:border lg:border-foreground/[0.08] lg:shadow-[0_10px_36px_-18px_rgba(0,0,0,0.30)]",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed && "lg:w-[68px]",
        )}
      >
        {/* Logo + collapse toggle (siempre en la misma fila) */}
        <div className={cn("flex h-16 flex-shrink-0 items-center border-b border-foreground/[0.07]", collapsed ? "lg:justify-center lg:px-2 px-4" : "justify-between pl-5 pr-3")}>
          {/* Logo: solo cuando NO está colapsado en desktop, o siempre en mobile */}
          {!collapsed && (
            <a href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <span className="text-foreground text-xl font-bold tracking-tight leading-none">Smart</span>
              <span className="rounded-md bg-foreground px-2 py-1 text-xl font-bold tracking-tight text-background shadow-sm leading-none">
                Scale
              </span>
              <span className="self-start rounded-full bg-[#ffde21]/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#ffde21] leading-none">
                3.0
              </span>
            </a>
          )}

          <div className="flex items-center gap-1">
            {onToggleCollapsed && (
              <button
                className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-foreground/35 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
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

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto py-4 space-y-1", collapsed ? "lg:px-2" : "px-3")}>

          {NAV_GROUPS.map((group) => {
            const isGroupCollapsed = groupsCollapsed[group.label]
            const hasActive = group.items.some(i => pathname === i.href)

            return (
              <div key={group.label} className="mb-1">
                {/* Group header — clickable to collapse (oculto cuando sidebar colapsada) */}
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-all duration-150",
                      "hover:bg-foreground/[0.05]",
                      hasActive && isGroupCollapsed ? "text-[#ffde21]" : "text-foreground/80"
                    )}
                  >
                    <span className="text-[13px] font-semibold tracking-wide">{group.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-foreground/30 transition-transform duration-200 flex-shrink-0",
                        isGroupCollapsed && "-rotate-90"
                      )}
                    />
                  </button>
                )}

                {/* Items */}
                {(collapsed || !isGroupCollapsed) && (
                  <div className={cn("space-y-0.5", collapsed ? "lg:mt-0 mt-0.5 lg:pl-0 pl-1" : "mt-0.5 pl-1")}>
                    {group.items.map((item) => {
                      const isActive = pathname === item.href

                      if ((item as any).disabled) {
                        return (
                          <div
                            key={item.name}
                            className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 opacity-25 cursor-not-allowed select-none", collapsed && "lg:justify-center lg:px-2")}
                            title={item.name}
                          >
                            <item.icon className="h-[14px] w-[14px] text-foreground/40 flex-shrink-0" />
                            {!collapsed && <span className="text-[13px] text-foreground/40">{item.name}</span>}
                            {!collapsed && <Lock className="ml-auto h-3 w-3 text-foreground/25 flex-shrink-0" />}
                          </div>
                        )
                      }

                      return (
                        <Link key={item.name} href={item.href} onClick={onClose}>
                          <div
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg py-[7px] transition-all duration-150",
                              collapsed ? "lg:justify-center lg:px-2 px-3" : "px-3",
                              isActive
                                ? "bg-foreground/[0.07] text-[#ffde21]"
                                : "text-foreground/80 hover:bg-foreground/[0.05] hover:text-foreground"
                            )}
                            title={collapsed ? item.name : undefined}
                          >
                            <item.icon
                              className="h-[14px] w-[14px] flex-shrink-0 text-[#ffde21]"
                            />
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
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer — compacto: Ann AI + acceso admin */}
        <div className={cn("flex-shrink-0 border-t border-foreground/[0.07] space-y-1.5", collapsed ? "lg:p-2 p-3" : "p-3")}>
          {/* Ann AI (para todos) — compacto */}
          <Link href="/anai" onClick={onClose} title={collapsed ? "Ann AI" : undefined}>
            <div className={cn(
              "group flex items-center rounded-lg transition-all duration-150",
              pathname === "/anai"
                ? "bg-[#ffde21]/[0.12] text-[#ffde21]"
                : "text-foreground/80 hover:bg-foreground/[0.05]",
              collapsed ? "lg:justify-center lg:px-2 px-3 py-2 gap-2.5" : "px-3 py-2 gap-2.5"
            )}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#ffde21]">
                <Sparkles className="h-3.5 w-3.5 text-black" />
              </span>
              {!collapsed && <span className="text-[13px] font-semibold">Ann AI</span>}
            </div>
          </Link>

          {/* Acceso al panel interno (solo admin) — compacto */}
          {isAdmin && (
            <Link href="/admin/clients" onClick={onClose} title={collapsed ? "Panel interno" : undefined}>
              <div className={cn(
                "group flex items-center rounded-lg text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground transition-all duration-150",
                collapsed ? "lg:justify-center lg:px-2 px-3 py-2 gap-2.5" : "px-3 py-2 gap-2.5"
              )}>
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#ffde21]" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-[13px] font-medium">Panel interno</span>
                    <ArrowRight className="h-3.5 w-3.5 text-foreground/30 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </div>
            </Link>
          )}

          {/* Perfil — link a "Editar perfil" (nombre, email, contraseña y foto) */}
          {hasProfile && (
            <Link
              href="/perfil"
              onClick={onClose}
              title={collapsed ? `${profileLabel} — editar perfil` : "Editar perfil"}
              className={cn(
                "group/profile mt-1 flex w-full items-center rounded-lg border transition-all duration-150",
                pathname === "/perfil"
                  ? "border-[#ffde21]/30 bg-[#ffde21]/[0.08]"
                  : "border-foreground/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.05]",
                collapsed ? "lg:justify-center lg:px-2 px-3 py-2 gap-2.5" : "px-2.5 py-2 gap-2.5"
              )}
            >
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ffde21]/40 bg-[#ffde21]/10 text-[13px] font-bold text-[#ffde21]">
                {avatarUrl
                  ? <img src={avatarUrl} alt="Perfil" className="h-full w-full object-cover" />
                  : <User className="h-4 w-4 text-[#ffde21]" />}
                {/* Badge de lápiz — invita a editar; en hover si ya hay foto */}
                <span className={cn(
                  "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ffde21] ring-2 ring-card",
                  avatarUrl && "opacity-0 group-hover/profile:opacity-100 transition-opacity"
                )}>
                  <Pencil className="h-2.5 w-2.5 text-black" />
                </span>
              </span>
              {!collapsed && (
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] font-semibold text-foreground">{profileLabel}</span>
                  <span className="block truncate text-[11px] text-foreground/45">Editar perfil</span>
                </span>
              )}
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}
