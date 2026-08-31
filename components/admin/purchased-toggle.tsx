"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

/** Pill clickable: marca si un lead / aplicación terminó comprando.
 *  mono = versión monocromo (blanco/negro según tema) para la sección Leads. */
export function PurchasedToggle({ value, onChange, mono = false }: { value: boolean; onChange: (v: boolean) => void; mono?: boolean }) {
  const onStyle = mono
    ? "border-border bg-secondary text-foreground"
    : "border-emerald-400/30 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!value) }}
      title={value ? "Compró — click para desmarcar" : "Marcar como que compró"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold transition-colors",
        value
          ? onStyle
          : "border-border bg-elevated text-text-2 hover:text-foreground hover:border-border-hover"
      )}
    >
      {value ? <><Check className="h-3 w-3" /> Compró</> : "No"}
    </button>
  )
}
