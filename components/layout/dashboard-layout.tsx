"use client"

import type React from "react"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { ChevronDown, LogOut, Menu, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MonthSelector } from "@/components/layout/month-selector"
import { Sidebar } from "@/components/layout/sidebar"
import { AnnualMetricsProvider } from "@/contexts/annual-metrics-context"
import { NavigationProgress } from "@/components/ui/navigation-progress"

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
  "/admin/data":         "Tabla de Datos",
  "/admin/leads":        "Leads",
  "/admin/payments":     "Pagos",
  "/admin/applications": "Aplicaciones",
  "/admin/clients":      "Clientes",
}

const SelectedMonthContext = createContext<string | null>(null)

export function useSelectedMonth() {
  return useContext(SelectedMonthContext)
}

const ActiveClientContext = createContext<string | null>(null)

export function useActiveClient() {
  return useContext(ActiveClientContext)
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
  const [selectedMonth, setSelectedMonth] = useState<string>("2025-12")
  const pathname = usePathname()
  const pageTitle = PAGE_TITLES[pathname] ?? "Smart Scale"

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

        // Initialize active client (admin can override via localStorage)
        const stored = typeof window !== "undefined" ? window.localStorage.getItem("activeClientId") : null
        const nextActive = (String(role ?? "").toLowerCase() === "admin" && stored) ? stored : (cid ?? null)
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
    <div className="flex h-screen overflow-hidden dark" style={{ backgroundColor: "#0a0a0b" }}>
      <NavigationProgress />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={isAdmin} />

      <div className="flex-1 flex flex-col lg:ml-[220px] h-full overflow-hidden" style={{ backgroundColor: "#0a0a0b" }}>
        <header className="shrink-0 z-10 border-b border-white/[0.08] backdrop-blur-md" style={{ backgroundColor: "rgba(10,10,11,0.95)" }}>
          <div className="flex h-16 items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white leading-tight tracking-tight">{pageTitle}</h1>
                <p className="hidden sm:block text-[10px] text-white/35 leading-none mt-0.5 tracking-wide">Smart Scale Portal 2.0</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
                  <span className="hidden sm:inline text-white font-semibold">
                    {activeClientName ?? clientDisplayName ?? userEmail ?? "—"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-80 text-[#ffde21]" />
                </Button>

                {profileMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Perfil"
                    className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-black/80 text-white shadow-lg backdrop-blur"
                  >
                    <div className="px-3 py-2">
                      {clientDisplayName && !isAdmin && (
                        <p className="truncate text-sm font-semibold text-white">{clientDisplayName}</p>
                      )}
                      <p className="text-xs text-white/40 truncate">{userEmail ?? "—"}</p>
                    </div>
                    <div className="h-px bg-white/10" />

                    {isAdmin ? (
                      <>
                        <div className="px-3 py-2">
                          <p className="text-xs text-white/60">Cambiar perfil</p>
                        </div>
                        <div className="max-h-64 overflow-auto">
                          {profilesList.length ? (
                            profilesList.map((p) => {
                              const isSelectable = Boolean(p.client_id)
                              const isActive = Boolean(p.client_id) && activeClientId === p.client_id
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  role="menuitem"
                                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-white hover:bg-[#ffde21]/10 ${isActive ? "bg-[#ffde21]/15" : ""} ${!isSelectable ? "opacity-50 cursor-not-allowed hover:bg-transparent" : ""}`}
                                  disabled={!isSelectable}
                                  onClick={() => {
                                    if (!p.client_id) return
                                    setActiveClientId(p.client_id)
                                    if (typeof window !== "undefined") window.localStorage.setItem("activeClientId", p.client_id)
                                    setProfileMenuOpen(false)
                                  }}
                                  title={p.client_id}
                                >
                                  <span className="truncate text-white">{p.client_name}</span>
                                  {isActive ? <span className="text-xs text-emerald-300/80">Activo</span> : null}
                                </button>
                              )
                            })
                          ) : (
                            <div className="px-3 py-2 text-sm text-white/60">No hay perfiles para mostrar.</div>
                          )}
                        </div>
                        <div className="h-px bg-white/10" />
                      </>
                    ) : null}

                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-emerald-400/10"
                      onClick={async () => {
                        await supabase.auth.signOut()
                        setProfileMenuOpen(false)
                        router.replace("/login")
                      }}
                    >
                      <LogOut className="h-4 w-4 text-[#ffde21]" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <ActiveClientContext.Provider value={activeClientId}>
          <AnnualMetricsProvider>
            <SelectedMonthContext.Provider value={selectedMonth}>
              <main className="flex-1 overflow-y-auto p-4 lg:p-8" style={{ backgroundColor: "#0a0a0b" }}>{children}</main>
            </SelectedMonthContext.Provider>
          </AnnualMetricsProvider>
        </ActiveClientContext.Provider>
      </div>
    </div>
  )
}
