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
      highlight ? "border-accent/25 bg-accent-soft" : "border-foreground/10 bg-card",
      className,
    )}>
      <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1", highlight ? "text-[#dafc69]/70" : "text-foreground/40")}>{label}</p>
      {displayValue != null ? (
        <p className={cn("text-lg font-bold tabular-nums", highlight ? "text-[#dafc69]" : "text-foreground")}>{displayValue}</p>
      ) : (
        <Stat value={value ?? 0} format={format} size="card" colorClass={colorClass ?? (highlight ? "text-[#dafc69]" : undefined)} className="text-left" />
      )}
      {hint && <p className="text-[9px] text-foreground/30 mt-1">{hint}</p>}
    </div>
  )
}
