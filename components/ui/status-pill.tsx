"use client"

import { cn } from "@/lib/utils"

export type StatusPillVariant = "ok" | "error" | "idle" | "warning"

const VARIANT_CLASSES: Record<StatusPillVariant, string> = {
  ok:      "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25",
  error:   "bg-red-100     text-red-700     border-red-300     dark:bg-red-500/10     dark:text-red-400     dark:border-red-500/25",
  idle:    "bg-foreground/[0.05] text-text-2 border-border",
  warning: "bg-amber-100   text-amber-700   border-amber-300   dark:bg-amber-500/10   dark:text-amber-400   dark:border-amber-500/25",
}

const VARIANT_DOT: Record<StatusPillVariant, string> = {
  ok:      "bg-emerald-500",
  error:   "bg-red-500",
  idle:    "bg-foreground/30",
  warning: "bg-amber-500",
}

interface StatusPillProps {
  variant: StatusPillVariant
  children: React.ReactNode
  className?: string
}

export function StatusPill({ variant, children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", VARIANT_DOT[variant])} />
      {children}
    </span>
  )
}
