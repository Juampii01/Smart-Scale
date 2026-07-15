"use client"

import {
  X, BarChart3, MessageSquare, CalendarDays, LayoutGrid,
  ClipboardList, Zap, Globe, FileVideo, ChevronDown,
  ShieldCheck, ArrowRight, Sparkles, Instagram, Youtube,
  User, Pencil, Trophy, Coins, FileBarChart, TrendingUp,
  Brain, Bot, Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { BrandLogo } from "@/components/theme/brand-logo"

interface SidebarProps {
  open: boolean
  onClose: () => void
  isAdmin?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  avatarUrl?: string | null
  displayName?: string | null
  email?: string | null
}

type ChildItem = { name: string; href: string }
type NavItem = {
  name: string
  href: string
  icon: React.ElementType
  children?: ChildItem[]
}
// label opcional: undefined = sección sin título (la primera)
type NavGroup = { label?: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { name: "Overview",    href: "/dashboard",   icon: BarChart3     },
      { name: "Performance", href: "/performance", icon: TrendingUp    },
      { name: "Reflection",  href: "/reflection",  icon: MessageSquare },
      { name: "All Metrics", href: "/metrics",     icon: LayoutGrid    },
      {
        name: "YouTube", href: "/mi-youtube", icon: Youtube,
        children: [
          { name: "My Channel",  href: "/mi-youtube"           },
          { name: "Competitors", href: "/youtube/competitors"  },
          { name: "Vault",       href: "/youtube/vault"        },
          { name: "Ideas",       href: "/youtube/ideas"        },
        ],
      },
      {
        name: "Instagram", href: "/mi-instagram", icon: Instagram,
        children: [
          { name: "My Profile",  href: "/mi-instagram"          },
          { name: "Competitors", href: "/instagram/competitors"  },
          { name: "Vault",       href: "/instagram/vault"        },
          { name: "Ideas",       href: "/instagram/ideas"        },
        ],
      },
      { name: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Reportes",
    items: [
      { name: "Monday Win",      href: "/monday-win",   icon: Trophy       },
      { name: "Cha-Ching 💰",    href: "/chi-chang",    icon: Coins        },
      { name: "Reporte Mensual", href: "/report-input", icon: FileBarChart },
    ],
  },
  {
    label: "Performance Tools",
    items: [
      {
        name: "Content Tools", href: "/competitor-research", icon: Wrench,
        children: [
          { name: "Competitor Research", href: "/competitor-research" },
          { name: "Transcriptions",      href: "/transcript"          },
        ],
      },
      { name: "Implementation",   href: "/program-checklist", icon: Zap           },
      { name: "Performance Audit", href: "/audit",            icon: ClipboardList },
    ],
  },
  {
    label: "Scalekit",
    items: [
      { name: "Ann AI",        href: "/anai",          icon: Brain    },
      { name: "Claude Skills", href: "/claude-skills", icon: Sparkles },
      { name: "GPTs",          href: "/tools",         icon: Bot      },
    ],
  },
]

const LS_ITEMS = "ss_sidebar_items"

export function Sidebar({
  open, onClose, isAdmin = false,
  avatarUrl, displayName, email,
}: SidebarProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const i = localStorage.getItem(LS_ITEMS)
      if (i) setExpandedItems(JSON.parse(i))
    } catch {}
  }, [])

  const toggleItem = (name: string) => {
    setExpandedItems(prev => {
      const next = { ...prev, [name]: !prev[name] }
      try { localStorage.setItem(LS_ITEMS, JSON.stringify(next)) } catch {}
      return next
    })
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
          "fixed left-0 top-0 z-50 h-full w-[220px] transition-transform duration-200 ease-in-out lg:translate-x-0",
          "bg-card flex flex-col pt-[env(safe-area-inset-top)] overflow-hidden",
          "border-r border-foreground/[0.07]",
          "lg:left-4 lg:top-4 lg:bottom-4 lg:h-auto lg:rounded-2xl lg:border lg:border-foreground/[0.08] lg:shadow-[0_10px_36px_-18px_rgba(0,0,0,0.30)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo (sin línea divisoria) */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between pl-5 pr-3">
          <a href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <BrandLogo />
            <span className="self-start rounded-full bg-[#dafc69] px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#0a0a0a] leading-none">3.0</span>
          </a>
          <button
            className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-all"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-3">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label ?? `g${gi}`} className={cn(gi > 0 && "mt-6")}>
              {/* Section label — estático, no colapsable */}
              {group.label && (
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/35">
                  {group.label}
                </p>
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const hasChildren    = !!item.children?.length
                  const isItemExpanded = expandedItems[item.name] ?? false
                  const isActive       = pathname === item.href
                  const hasActiveChild = item.children?.some(c => pathname === c.href) ?? false

                  // ── Item colapsable (solo Instagram / YouTube / Content Tools) ──
                  if (hasChildren) {
                    return (
                      <div key={item.name}>
                        <button
                          onClick={() => toggleItem(item.name)}
                          className={cn(
                            "w-full flex items-center gap-2.5 rounded-lg py-[7px] px-3 transition-all duration-150",
                            (isItemExpanded || hasActiveChild)
                              ? "text-foreground"
                              : "text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-[14px] w-[14px] flex-shrink-0" />
                          <span className={cn("text-[13px] leading-none flex-1 text-left", (isItemExpanded || hasActiveChild) ? "font-semibold" : "font-medium")}>
                            {item.name}
                          </span>
                          <ChevronDown className={cn("h-3 w-3 text-foreground/30 transition-transform duration-200", isItemExpanded && "rotate-180")} />
                        </button>

                        {/* Sub-items — indentación sin línea */}
                        {isItemExpanded && (
                          <div className="mt-0.5 ml-[28px] space-y-0.5 pb-1">
                            {item.children!.map(child => (
                              <Link key={child.href} href={child.href} onClick={onClose}>
                                <div className={cn(
                                  "py-1.5 px-2 rounded-md text-[12px] transition-colors duration-150",
                                  pathname === child.href
                                    ? "text-[#dafc69] font-semibold"
                                    : "text-foreground/50 hover:text-foreground/90 hover:bg-foreground/[0.04]"
                                )}>
                                  {child.name}
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  // ── Item normal ──
                  return (
                    <Link key={item.name} href={item.href} onClick={onClose}>
                      <div className={cn(
                        "flex items-center gap-2.5 rounded-lg py-[7px] px-3 transition-all duration-150",
                        isActive
                          ? "bg-foreground/[0.07] text-[#dafc69]"
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
            </div>
          ))}
        </nav>

        {/* Footer — sin línea divisoria */}
        <div className="flex-shrink-0 p-3 space-y-1.5">
          {isAdmin && (
            <Link href="/admin/clients" onClick={onClose}>
              <div className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground transition-all duration-150">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-[13px] font-medium">Panel interno</span>
                <ArrowRight className="h-3.5 w-3.5 text-foreground/30 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          )}

          {hasProfile && (
            <Link
              href="/perfil"
              onClick={onClose}
              title="Context Room"
              className={cn(
                "group/profile flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-all duration-150",
                pathname === "/perfil"
                  ? "border-[#dafc69]/30 bg-[#dafc69]/[0.08]"
                  : "border-foreground/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.05]"
              )}
            >
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dafc69]/40 bg-[#dafc69]/10 text-[13px] font-bold text-[#dafc69]">
                {avatarUrl
                  ? <img src={avatarUrl} alt="Perfil" className="h-full w-full object-cover" />
                  : <User className="h-4 w-4 text-[#dafc69]" />}
                <span className={cn(
                  "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#dafc69] ring-2 ring-card",
                  avatarUrl && "opacity-0 group-hover/profile:opacity-100 transition-opacity"
                )}>
                  <Pencil className="h-2.5 w-2.5 text-black" />
                </span>
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-semibold text-foreground">{profileLabel}</span>
                <span className="block truncate text-[11px] text-foreground/45">Context Room</span>
              </span>
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}
