"use client"

import type React from "react"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { ChevronDown, LogOut, Menu, User, ShieldCheck, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MonthSelector } from "@/components/layout/month-selector"
import { Sidebar } from "@/components/layout/sidebar"
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { AnnualMetricsProvider } from "@/contexts/annual-metrics-context"
import { NavigationProgress } from "@/components/ui/navigation-progress"
import { HelpChat } from "@/components/ui/help-chat"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { isSetter, isTeam, SETTER_DEFAULT_LANDING, TEAM_DEFAULT_LANDING } from "@/lib/auth/permissions"

declare global {
  interface Window {
    __DEBUG_DASHBOARD_CTX?: {
      activeClientId: string | null
      ownClientId: string | null
      userRole: string | null
      userEmail: string | null
    }
  }
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Performance Center",
  "/channels": "Channels",
  "/sales": "Sales",
  "/reflection": "Reflection",
  "/metrics": "All Metrics",
  "/audit": "Audit",
  "/program-checklist": "Program Journey Checklist",
  "/market-intelligence": "Competitor Research",
  "/content-research": "Competitor Research",
  "/competitor-research": "Competitor Research",
  "/video-feed": "Video Feed",
  "/tools": "Tools",
  "/calendar": "Agenda",
  "/mi-dashboard": "MI Dashboard",
  "/monday-win": "Monday Win",
  "/report-input": "Reporte Mensual",
  "/report-history": "Historial de Reportes",
  "/chi-chang": "Cha-Ching 💰",
  "/transcript": "Transcript de Videos",
  "/recursos":   "Biblioteca",
  "/admin/data":         "Adquisition Stats",
  "/admin/leads":        "Leads",
  "/admin/setting":      "Setting CRM",
  "/admin/prospeccion":  "Prospección",
  "/admin/payments":     "Pagos",
  "/admin/applications": "Aplicaciones",
  "/admin/team-applications": "Contratación",
  "/admin/clients":      "Clientes",
  "/admin/centro-operativo": "Centro Operativo",
}

const SelectedMonthContext = createContext<string | null>(null)

export function useSelectedMonth() {
  return useContext(SelectedMonthContext)
}

const ActiveClientContext = createContext<string | null>(null)

export function useActiveClient() {
  return useContext(ActiveClientContext)
}

const ActiveClientNameContext = createContext<string | null>(null)

export function useActiveClientName() {
  return useContext(ActiveClientNameContext)
}

const OwnClientContext = createContext<string | null>(null)

/** El client_id propio del usuario logueado (independiente del activeClient).
 *  Para admins puede diferir; para clientes coincide con activeClient. */
export function useOwnClient() {
  return useContext(OwnClientContext)
}

