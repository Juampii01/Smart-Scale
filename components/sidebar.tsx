"use client"

import { X, BarChart3, Radio, DollarSign, MessageSquare, Wrench, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Channels", href: "/channels", icon: Radio },
  { name: "Sales", href: "/sales", icon: DollarSign },
  { name: "Reflection", href: "/reflection", icon: MessageSquare },
  { name: "All Metrics", href: "/metrics", icon: BarChart3 },
  { name: "Tools", href: "/tools", icon: Wrench },
  { name: "Agenda", href: "/calendar", icon: CalendarDays },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile Overlay */}
      {open && <div className="fixed inset-0 z-40 bg-black/80 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="text-sidebar-foreground text-sm tracking-widest">
              SMART
            </span>
            <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-black shadow-sm">
              SCALE
            </span>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link key={item.name} href={item.href} onClick={onClose}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 text-orange-400" />
                  {item.name}
                </Button>
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4 text-xs text-sidebar-foreground/40">
          Client Analytics Portal
        </div>
      </aside>
    </>
  )
}
