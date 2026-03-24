"use client"

import { X, BarChart3, Radio, DollarSign, MessageSquare, Wrench, CalendarDays, LayoutDashboard } from "lucide-react"
import { Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SidebarSection } from "./sidebar-section"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useContext } from "react"
import { DashboardLayout } from "./dashboard-layout"

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const dashboardGlobalItems = [
  { name: "Performance Center", href: "/dashboard", icon: BarChart3 },
  { name: "Channels", href: "/channels", icon: Radio },
  { name: "Sales", href: "/sales", icon: DollarSign },
  { name: "Reflection", href: "/reflection", icon: MessageSquare },
  { name: "All Metrics", href: "/metrics", icon: BarChart3 },
];

const navigation = [
  { section: "dashboardGlobal", items: dashboardGlobalItems },
  { name: "Audit", href: "/audit", icon: Lock, disabled: true },
  { name: "Program Journey Checklist", href: "/program-checklist", icon: Wrench, disabled: true },
  { name: "Market Intelligence", href: "/market-intelligence", icon: BarChart3 },
  { name: "Tools", href: "/tools", icon: Wrench },
  { name: "Agenda", href: "/calendar", icon: CalendarDays },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  // Obtener el rol del usuario desde el contexto de DashboardLayout
  // (Si no existe contexto, fallback a null)
  let userRole: string | null = null
  try {
    // DashboardLayout pone userRole en el estado global, lo buscamos si existe
    // @ts-ignore
    userRole = window.__DASHBOARD_USER_ROLE__ || null
  } catch {}
  const isAdmin = (userRole ?? "").toLowerCase() === "admin"

  return (
    <>
      {/* Mobile Overlay */}
      {open && <div className="fixed inset-0 z-40 bg-black/80 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 border-r border-sidebar-border transition-transform duration-200 lg:translate-x-0",
          "bg-gradient-to-b from-[#18181b] via-[#232326] to-[#18181b]",
          "shadow-xl",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
          <a href="/" className="flex items-center gap-2 font-semibold tracking-tight hover:opacity-80 transition-opacity">
            <span className="text-sidebar-foreground text-sm tracking-widest">
              SMART
            </span>
            <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-black shadow-sm">
              SCALE
            </span>
          </a>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="space-y-1 p-4">
          {/* Dashboard Global Section */}
          <SidebarSection
            title="KPI's Dashboard"
            icon={LayoutDashboard}
            items={dashboardGlobalItems}
            activePath={pathname}
            onClose={onClose}
          />
          {/* Separator */}
          <div className="my-3 mx-2 h-px bg-sidebar-border/50" />

          {/* Otros ítems independientes */}
          {navigation.slice(1).map((item) => {
            const isActive = pathname === item.href;
            // Siempre renderizamos un <Link> (o <a>), pero deshabilitamos navegación y click si está disabled
            return (
              <Link
                key={item.name}
                href={item.disabled ? '#' : item.href}
                onClick={item.disabled ? (e) => e.preventDefault() : onClose}
                tabIndex={item.disabled ? -1 : 0}
                aria-disabled={item.disabled ? 'true' : 'false'}
                className={cn(
                  'group relative block',
                  item.disabled ? 'pointer-events-none select-none' : ''
                )}
              >
                <div className={cn("group relative")}> 
                  {isActive && !item.disabled ? (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-[#ffde21] rounded-full transition-all duration-200" />
                  ) : null}
                  <Button
                    variant={isActive && !item.disabled ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3 transition-all duration-200 rounded-lg",
                      item.disabled
                        ? "opacity-50 cursor-not-allowed hover:bg-transparent text-white overflow-hidden"
                        : isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                    disabled={!!item.disabled}
                  >
                    <item.icon className="h-4 w-4 text-[#ffde21] flex-shrink-0" />
                    <span className="flex-1 text-white text-left flex items-center">{item.name}</span>
                    {item.disabled ? (
                      <span className="flex items-center flex-shrink-0"><Lock className="h-4 w-4 text-gray-400" /></span>
                    ) : null}
                  </Button>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-2 rounded-lg border border-[#ffde21]/20 bg-[#ffde21]/5 px-3 py-2">
            <span className="flex h-2 w-2 rounded-full bg-[#ffde21]" />
            <span className="text-xs font-medium text-[#ffde21]/80 tracking-wide">Client Analytics Portal</span>
          </div>
        </div>
      </aside>
    </>
  )
}
