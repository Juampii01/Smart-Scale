"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useSelectedMonth, useActiveClient } from "@/components/layout/dashboard-layout"
import { useMarkPageReady } from "@/hooks/use-mark-page-ready"
import { useMinLoading } from "@/hooks/use-min-loading"
import { ReflectionCardSkeleton, SectionHeaderSkeleton } from "@/components/ui/skeleton"
import { Trophy, Target, Wrench, Star } from "lucide-react"

type ReflectionReport = Record<string, any>

function pickString(row: any, keys: string[]) {
  if (!row) return null
  for (const k of keys) {
    const v = row?.[k]
    if (typeof v === "string" && v.trim().length) return v
  }
  return null
}

function pickNumber(row: any, keys: string[]) {
  if (!row) return null
  for (const k of keys) {
    const v = row?.[k]
    if (typeof v === "number" && !Number.isNaN(v)) return v
    if (typeof v === "string" && v.trim().length) {
      const n = Number(v)
      if (!Number.isNaN(n)) return n
    }
  }
  return null
}

export function ReflectionView() {
  const ctxMonth = useSelectedMonth()
  const activeClientId = useActiveClient()
  const [error, setError] = useState<string | null>(null)

  const [mountedUI, setMountedUI] = useState(false)

  useEffect(() => {
    setMountedUI(true)
  }, [])

  const selectedMonth = mountedUI ? (ctxMonth ?? "2025-12") : "2025-12"

  const [data, setData] = useState<ReflectionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const showSkeleton = useMinLoading(loading)
  useMarkPageReady(!showSkeleton)

  const monthValue = useMemo(() => {
    if (/^\d{4}-\d{2}$/.test(selectedMonth)) return `${selectedMonth}-01`
    return selectedMonth
  }, [selectedMonth])

  useEffect(() => {
    let mounted = true
    if (!activeClientId) {
      setLoading(true)
      setData(null)
      return () => { mounted = false }
    }
    async function load() {
      try {
        if (mounted) {
          setLoading(true)
          setError(null)
        }
        const supabase = createClient()
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!user) throw new Error("No session")
        const clientId = activeClientId
        if (!clientId) return
        const { data: report, error: rErr } = await supabase
          .from("monthly_reports")
          .select("*")
          .eq("client_id", clientId)
          .eq("month", monthValue)
          .maybeSingle()
        if (rErr) throw rErr
        if (mounted) {
          setData((report ?? null) as ReflectionReport | null)
          setLoading(false)
        }
      } catch (e: any) {
        if (mounted) {
          setData(null)
          setLoading(false)
          setError(e?.message ?? "Error cargando reflexión estratégica")
        }
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [monthValue, activeClientId])

  const nps = pickNumber(data, ["nps_score"])

  const reflections = useMemo(
  () => [
    {
      icon: Trophy,
      title: "Mayor logro del mes",
      content: pickString(data, ["biggest_win"]),
      numeric: null as number | null,
    },
    {
      icon: Target,
      title: "Enfoque principal del próximo mes",
      content: pickString(data, ["next_focus"]),
      numeric: null as number | null,
    },
    {
      icon: Wrench,
      title: "Soporte y sistemas necesarios",
      content: pickString(data, ["support_needed"]),
      numeric: null as number | null,
    },
    {
      icon: Wrench,
      title: "Mejoras y feedback",
      content: pickString(data, ["improvements"]),
      numeric: null as number | null,
    },
    {
      icon: Star,
      title: "NPS Score",
      content: null as string | null,
      numeric: nps,
    },
  ],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [data, nps]
)

  if (showSkeleton) {
    return (
      <div className="space-y-6">
        <SectionHeaderSkeleton />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <ReflectionCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">Reflexión Estratégica</h1>
        </div>
        <p className="text-foreground/30 text-xs ml-[18px]">Insights del mes · {selectedMonth}</p>
      </div>

      {loading && <p className="text-foreground/40 text-sm">Cargando reflexión…</p>}
      {!loading && !error && !data && (
        <div className="rounded-2xl border border-dashed border-foreground/[0.08] bg-foreground/[0.02] px-6 py-10 text-center">
          <p className="text-sm text-foreground/40 mb-3">No hay reflexión cargada para este mes.</p>
          <a
            href="/report-input"
            className="inline-flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-[13px] font-bold text-black hover:bg-[#ffe46b] transition"
          >
            Cargar reporte mensual →
          </a>
        </div>
      )}

      {!loading && data && (
        <div className="grid gap-4 sm:grid-cols-2">
          {reflections.map((item) => {
            const Icon = item.icon
            const isEmpty = item.numeric === null && !item.content
            return (
              <div
                key={item.title}
                className="group relative overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card p-5 transition-all duration-200 hover:border-foreground/15"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.03),transparent_60%)]" />
                <div className="relative">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ffde21]/10 ring-1 ring-[#ffde21]/15">
                      <Icon className="h-4 w-4 text-[#ffde21]" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/35">{item.title}</p>
                  </div>
                  {item.numeric !== null ? (
                    <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${
                      item.numeric >= 50 ? "text-emerald-700 dark:text-emerald-400"
                      : item.numeric >= 0 ? "text-amber-700 dark:text-amber-400"
                      : "text-red-700 dark:text-red-400"
                    }`}>
                      {item.numeric > 0 ? `+${item.numeric}` : item.numeric}
                    </p>
                  ) : isEmpty ? (
                    <a href="/report-input" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#ffde21]/70 hover:text-[#ffde21] transition">
                      Agregar →
                    </a>
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground/60">
                      {item.content}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
