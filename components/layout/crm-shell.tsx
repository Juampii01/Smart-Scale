"use client"

// Shell propio del CRM interno — deliberadamente separado de DashboardLayout
// (el panel externo). Mismo criterio que muestra el diseño aprobado: entrar
// al CRM es una cuenta distinta, no una pestaña más del portal.

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeft, Lock, Menu, X, LayoutDashboard, Kanban, Users, MessageCircle,
  FileText, Target, CalendarCheck, Rocket, DollarSign, FileSignature,
  CheckSquare, BookOpen, Sparkles,
} from "lucide-react"
import { BrandLogo } from "@/components/theme/brand-logo"
import { cn } from "@/lib/utils"

type NavItem = { label: string; href?: string; icon: React.ComponentType<{ className?: string }> }

const GROUPS: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [{ label: "Hoy", href: "/crm/hoy", icon: LayoutDashboard }] },
  {
    label: "Tu cartera",
    items: [
      { label: "Pipeline", href: "/crm/pipeline", icon: Kanban },
      { label: "Prospectos", icon: Users },
      { label: "Conversaciones", icon: MessageCircle },
    ],
  },
  {
    label: "Tu embudo",
    items: [
      { label: "Aplicaciones", icon: FileText },
      { label: "Leads", icon: Target },
      { label: "Agendamiento", icon: CalendarCheck },
      { label: "Onboarding", icon: Rocket },
    ],
  },
  { label: "Tu dinero", items: [{ label: "Cobros", icon: DollarSign }, { label: "Contratos", icon: FileSignature }] },
  { label: "Operación", items: [{ label: "Tareas", icon: CheckSquare }, { label: "Context Room", icon: BookOpen }] },
  { label: "Asistente", items: [{ label: "Ann AI", icon: Sparkles }] },
]

function NavRow({ label, href, icon: Icon, active }: NavItem & { active: boolean }) {
  const locked = !href
  const row = (
    <div
      className={cn(
        "flex h-[34px] items-center gap-2.5 rounded-lg px-3 transition-all duration-150",
        active
          ? "bg-secondary text-[#dafc69]"
          : locked
            ? "text-text-3 cursor-not-allowed"
            : "text-foreground hover:bg-foreground/[0.05] hover:text-foreground",
      )}
      title={locked ? "Próximamente" : undefined}
    >
      <Icon className="h-[14px] w-[14px] shrink-0" />
      <span className={cn("flex-1 text-[14px] leading-none", active && "font-semibold")}>{label}</span>
      {locked && <Lock className="h-3 w-3 text-text-3" />}
    </div>
  )
  if (!href) return row
  return <Link href={href}>{row}</Link>
}

export function CrmShell({
  children, clientName, readOnly,
}: { children: React.ReactNode; clientName?: string | null; readOnly?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {open && <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-[240px] transition-transform duration-200 ease-in-out lg:translate-x-0",
          "bg-card flex flex-col overflow-hidden border-r border-foreground/[0.07]",
          "lg:left-4 lg:top-4 lg:bottom-4 lg:h-auto lg:rounded-2xl lg:border lg:border-foreground/[0.08] lg:shadow-[0_10px_36px_-18px_rgba(0,0,0,0.30)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between pl-5 pr-3">
          <div className="flex items-center gap-2.5">
            <BrandLogo />
            <span className="rounded-full border border-accent/30 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-[#dafc69] leading-none">CRM</span>
          </div>
          <button className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-text-2 hover:text-foreground hover:bg-foreground/10 transition-all" onClick={() => setOpen(false)} aria-label="Cerrar menú">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-3">
          {GROUPS.map((g, gi) => (
            <div key={g.label ?? `g${gi}`} className={cn(gi > 0 && "mt-6")}>
              {g.label && <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-3">{g.label}</p>}
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <NavRow key={item.label} {...item} active={!!item.href && item.href === pathname} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 p-3">
          <Link href="/dashboard" onClick={() => setOpen(false)}>
            <div className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-foreground/[0.05] hover:text-foreground transition-all duration-150">
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-[14px] font-medium">Volver al panel externo</span>
            </div>
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden lg:ml-[272px] lg:pt-4">
        {readOnly && (
          <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-100 dark:bg-amber-500/10 px-5 py-2.5 text-[13px] text-amber-800 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>Estás viendo el CRM de <b>{clientName ?? "este cliente"}</b> — solo lectura, no podés cargar ni mover nada.</span>
          </div>
        )}

        <header className="flex h-14 shrink-0 items-center gap-3 px-5 border-b border-foreground/[0.07] lg:hidden">
          <button onClick={() => setOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-2 hover:bg-foreground/[0.05]" aria-label="Abrir menú">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-[13px] font-semibold text-foreground">CRM interno</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-background">{children}</main>
      </div>
    </div>
  )
}
