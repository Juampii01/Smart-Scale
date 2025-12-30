"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Generate months with enabled status based on enabledMonths prop
function generateMonths(enabledMonths?: string[]) {
  // Only show months that exist in enabledMonths, plus ALWAYS include 2025-12.
  const set = new Set<string>()
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

  const sorted = Array.from(set).sort()
  return sorted.map((value) => ({ value, disabled: false }))
}

type MonthSelectorProps = {
  value?: string
  onChange?: (value: string) => void
  enabledMonths?: string[]
}

export function MonthSelector({ value, onChange, enabledMonths }: MonthSelectorProps) {
  const months = useMemo(() => generateMonths(enabledMonths), [enabledMonths])
  const defaultMonth = months.slice(-1)[0]?.value ?? "2025-12"

  // Local state (used when parent doesn't control the value)
  const [selectedMonth, setSelectedMonth] = useState<string>(value ?? defaultMonth)

  // If parent passes value, keep local state in sync
  useEffect(() => {
    if (typeof value === "string") setSelectedMonth(value)
  }, [value])

  return (
    <Select
      value={selectedMonth}
      onValueChange={(v) => {
        setSelectedMonth(v)
        onChange?.(v)
      }}
    >
      <SelectTrigger className="w-[140px] bg-white/5 text-white border-border">
        <SelectValue className="text-white" />
      </SelectTrigger>
      <SelectContent className="bg-black text-white border-border shadow-xl">
        {months.map((m) => (
          <SelectItem
            key={m.value}
            value={m.value}
            disabled={m.disabled}
            className={
              m.disabled
                ? "text-white/30"
                : "text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white data-[state=checked]:bg-white/10 data-[state=checked]:text-white"
            }
          >
            {m.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
