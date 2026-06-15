"use client"

import { cn } from "@/lib/utils"

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})
const numberFmt = new Intl.NumberFormat("en-US")

interface StatProps {
  value: number
  label?: string
  format?: "currency" | "count"
  size?: "hero" | "card"
  colorClass?: string
  className?: string
}

export function Stat({
  value,
  label,
  format = "count",
  size = "card",
  colorClass,
  className,
}: StatProps) {
  const formatted = format === "currency"
    ? currencyFmt.format(value)
    : numberFmt.format(value)

  return (
    <div className={cn("text-right", className)}>
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-0.5">
          {label}
        </p>
      )}
      <p
        className={cn(
          "tabular-nums leading-none font-semibold",
          size === "hero" ? "text-[34px] font-medium" : "text-[26px] font-bold",
          colorClass ?? "text-foreground",
        )}
      >
        {formatted}
      </p>
    </div>
  )
}
