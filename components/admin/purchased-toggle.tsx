"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

/** Pill clickable: marca si un lead / aplicación terminó comprando. */
export function PurchasedToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!value) }}
      title={value ? "Compró — click para desmarcar" : "Marcar como que compró"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold transition-colors",
        value
          ? "border-emerald-400/30 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-foreground/10 bg-foreground/[0.03] text-foreground/40 hover:text-foreground/70 hover:border-foreground/20"
      )}
    >
      {value ? <><Check className="h-3 w-3" /> Compró</> : "No"}
    </button>
  )
}
