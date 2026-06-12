"use client"

import {
  X, BarChart3, Radio, DollarSign, MessageSquare, Wrench,
  CalendarDays, Lock, LayoutGrid, ClipboardList,
  Zap, Globe, FileVideo, Clapperboard,
  ChevronDown, Trophy, FileBarChart, ShieldCheck, ArrowRight,
  ChevronLeft, ChevronRight, Sparkles,
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
      { name: "Audit",           href: "/audit",             icon: ClipboardList },
      { name: "Implementacion",  href: "/program-checklist", icon: Zap },
      { name: "Tools",           href: "/tools",             icon: Wrench },
      { name: "Agenda",          href: "/calendar",          icon: CalendarDays },
      { name: "Monday Win",      href: "/monday-win",        icon: Trophy },
      { name: "Reporte Mensual", href: "/report-input",      icon: FileBarChart },
      { name: "Cha-Ching 💰",    href: "/chi-chang",         icon: DollarSign },
    ],
  },
  {
    label: "Contenido",
    items: [
      { name: "Video Feed",           href: "/video-feed",          icon: Clapperboard },
      { name: "Competitor Research",  href: "/competitor-research", icon: Globe },
      { name: "Transcript de Videos", href: "/transcript",          icon: FileVideo },
    ],
  },
  {
    label: "Tu plan",
    items: [
      { name: "Próximo nivel", href: "/renovacion", icon: Sparkles },
    ],
  },
]


export function Sidebar({ open, onClose, isAdmin = false, collapsed = false, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const [groupsCollapsed, setGroupsCollapsed] = useState<Record<string, boolean>>({})

  const toggleGroup = (label: string) => {
    setGroupsCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[220px] border-r border-foreground/[0.07] transition-all duration-200 ease-in-out lg:translate-x-0",
          "bg-card flex flex-col pt-[env(safe-area-inset-top)]",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed && "lg:w-[64px]",
        )}
      >
        {/* Logo + collapse toggle (siempre en la misma fila) */}
        <div className={cn("flex h-16 flex-shrink-0 items-center border-b border-foreground/[0.07]", collapsed ? "lg:justify-center lg:px-2 px-5" : "justify-between px-5")}>
          {/* Logo: solo cuando NO está colapsado en desktop, o siempre en mobile */}
          {!collapsed && (
            <a href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <span className="text-foreground text-xl font-bold tracking-tight leading-none">Smart</span>
              <span className="rounded-md bg-foreground px-2 py-1 text-xl font-bold tracking-tight text-background shadow-sm leading-none">
                Scale
              </span>
            </a>
          )}

          <div className="flex items-center gap-1">
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

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto py-4 space-y-1", collapsed ? "lg:px-2" : "px-3")}>

          {/* Ann AI — disponible para todos. Item destacado, separado de los grupos. */}
          {(
            <Link href="/anai" onClick={onClose} title={collapsed ? "Ann AI" : undefined}>
              <div className={cn(
                "group relative mb-3 flex items-center overflow-hidden rounded-xl transition-all duration-200",
                "bg-gradient-to-br from-[#1a1a1d] to-[#0f0f10] border",
                pathname === "/anai"
                  ? "border-[#ffde21]/60 shadow-[0_0_22px_rgba(255,222,33,0.22)]"
                  : "border-[#ffde21]/20 hover:border-[#ffde21]/45 hover:shadow-[0_0_18px_rgba(255,222,33,0.16)]",
                collapsed ? "lg:justify-center lg:px-0 lg:py-2.5 px-3 py-2.5 gap-2.5" : "px-3 py-2.5 gap-2.5"
              )}>
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.10),transparent_60%)]" />
                <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#ffde21]">
                  <Sparkles className="h-4 w-4 text-black" />
                </div>
                {!collapsed && (
                  <div className="relative flex-1 min-w-0">
                    <p className="text-[13px] font-extrabold tracking-wide text-[#ffde21] leading-none">Ann AI</p>
                    <p className="text-[10px] text-foreground/40 mt-1 leading-none">Inteligencia artificial</p>
                  </div>
                )}
                {!collapsed && (
                  <span className="relative rounded-md bg-[#ffde21]/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#ffde21]/80">Beta</span>
                )}
              </div>
            </Link>
          )}

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

        {/* Footer */}
        <div className={cn("flex-shrink-0 border-t border-foreground/[0.07] space-y-3", collapsed ? "lg:p-2 p-4" : "p-4")}>
          {isAdmin && (
            <Link href="/admin/clients" onClick={onClose} title={collapsed ? "Smart Scale Internal" : undefined}>
              <div className={cn(
                "group relative flex items-center rounded-xl overflow-hidden transition-all duration-200",
                "bg-[#ffde21] hover:bg-[#ffe84d]",
                "shadow-[0_2px_14px_rgba(255,222,33,0.30)] hover:shadow-[0_4px_20px_rgba(255,222,33,0.45)]",
                collapsed ? "lg:justify-center lg:px-0 lg:py-2.5 px-3 py-2.5 gap-0" : "px-3 py-2.5 gap-2.5"
              )}>
                {/* subtle top-left shine */}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                <ShieldCheck className="relative h-4 w-4 text-black/70 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <div className="relative flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-black tracking-wide leading-none">Smart Scale Internal</p>
                      <p className="text-[10px] text-black/50 mt-1 leading-none">Panel de administración</p>
                    </div>
                    <ArrowRight className="relative h-3.5 w-3.5 text-black/40 group-hover:text-black/60 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </>
                )}
              </div>
            </Link>
          )}

          {!collapsed && (
            <div className="flex items-center gap-2.5 rounded-xl bg-foreground/[0.03] px-3 py-2.5 border border-foreground/[0.07]">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#ffde21] animate-pulse flex-shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-foreground/60 tracking-widest uppercase">Client Analytics</p>
                <p className="text-[10px] text-foreground/30 mt-0.5">Portal 2.0</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
