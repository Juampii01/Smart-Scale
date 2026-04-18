"use client"

import {
  X, BarChart3, Radio, DollarSign, MessageSquare, Wrench,
  CalendarDays, Lock, LayoutGrid, LineChart, ClipboardList,
  Zap, Globe, Upload, History, Telescope, FileVideo, Clapperboard,
  ChevronDown, Table2, Users2, ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

interface SidebarProps {
  open: boolean
  onClose: () => void
  isAdmin?: boolean
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
]

const ADMIN_NAV_GROUP = {
  label: "Smart Scale CRM",
  items: [
    { name: "Tabla de Datos", href: "/admin/data",         icon: Table2  },
    { name: "Leads",          href: "/admin/leads",        icon: Users2  },
    { name: "Pagos",          href: "/admin/payments",     icon: DollarSign },
    { name: "Aplicaciones",   href: "/admin/applications", icon: ClipboardList },
  ],
}

export function Sidebar({ open, onClose, isAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleGroup = (label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[220px] border-r border-white/[0.07] transition-transform duration-300 ease-in-out lg:translate-x-0",
          "bg-[#111113] flex flex-col",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-white/[0.07] px-5">
          <a href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <span className="text-white text-xl font-bold tracking-tight">Smart</span>
            <span className="rounded-md bg-white px-2.5 py-1 text-base font-bold tracking-tight text-black shadow-sm">
              Scale
            </span>
          </a>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold text-white/25 tracking-widest uppercase">
              v2.0
            </span>
            <button
              className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-all"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {[...NAV_GROUPS, ...(isAdmin ? [ADMIN_NAV_GROUP] : [])].map((group) => {
            const isCollapsed = collapsed[group.label]
            const hasActive = group.items.some(i => pathname === i.href)
            const isAdminGroup = group.label === "Smart Scale CRM"

            return (
              <div key={group.label} className="mb-1">
                {isAdminGroup && (
                  <div className="mx-2 my-3 flex items-center gap-2">
                    <div className="flex-1 h-px bg-white/[0.07]" />
                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#ffde21]/40">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Smart Scale CRM
                    </span>
                    <div className="flex-1 h-px bg-white/[0.07]" />
                  </div>
                )}
                {/* Group header — clickable to collapse */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-all duration-150",
                    "hover:bg-white/[0.05]",
                    hasActive && isCollapsed ? "text-[#ffde21]" : "text-white/80"
                  )}
                >
                  <span className="text-[13px] font-semibold tracking-wide">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-white/30 transition-transform duration-200 flex-shrink-0",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <div className="mt-0.5 space-y-0.5 pl-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href

                      if ((item as any).disabled) {
                        return (
                          <div
                            key={item.name}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 opacity-25 cursor-not-allowed select-none"
                          >
                            <item.icon className="h-[14px] w-[14px] text-white/40 flex-shrink-0" />
                            <span className="text-[13px] text-white/40">{item.name}</span>
                            <Lock className="ml-auto h-3 w-3 text-white/25 flex-shrink-0" />
                          </div>
                        )
                      }

                      return (
                        <Link key={item.name} href={item.href} onClick={onClose}>
                          <div
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-3 py-[7px] transition-all duration-150",
                              isActive
                                ? "bg-white/[0.07] text-[#ffde21]"
                                : "text-white/80 hover:bg-white/[0.05] hover:text-white"
                            )}
                          >
                            <item.icon
                              className="h-[14px] w-[14px] flex-shrink-0 text-[#ffde21]"
                            />
                            <span className={cn(
                              "text-[13px] leading-none",
                              isActive ? "font-semibold" : "font-medium"
                            )}>
                              {item.name}
                            </span>
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
        <div className="flex-shrink-0 border-t border-white/[0.07] p-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-[#ffde21]/[0.07] px-3 py-2.5 border border-[#ffde21]/15">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#ffde21] animate-pulse flex-shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-[#ffde21]/80 tracking-widest uppercase">Client Analytics</p>
              <p className="text-[10px] text-white/30 mt-0.5">Portal 2.0</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
