"use client"

import {
  X, DollarSign, ClipboardList, Upload, Table2, Users2,
  UserCheck, Layers, Briefcase, ArrowLeft, ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface AdminSidebarProps {
  open: boolean
  onClose: () => void
}

const ADMIN_NAV_ITEMS = [
  { name: "Adquisition Stats", href: "/admin/data",             icon: Table2 },
  { name: "Leads",            href: "/admin/leads",             icon: Users2 },
  { name: "Pagos",            href: "/admin/payments",          icon: DollarSign },
  { name: "Clientes",         href: "/admin/clients",           icon: UserCheck },
  { name: "Aplicaciones",     href: "/admin/applications",      icon: ClipboardList },
  { name: "Contratación",     href: "/admin/team-applications", icon: Briefcase },
  { name: "Importar Datos",   href: "/admin/import",            icon: Upload },
  { name: "Centro Operativo", href: "/admin/centro-operativo",  icon: Layers },
]

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname()

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
        {/* Logo / brand */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-white/[0.07] px-5">
          <a href="/admin/clients" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <span className="text-white text-xl font-bold tracking-tight leading-none">Smart</span>
            <span className="rounded-md bg-white px-2 py-1 text-xl font-bold tracking-tight text-black shadow-sm leading-none">
              Scale
            </span>
          </a>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#ffde21]/30 bg-[#ffde21]/[0.08] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-[#ffde21]">
              <ShieldCheck className="h-2.5 w-2.5" />
              Internal
            </span>
            <button
              className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-all"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Back to portal */}
        <div className="px-3 pt-3">
          <Link href="/dashboard" onClick={onClose}>
            <div className="group flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px] font-semibold text-white/55 hover:text-white hover:border-white/[0.15] transition-all">
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al portal
            </div>
          </Link>
        </div>

        {/* Section header */}
        <div className="mx-2 mt-4 mb-2 flex items-center gap-2">
          <div className="flex-1 h-px bg-white/[0.07]" />
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#ffde21]/40 whitespace-nowrap">
            Smart Scale CRM
          </span>
          <div className="flex-1 h-px bg-white/[0.07]" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
          {ADMIN_NAV_ITEMS.map(item => {
            const isActive = pathname === item.href
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
                  <item.icon className="h-[14px] w-[14px] flex-shrink-0 text-[#ffde21]" />
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
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-white/[0.07] p-4">
          <div className="flex items-center gap-2.5 rounded-xl bg-[#ffde21]/[0.07] px-3 py-2.5 border border-[#ffde21]/15">
            <ShieldCheck className="h-3.5 w-3.5 text-[#ffde21]/80 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-[#ffde21]/80 tracking-widest uppercase">Smart Scale Internal</p>
              <p className="text-[10px] text-white/30 mt-0.5">Admin only</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
