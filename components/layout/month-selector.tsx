"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Calendar, Check } from "lucide-react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator,
} from "@/components/ui/select"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const MONTH_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]

/** YYYY-MM del mes actual del usuario. */
function currentMonthYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** "2026-05" → "Mayo 2026" */
function formatMonthLong(ym: string): string {
  const [y, m] = ym.split("-")
  const idx = Number(m) - 1
  if (!MONTH_NAMES[idx]) return ym
  return `${MONTH_NAMES[idx]} ${y}`
}

/** "2026-05" → "May '26" */
function formatMonthShort(ym: string): string {
  const [y, m] = ym.split("-")
  const idx = Number(m) - 1
  if (!MONTH_SHORT[idx]) return ym
  return `${MONTH_SHORT[idx]} '${y.slice(2)}`
}

function generateMonths(enabledMonths?: string[]) {
  const set = new Set<string>()
  // Siempre incluimos el mes actual + 2025-12 (legacy default)
  set.add(currentMonthYM())
  set.add("2025-12")

  const normalize = (s: any): string | null => {
    const str = String(s ?? "").trim()
    if (!str) return null
    const m1 = str.match(/^(\d{4})-(\d{2})/)
    if (m1) return `${m1[1]}-${m1[2]}`
    const m2 = str.match(/^(\d{4})-(\d{1,2})/)
    if (m2) return `${m2[1]}-${String(Number(m2[2])).padStart(2, "0")}`
    return null
  }

  if (Array.isArray(enabledMonths)) {
    for (const m of enabledMonths) {
      const norm = normalize(m)
      if (norm && /^\d{4}-\d{2}$/.test(norm)) set.add(norm)
    }
  }

  // Más reciente primero
  return Array.from(set).sort((a, b) => b.localeCompare(a))
}

/** Agrupa los meses por año para mostrar separadores en el dropdown. */
function groupByYear(months: string[]): { year: string; months: string[] }[] {
  const groups: Record<string, string[]> = {}
  for (const m of months) {
    const y = m.slice(0, 4)
    if (!groups[y]) groups[y] = []
    groups[y].push(m)
  }
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, ms]) => ({ year, months: ms }))
}

// ─── Component ────────────────────────────────────────────────────────────────

type MonthSelectorProps = {
  value?: string
  onChange?: (value: string) => void
  enabledMonths?: string[]
}

export function MonthSelector({ value, onChange, enabledMonths }: MonthSelectorProps) {
  const months = useMemo(() => generateMonths(enabledMonths), [enabledMonths])
  const groups = useMemo(() => groupByYear(months), [months])

  // Default = mes actual si está disponible, sino el más reciente
  const today = currentMonthYM()
  const defaultMonth = months.includes(today) ? today : (months[0] ?? today)

  // Local state para uso uncontrolled
  const [selectedMonth, setSelectedMonth] = useState<string>(value ?? defaultMonth)

  // Sync con parent
  useEffect(() => {
    if (typeof value === "string") setSelectedMonth(value)
  }, [value])

  const isToday = selectedMonth === today
  const todayAvailable = months.includes(today)

  return (
    <Select
      value={selectedMonth}
      onValueChange={(v) => {
        setSelectedMonth(v)
        onChange?.(v)
      }}
    >
      <SelectTrigger className="h-9 w-[120px] sm:w-[140px] gap-1.5 bg-foreground/5 text-foreground border-border text-xs sm:text-sm font-semibold">
        <Calendar className="h-3.5 w-3.5 text-foreground/50 shrink-0" />
        <SelectValue className="text-foreground">
          {formatMonthShort(selectedMonth)}
          {isToday && <span className="ml-1 text-[10px] font-bold text-[#ffde21]">·</span>}
        </SelectValue>
      </SelectTrigger>

      <SelectContent
        className="bg-popover text-popover-foreground border-border shadow-2xl max-h-[420px] min-w-[200px]"
        position="popper"
        sideOffset={6}
      >
        {/* Quick "Hoy" — solo si current month no es ya el seleccionado y está disponible */}
        {todayAvailable && !isToday && (
          <>
            <SelectItem
              value={today}
              className="text-foreground data-[highlighted]:bg-[#ffde21]/15 data-[highlighted]:text-foreground data-[state=checked]:bg-[#ffde21]/20 data-[state=checked]:text-foreground font-semibold"
            >
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#ffde21]" />
                Hoy · {formatMonthLong(today)}
              </span>
            </SelectItem>
            <SelectSeparator />
          </>
        )}

        {groups.map((g, gIdx) => (
          <SelectGroup key={g.year}>
            <SelectLabel className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40 px-2 pt-2 pb-1">
              {g.year}
            </SelectLabel>
            {g.months.map((m) => {
              const isCurrentMonth = m === today
              return (
                <SelectItem
                  key={m}
                  value={m}
                  className="text-foreground data-[highlighted]:bg-foreground/10 data-[highlighted]:text-foreground data-[state=checked]:bg-foreground/10 data-[state=checked]:text-foreground"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {formatMonthLong(m)}
                    {isCurrentMonth && (
                      <span className="text-[9px] font-bold text-[#ffde21] uppercase tracking-wider">Hoy</span>
                    )}
                  </span>
                </SelectItem>
              )
            })}
            {gIdx < groups.length - 1 && <SelectSeparator />}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
