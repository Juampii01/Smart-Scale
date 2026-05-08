"use client"

/**
 * MonthSelector — calendar-style picker.
 *
 * Trigger compacto. Al abrir muestra una grilla 4×3 de meses del año seleccionado,
 * con flechas para navegar entre años. Mes actual destacado con halo amarillo,
 * mes seleccionado con fondo amarillo lleno, meses sin data deshabilitados.
 */

import React, { useEffect, useMemo, useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const MONTH_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]

function currentMonthYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function formatLong(ym: string): string {
  const [y, m] = ym.split("-")
  const idx = Number(m) - 1
  return MONTH_NAMES[idx] ? `${MONTH_NAMES[idx]} ${y}` : ym
}

function formatShort(ym: string): string {
  const [y, m] = ym.split("-")
  const idx = Number(m) - 1
  return MONTH_SHORT[idx] ? `${MONTH_SHORT[idx]} '${y.slice(2)}` : ym
}

function ymOf(year: number, monthIdx0: number): string {
  return `${year}-${String(monthIdx0 + 1).padStart(2, "0")}`
}

function normalize(s: any): string | null {
  const str = String(s ?? "").trim()
  const m1 = str.match(/^(\d{4})-(\d{2})/)
  if (m1) return `${m1[1]}-${m1[2]}`
  const m2 = str.match(/^(\d{4})-(\d{1,2})/)
  if (m2) return `${m2[1]}-${String(Number(m2[2])).padStart(2, "0")}`
  return null
}

/** Set normalizado de meses con data. Siempre incluye el mes actual + 2025-12 (legacy). */
function buildAvailableSet(enabledMonths?: string[]): Set<string> {
  const set = new Set<string>()
  set.add(currentMonthYM())
  set.add("2025-12")
  if (Array.isArray(enabledMonths)) {
    for (const m of enabledMonths) {
      const norm = normalize(m)
      if (norm && /^\d{4}-\d{2}$/.test(norm)) set.add(norm)
    }
  }
  return set
}

/** Min/max year a partir del set disponible. Garantiza que el año actual esté incluido. */
function yearRange(available: Set<string>): { min: number; max: number } {
  const years = Array.from(available).map(ym => Number(ym.slice(0, 4))).filter(n => Number.isFinite(n))
  const today = new Date().getFullYear()
  if (years.length === 0) return { min: today, max: today }
  return { min: Math.min(...years, today), max: Math.max(...years, today) }
}

// ─── Component ────────────────────────────────────────────────────────────────

type MonthSelectorProps = {
  value?: string
  onChange?: (value: string) => void
  enabledMonths?: string[]
}

export function MonthSelector({ value, onChange, enabledMonths }: MonthSelectorProps) {
  const today = currentMonthYM()
  const available = useMemo(() => buildAvailableSet(enabledMonths), [enabledMonths])
  const range = useMemo(() => yearRange(available), [available])

  const initialDefault = available.has(today)
    ? today
    : (Array.from(available).sort((a, b) => b.localeCompare(a))[0] ?? today)

  const [selected, setSelected] = useState<string>(value ?? initialDefault)
  const [open, setOpen] = useState(false)

  // Año visible en la grilla. Por default = año del seleccionado.
  const [viewYear, setViewYear] = useState<number>(Number((value ?? selected).slice(0, 4)))

  useEffect(() => {
    if (typeof value === "string") {
      setSelected(value)
      setViewYear(Number(value.slice(0, 4)))
    }
  }, [value])

  // Cuando se abre el popover, saltamos al año del mes seleccionado actual
  useEffect(() => {
    if (open) setViewYear(Number(selected.slice(0, 4)))
  }, [open])  // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (ym: string) => {
    if (!available.has(ym)) return
    setSelected(ym)
    onChange?.(ym)
    setOpen(false)
  }

  const canGoPrev = viewYear > range.min
  const canGoNext = viewYear < range.max
  const isToday = selected === today
  const todayYear = Number(today.slice(0, 4))

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-foreground/5 px-2.5 text-xs sm:text-sm font-semibold text-foreground hover:bg-foreground/10 focus:outline-none focus:ring-2 focus:ring-[#ffde21]/40 transition-colors w-[120px] sm:w-[140px]"
        >
          <Calendar className="h-3.5 w-3.5 text-foreground/50 shrink-0" />
          <span className="flex-1 text-left">{formatShort(selected)}</span>
          {isToday && <span className="h-1.5 w-1.5 rounded-full bg-[#ffde21] shrink-0" title="Mes actual" />}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[280px] rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1"
        >
          {/* Header — year navigator */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-2">
            <button
              type="button"
              onClick={() => canGoPrev && setViewYear(y => y - 1)}
              disabled={!canGoPrev}
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/[0.08] hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Año anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-foreground tabular-nums">{viewYear}</span>
              {viewYear === todayYear && (
                <span className="rounded-full bg-[#ffde21]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#ffde21] uppercase tracking-wider">
                  Actual
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => canGoNext && setViewYear(y => y + 1)}
              disabled={!canGoNext}
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/[0.08] hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Año siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 12-month grid */}
          <div className="grid grid-cols-4 gap-1.5 p-2.5">
            {MONTH_SHORT.map((label, idx) => {
              const ym = ymOf(viewYear, idx)
              const has = available.has(ym)
              const isSelected = ym === selected
              const isCurrentMonth = ym === today
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => pick(ym)}
                  disabled={!has}
                  title={has ? formatLong(ym) : `${formatLong(ym)} — sin datos`}
                  className={`relative h-9 rounded-md text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-[#ffde21] text-black shadow-sm"
                      : has
                        ? `text-foreground hover:bg-foreground/[0.08] ${isCurrentMonth ? "ring-1 ring-[#ffde21]/50" : ""}`
                        : "text-foreground/25 cursor-not-allowed"
                  }`}
                >
                  {label}
                  {isCurrentMonth && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#ffde21]" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Footer — quick "Hoy" */}
          {!isToday && available.has(today) && (
            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={() => pick(today)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-semibold text-foreground/70 hover:bg-[#ffde21]/10 hover:text-foreground transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#ffde21]" />
                Ir a hoy · {formatLong(today)}
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
