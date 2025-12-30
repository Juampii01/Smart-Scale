"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabaseClient"
import { useSelectedMonth, useActiveClient } from "@/components/dashboard-layout"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Target, Wrench } from "lucide-react"

type ReflectionReport = Record<string, any>

function pickString(row: any, keys: string[]) {
  if (!row) return null

  // 1) Exact key matches (preferred)
  for (const k of keys) {
    const v = row?.[k]
    if (typeof v === "string" && v.trim().length) return v
  }

  // 2) Fallback: try to find a string field whose key includes one of the key tokens
  //    (e.g. focus_next_month vs next_month_focus vs monthly_focus, etc.)
  const loweredTokens = keys.map((k) => k.toLowerCase())
  for (const [k, v] of Object.entries(row)) {
    if (typeof v !== "string") continue
    const kk = k.toLowerCase()
    if (loweredTokens.some((t) => kk.includes(t))) {
      const s = v.trim()
      if (s.length) return s
    }
  }

  // 3) Last resort: any non-empty reflection-ish text
  for (const [k, v] of Object.entries(row)) {
    if (typeof v !== "string") continue
    const kk = k.toLowerCase()
    if (kk.includes("reflection") || kk.includes("win") || kk.includes("focus") || kk.includes("support") || kk.includes("lesson") || kk.includes("improve") || kk.includes("feedback")) {
      const s = v.trim()
      if (s.length) return s
    }
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

  const monthValue = useMemo(() => {
    if (/^\d{4}-\d{2}$/.test(selectedMonth)) return `${selectedMonth}-01`
    return selectedMonth
  }, [selectedMonth])

  useEffect(() => {
    let mounted = true

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
        if (!clientId) throw new Error("No hay cliente activo seleccionado")

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

  const reflections = useMemo(
    () => [
      {
        icon: Trophy,
        title: "Mayor logro del mes",
        content: pickString(data, [
          "reflection_win",
          "biggest_win",
          "win",
          "monthly_win",
          "win_of_the_month",
        ]),
        color: "text-emerald-500",
      },
      {
        icon: Target,
        title: "Enfoque principal del próximo mes",
        content: pickString(data, ["next_focus"]),
        color: "text-chart-1",
      },
      {
        icon: Wrench,
        title: "Soporte y sistemas necesarios",
        content: pickString(data, [
          "reflection_support",
          "support_needed",
          "systems_needed",
          "support_systems",
          "monthly_support",
        ]),
        color: "text-chart-2",
      },
      {
        icon: Wrench,
        title: "Mejoras y feedback",
        content: pickString(data, [
          "reflection_improvements",
          "improvements",
          "feedback",
          "reflection_feedback",
          "monthly_feedback",
        ]),
        color: "text-chart-2",
      },
    ],
    [data]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reflexión estratégica</h1>
        <p className="mt-1 text-sm text-muted-foreground">Insights del mes y dirección estratégica</p>
        <p className="mt-1 text-xs text-white/50">Mes seleccionado: {selectedMonth}</p>
      </div>

      {loading && <p className="text-white/60">Cargando reflexión del mes…</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && !error && !data && (
        <p className="text-white/60">No hay reflexión cargada para este mes.</p>
      )}

      <div className="space-y-4">
        {reflections.map((item) => {
          const Icon = item.icon
          return (
            <Card
              key={item.title}
              className="border-border bg-card transition-all duration-200 hover:border-muted-foreground/50 hover:shadow-lg hover:shadow-primary/5"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-base font-medium">
                  <div className={cn("rounded-lg bg-muted p-2", item.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  {item.content || "—"}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