function getRoleFromAccessToken(token: string | null | undefined): string | null {
  if (!token) return null
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    const appRole = json?.app_metadata?.role
    const userRole = json?.user_metadata?.role
    return (appRole ?? userRole ?? null) as string | null
  } catch {
    return null
  }
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>("2025-12")
  const pathname = usePathname()
  const pageTitle = PAGE_TITLES[pathname] ?? "Smart Scale"
  const isAdminMode = pathname.startsWith("/admin/")

  // Sidebar collapsed state persisted en localStorage (solo aplica en desktop)
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem("sidebarCollapsed")
    if (stored) setSidebarCollapsed(stored === "true")
  }, [])

  // Setter / team que aterrizan en /dashboard (portal cliente) caen a su landing
  // de admin: setter → /admin/setting, team → /admin/leads. Admin queda en /dashboard
  // como portal "modo cliente" para revisar; cliente final también.

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      if (typeof window !== "undefined") window.localStorage.setItem("sidebarCollapsed", String(next))
      return next
    })
  }

  // Keyboard shortcut: Cmd/Ctrl + \ para toggle del sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable
      if (isInput) return
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault()
        toggleSidebarCollapsed()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Hydration-safe: load persisted selectedMonth after mount
  useEffect(() => {
    const stored = window.localStorage.getItem("selectedMonth")
    if (stored) setSelectedMonth(stored)
  }, [])
  const [enabledMonths, setEnabledMonths] = useState<string[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [ownClientId, setOwnClientId] = useState<string | null>(null)
  const [clientDisplayName, setClientDisplayName] = useState<string | null>(null)
  const [activeClientId, setActiveClientId] = useState<string | null>(null)
  const [profilesList, setProfilesList] = useState<
    Array<{ id: string; client_id: string; role: string | null; client_name: string }>
  >([])
  const isAdmin = (userRole ?? "").toLowerCase() === "admin"
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Redirect setter / team que aterrizan en el portal cliente a su landing de admin.
  useEffect(() => {
    if (userRole == null) return
    if (isAdminMode) return
    if (isSetter(userRole)) router.replace(SETTER_DEFAULT_LANDING)
    else if (isTeam(userRole)) router.replace(TEAM_DEFAULT_LANDING)
  }, [userRole, isAdminMode, router])

  useEffect(() => {
    let mounted = true

    const loadEnabledMonths = async () => {
      try {
        // const supabase = createClient()

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser()

        if (userErr) throw userErr
        if (!user) return

        const clientId = activeClientId
        if (!clientId) return

        const { data: rows, error: rErr } = await supabase
          .from("monthly_reports")
          .select("month")
          .eq("client_id", clientId)
          .order("month", { ascending: true })

        if (rErr) throw rErr

        const months = Array.from(
          new Set(
            (rows ?? [])
              .map((r: any) => {
                const raw = r?.month
                const s = raw instanceof Date ? raw.toISOString() : String(raw ?? "")
                return s.slice(0, 7) // YYYY-MM
              })
              .filter((m: string) => /^\d{4}-\d{2}$/.test(m))
          )
        ).sort()

        if (!mounted) return

        setEnabledMonths(months)

        // If the current selected month isn't available but we have data, jump to the latest available.
        if (months.length) {
          setSelectedMonth((prev) => {
            const next = months.includes(prev) ? prev : months[months.length - 1]
            if (typeof window !== "undefined") window.localStorage.setItem("selectedMonth", next)
            return next
          })
        }
      } catch (err) {
        console.error("Failed to load enabled months", err)
        if (mounted) setEnabledMonths([])
      }
    }

    loadEnabledMonths()

    return () => {
      mounted = false
    }
  }, [activeClientId])

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace("/login")
        return
      }

      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })

      const jwtRole = getRoleFromAccessToken(session.access_token)

      const { data, error } = await supabase.auth.getUser()

      if (!error && data?.user?.email) {
        setUserEmail(data.user.email)
      }

      if (error || !data?.user) {
        await supabase.auth.signOut()
        router.replace("/login")
        return
      }

      const userId = data.user.id

      // Load profile role + client_id
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("client_id, role, name")
        .eq("id", userId)
        .maybeSingle()

      if (!profErr && prof) {
        const cid = (prof as any)?.client_id as string | undefined
        const role = (prof as any)?.role as string | undefined
        const profName = (prof as any)?.name as string | undefined
        setOwnClientId(cid ?? null)
        setUserRole(role ?? jwtRole ?? null)

        // For non-admin users, load their display name from clients.nombre
        const isClientRole = String(role ?? "").toLowerCase() !== "admin"
        if (isClientRole && cid) {
          // Try profile name first, then fall back to clients.nombre
          if (profName) {
            setClientDisplayName(profName)
          } else {
            const { data: clientRow } = await supabase
              .from("clients")
              .select("nombre")
              .eq("id", cid)
              .maybeSingle()
            if (clientRow?.nombre) setClientDisplayName(clientRow.nombre)
          }
        }

        // Initialize active client.
        //  - admin: stored override → su propio cid → null
        //  - team / setter: su propio cid → fallback al cid del admin (Ann)
        //  - cliente: su propio cid
        const normalizedRole = String(role ?? "").toLowerCase()
        const stored = typeof window !== "undefined" ? window.localStorage.getItem("activeClientId") : null

        let nextActive: string | null = null
        if (normalizedRole === "admin") {
          nextActive = stored ?? cid ?? null
        } else if (normalizedRole === "team" || normalizedRole === "setter") {
          // Setter/team siempre miran el CRM del admin (Ann). Si no tienen client_id propio,
          // resolvemos el client_id del primer admin como fallback.
          if (cid) {
            nextActive = cid
          } else {
            const { data: adminProfile } = await supabase
              .from("profiles")
              .select("client_id")
              .eq("role", "admin")
              .not("client_id", "is", null)
              .limit(1)
              .maybeSingle()
            nextActive = (adminProfile as any)?.client_id ?? null
          }
        } else {
          nextActive = cid ?? null
        }
        setActiveClientId(nextActive)
      } else {
        // Silent fallback: profile couldn't be loaded (RLS/missing row/etc.)
        setOwnClientId(null)
        setUserRole(jwtRole ?? null)
        setActiveClientId(null)
      }
    }

    checkSession()
  }, [router])

  useEffect(() => {
    let alive = true

    async function loadProfilesForAdmin() {
      try {
        if (!isAdmin) {
          if (alive) setProfilesList([])
          return
        }

        // const supabase = createClient()
        const { data, error } = await supabase
          .from("profiles")
          .select("id, client_id, role, name")
          .order("id", { ascending: false })

        if (error) throw error

        const list = (data ?? []) as any[]
        if (alive) {
          const nextProfiles = list.map((p: any) => ({
            id: String(p.id),
            client_id: p?.client_id ? String(p.client_id) : "",
            role: p.role ?? null,
            client_name: p?.name
              ? String(p.name)
              : p?.client_id
                ? "Cliente " + String(p.client_id).slice(0, 8)
                : "Perfil sin cliente"
          }))

          setProfilesList(nextProfiles)
          ensureAdminActiveClient(nextProfiles)
        }
      } catch (e) {
        const err: any = e
        console.error("Failed to load profiles list", {
          message: err?.message,
          code: err?.code,
          details: err?.details,
          hint: err?.hint,
          raw: err,
        })
        if (alive) setProfilesList([])
      }
    }

    function ensureAdminActiveClient(nextProfiles: Array<{ id: string; client_id: string; role: string | null; client_name: string }>) {
      if (!isAdmin) return
      if (activeClientId) return

      const firstValid = nextProfiles.find((p) => Boolean(p.client_id))
      if (!firstValid?.client_id) return

      setActiveClientId(firstValid.client_id)
      if (typeof window !== "undefined") {
        window.localStorage.setItem("activeClientId", firstValid.client_id)
      }
    }

    loadProfilesForAdmin()
    return () => {
      alive = false
    }
  }, [isAdmin, activeClientId])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false)
    }

    const onMouseDown = (e: MouseEvent) => {
      const el = profileMenuRef.current
      if (!el) return
      if (!el.contains(e.target as Node)) setProfileMenuOpen(false)
    }

    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("mousedown", onMouseDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("mousedown", onMouseDown)
    }
  }, [])

  const activeClientName = useMemo(() => {
    if (!activeClientId) return null
    const match = profilesList.find(p => p.client_id === activeClientId)
    return match?.client_name ?? null
  }, [activeClientId, profilesList])

  // Debug visual para el contexto de cliente
  // Puedes eliminar esto luego
  if (typeof window !== "undefined") {
    window.__DEBUG_DASHBOARD_CTX = {
      activeClientId,
      ownClientId,
      userRole,
      userEmail,
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <NavigationProgress />
      {isAdminMode
        ? <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebarCollapsed} />
        : <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={isAdmin} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebarCollapsed} />}

      <div className={`flex-1 flex flex-col h-full overflow-hidden transition-[margin] duration-200 bg-background ${sidebarCollapsed ? 'lg:ml-[64px]' : 'lg:ml-[220px]'}`}>
        <header className="shrink-0 z-10 border-b border-foreground/[0.08] bg-background/95 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-3">
              {!sidebarOpen && (
                <Button variant="ghost" size="icon" className="lg:hidden text-foreground/60 hover:text-foreground" onClick={() => setSidebarOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div>
                <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight tracking-tight flex items-center gap-2">
                  {pageTitle}
                  {isAdminMode && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#ffde21]/30 bg-[#ffde21]/[0.08] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#ffde21]">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Internal
                    </span>
                  )}
                </h1>
                <p className="hidden sm:block text-[10px] text-foreground/35 leading-none mt-0.5 tracking-wide">
                  {isAdminMode ? "Smart Scale Internal · Dashboard de Admin" : "Smart Scale Portal 2.0"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isAdminMode && (
                <>
                  <Button
                    asChild
                    size="sm"
                    className="hidden sm:inline-flex bg-[#ffde21] text-black font-semibold hover:bg-[#ffe84d] border-0 text-xs px-3 h-8"
                    title="Monday Win"
                  >
                    <a href="/monday-win">Monday Win</a>
                  </Button>

                  <Button
                    asChild
                    size="sm"
                    className="hidden sm:inline-flex bg-[#ffde21] text-black font-semibold hover:bg-[#ffe84d] border-0 text-xs px-3 h-8"
                    title="Reporte Mensual"
                  >
                    <a href="/report-input">Reporte Mensual</a>
                  </Button>

                  <Button
                    asChild
                    size="sm"
                    className="hidden sm:inline-flex bg-[#ffde21] text-black font-semibold hover:bg-[#ffe84d] border-0 text-xs px-3 h-8 gap-1.5"
                    title="Cha-Ching"
                  >
                    <a href="/chi-chang">
                      <span className="text-[13px]">💰</span>
                      Cha-Ching
                    </a>
                  </Button>

                  <MonthSelector
                    value={selectedMonth}
                    onChange={(m) => {
                      setSelectedMonth(m)
                      if (typeof window !== "undefined") window.localStorage.setItem("selectedMonth", m)
                    }}
                    enabledMonths={enabledMonths}
                  />
                </>
              )}

              <ThemeToggle />

              <div className="relative" ref={profileMenuRef}>
                <Button
                  variant="outline"
                  className="gap-2 text-emerald-400 hover:text-emerald-300 border-emerald-400/30 hover:bg-emerald-400/10"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  title={
                    activeClientName
                      ? `Cliente: ${activeClientName}`
                      : clientDisplayName
                        ? `Hola, ${clientDisplayName}`
                        : userEmail
                          ? `Cuenta: ${userEmail}`
                          : "Perfil"
                  }
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#ffde21]/40 bg-[#ffde21]/10">
                    <User className="h-4 w-4 text-[#ffde21]" />
                  </span>
                  <span className="hidden sm:inline text-foreground font-semibold">
                    {activeClientName ?? clientDisplayName ?? userEmail ?? "—"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-80 text-[#ffde21]" />
                </Button>

                {profileMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Perfil"
                    className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl backdrop-blur"
                  >
                    {/* Header — current user */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-foreground/[0.02]">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ffde21]/40 bg-[#ffde21]/10 text-[#ffde21] text-[13px] font-bold">
                        {(clientDisplayName ?? userEmail ?? "?").charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        {clientDisplayName && !isAdmin && (
                          <p className="truncate text-sm font-semibold text-foreground">{clientDisplayName}</p>
                        )}
                        <p className="truncate text-[11px] text-foreground/50">{userEmail ?? "—"}</p>
                      </div>
                    </div>

                    {isAdmin ? (
                      <>
                        <div className="px-4 pt-3 pb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">Cambiar perfil</p>
                        </div>
                        <div className="max-h-72 overflow-auto pb-1.5 px-1.5">
                          {profilesList.length ? (
                            profilesList.map((p) => {
                              const isSelectable = Boolean(p.client_id)
                              const isActive = Boolean(p.client_id) && activeClientId === p.client_id
                              const initial = (p.client_name ?? "?").charAt(0).toUpperCase()
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  role="menuitem"
                                  className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                                    isActive
                                      ? "bg-[#ffde21]/15 text-foreground"
                                      : "text-foreground hover:bg-foreground/[0.06]"
                                  } ${!isSelectable ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""}`}
                                  disabled={!isSelectable}
                                  onClick={() => {
                                    if (!p.client_id) return
                                    setActiveClientId(p.client_id)
                                    if (typeof window !== "undefined") window.localStorage.setItem("activeClientId", p.client_id)
                                    setProfileMenuOpen(false)
                                  }}
                                  title={p.client_id}
                                >
                                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                    isActive
                                      ? "bg-[#ffde21] text-black"
                                      : "bg-foreground/[0.08] text-foreground/70"
                                  }`}>
                                    {initial}
                                  </span>
                                  <span className="truncate flex-1 font-medium">{p.client_name}</span>
                                  {isActive && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                      Activo
                                    </span>
                                  )}
                                </button>
                              )
                            })
                          ) : (
                            <div className="px-3 py-3 text-sm text-foreground/60">No hay perfiles para mostrar.</div>
                          )}
                        </div>
                      </>
                    ) : null}

                    <div className="h-px bg-foreground/[0.07]" />

                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-foreground/80 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-300 transition-colors"
                      onClick={async () => {
                        await supabase.auth.signOut()
                        setProfileMenuOpen(false)
                        router.replace("/login")
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <ActiveClientContext.Provider value={activeClientId}>
          <ActiveClientNameContext.Provider value={activeClientName}>
            <OwnClientContext.Provider value={ownClientId}>
              <AnnualMetricsProvider>
                <SelectedMonthContext.Provider value={selectedMonth}>
                  <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-background">{children}</main>
                </SelectedMonthContext.Provider>
              </AnnualMetricsProvider>
            </OwnClientContext.Provider>
          </ActiveClientNameContext.Provider>
        </ActiveClientContext.Provider>
      </div>

      {/* AI Help Chat — botón flotante visible en todas las páginas del dashboard */}
      <HelpChat />
    </div>
  )
}
