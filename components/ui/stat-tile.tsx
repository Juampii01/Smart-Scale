"use client"

import { cn } from "@/lib/utils"
import { Stat } from "@/components/ui/stat"

interface StatTileProps {
  label: string
  value?: number
  /** Valor ya formateado (ej. "45%") — pisa `value`/`format` cuando no es un número crudo. */
  displayValue?: string
  format?: "currency" | "count"
  hint?: string
  colorClass?: string
  highlight?: boolean
  className?: string
}

/** Card wrapper alrededor de <Stat> — label arriba, número grande, hint opcional abajo. */
export function StatTile({ label, value, displayValue, format = "count", hint, colorClass, highlight, className }: StatTileProps) {
  return (
    <div className={cn(
      "rounded-xl border px-3 py-2.5",
      highlight ? "border-accent/25 bg-accent-soft" : "border-border bg-card",
      className,
    )}>
      <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-1", highlight ? "text-accent-ink/70" : "text-text-2")}>{label}</p>
      {displayValue != null ? (
        <p className={cn("text-[18px] font-bold tabular-nums", highlight ? "text-accent-ink" : "text-foreground")}>{displayValue}</p>
      ) : (
        <Stat value={value ?? 0} format={format} size="card" colorClass={colorClass ?? (highlight ? "text-accent-ink" : undefined)} className="text-left" />
      )}
      {hint && <p className="text-[11px] text-text-3 mt-1">{hint}</p>}
    </div>
  )
}
