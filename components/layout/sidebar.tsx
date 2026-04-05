"use client"

import {
  X, BarChart3, Radio, DollarSign, MessageSquare, Wrench,
  CalendarDays, Lock, LayoutGrid, LineChart, ClipboardList,
  Zap, Globe, Upload, History, Telescope, FileVideo, Clapperboard
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface SidebarProps {
  open: boolean
  onClose: () => void
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
      { name: "Audit",                    href: "/audit",               icon: ClipboardList },
      { name: "Implementacion",            href: "/program-checklist",   icon: Zap },
      { name: "Tools",                    href: "/tools",               icon: Wrench },
      { name: "Agenda",                   href: "/calendar",            icon: CalendarDays },
    ],
  },
  {
    label: "Contenido",
    items: [
      { name: "Video Feed",            href: "/video-feed",          icon: Clapperboard },
      { name: "Competitor Research",   href: "/competitor-research", icon: Globe },
      { name: "Transcript de Videos",  href: "/transcript",          icon: FileVideo },
    ],
  },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 border-r border-white/[0.06] transition-transform duration-300 ease-in-out lg:translate-x-0",
          "bg-[#0c0c0d] flex flex-col",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
          <a href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <span className="text-white text-sm font-bold tracking-[0.22em]">SMART</span>
            <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-black shadow-sm">
              SCALE
            </span>
          </a>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#ffde21]/25 bg-[#ffde21]/8 px-2 py-0.5 text-[9px] font-bold text-[#ffde21]/80 tracking-widest uppercase">
              v2.0
            </span>
            <button
              className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/8 transition-all"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href

                  if ((item as any).disabled) {
                    return (
                      <div
                        key={item.name}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 opacity-35 cursor-not-allowed select-none"
                      >
                        <item.icon className="h-4 w-4 text-white/40 flex-shrink-0" />
                        <span className="flex-1 text-sm text-white/40">{item.name}</span>
                        <Lock className="h-3 w-3 text-white/25 flex-shrink-0" />
                      </div>
                    )
                  }

                  return (
                    <Link key={item.name} href={item.href} onClick={onClose}>
                      <div
                        className={cn(
                          "relative flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-150",
                          isActive
                            ? "bg-[#ffde21]/10 text-white"
                            : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] bg-[#ffde21] rounded-full" />
                        )}
                        <item.icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0 transition-colors",
                            isActive ? "text-[#ffde21]" : "text-white/35"
                          )}
                        />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#ffde21]/15 bg-[#ffde21]/[0.04] px-3 py-2.5">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#ffde21] animate-pulse" />
            <div>
              <p className="text-[10px] font-semibold text-[#ffde21]/70 tracking-widest uppercase">Client Analytics</p>
              <p className="text-[10px] text-white/25 mt-0.5">Portal 2.0</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
