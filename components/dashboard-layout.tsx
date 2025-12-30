"use client"

import type React from "react"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import { ChevronDown, LogOut, Menu, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MonthSelector } from "@/components/month-selector"
import { Sidebar } from "@/components/sidebar"

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

  // Hydration-safe: load persisted selectedMonth after mount
  useEffect(() => {
    const stored = window.localStorage.getItem("selectedMonth")
    if (stored) setSelectedMonth(stored)
  }, [])
  const [enabledMonths, setEnabledMonths] = useState<string[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [ownClientId, setOwnClientId] = useState<string | null>(null)
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
        .select("client_id, role")
        .eq("id", userId)
        .maybeSingle()

      if (!profErr && prof) {
        const cid = (prof as any)?.client_id as string | undefined
        const role = (prof as any)?.role as string | undefined
        setOwnClientId(cid ?? null)
        setUserRole(role ?? jwtRole ?? null)

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
        if (alive)
          setProfilesList(
            list.map((p: any) => ({
              id: String(p.id),
              client_id: p?.client_id ? String(p.client_id) : "",
              role: p.role ?? null,
              client_name: p?.name
                ? String(p.name)
                : p?.client_id
                  ? "Cliente " + String(p.client_id).slice(0, 8)
                  : "Perfil sin cliente"
            }))
          )
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

    loadProfilesForAdmin()
    return () => {
      alive = false
    }
  }, [isAdmin])

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

  return (
    <div className="flex min-h-screen bg-background dark">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center justify-between px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-semibold text-foreground">Monthly Performance</h1>
            </div>
            <div className="flex items-center gap-3">
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
                  className="gap-2 text-white hover:text-white border-white/20 hover:bg-white/10"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  title={userEmail ? `Cuenta: ${userEmail}` : "Perfil"}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/5">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="hidden sm:inline">Perfil</span>
                  <ChevronDown className="h-4 w-4 opacity-80" />
                </Button>

                {profileMenuOpen ? (
                  <div
                    role="menu"
                    aria-label="Perfil"
                    className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-black/80 text-white shadow-lg backdrop-blur"
                  >
                    <div className="px-3 py-2">
                      <p className="text-xs text-white/60">Cuenta</p>
                      <p className="truncate text-sm font-medium text-white">{userEmail ?? "—"}</p>
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
                                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-white hover:bg-white/10 ${isActive ? "bg-white/10" : ""} ${!isSelectable ? "opacity-50 cursor-not-allowed hover:bg-transparent" : ""}`}
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
                                  {isActive ? <span className="text-xs text-white/60">Activo</span> : null}
                                </button>
                              )
                            })
                          ) : (
                            <div className="px-3 py-2 text-sm text-white/60">
                              No hay perfiles para mostrar.
                            </div>
                          )}
                        </div>
                        <div className="h-px bg-white/10" />
                      </>
                    ) : null}

                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-white/10"
                      onClick={async () => {
                        // const supabase = createClient()
                        await supabase.auth.signOut()
                        setProfileMenuOpen(false)
                        router.replace("/login")
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <ActiveClientContext.Provider value={activeClientId}>
          <SelectedMonthContext.Provider value={selectedMonth}>
            <main className="flex-1 p-4 lg:p-8">{children}</main>
          </SelectedMonthContext.Provider>
        </ActiveClientContext.Provider>
      </div>
    </div>
  )
}
