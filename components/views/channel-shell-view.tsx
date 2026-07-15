"use client"

import { Instagram, Youtube } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChannelShellViewProps {
  title: string
  description: string
  emptyIcon: "instagram" | "youtube"
  emptyText: string
  emptySubtext: string
  actionLabel: string
  comingSoon?: boolean
}

export function ChannelShellView({
  title, description, emptyIcon, emptyText, emptySubtext, actionLabel, comingSoon,
}: ChannelShellViewProps) {
  const Icon = emptyIcon === "instagram" ? Instagram : Youtube
  const iconColor = emptyIcon === "instagram" ? "#818cf8" : "#f87171"

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-foreground leading-tight">{title}</h1>
          <p className="text-[13px] text-foreground/50 mt-0.5">{description}</p>
        </div>
        <button
          disabled={comingSoon}
          className={cn(
            "flex items-center gap-2 rounded-[8px] px-4 py-2 text-[13px] font-semibold transition-all",
            comingSoon
              ? "bg-foreground/[0.05] text-foreground/30 cursor-not-allowed"
              : "bg-[#dafc69] text-black hover:bg-[#f2ffc0]"
          )}
        >
          {actionLabel}
          {comingSoon && <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/25 ml-1">pronto</span>}
        </button>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-[14px]"
          style={{ backgroundColor: `${iconColor}15`, boxShadow: `0 0 0 1px ${iconColor}25` }}
        >
          <Icon className="h-7 w-7" style={{ color: iconColor }} />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-foreground/70">{emptyText}</p>
          <p className="text-[13px] text-foreground/40 mt-1">{emptySubtext}</p>
          {comingSoon && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 py-1 text-[11px] font-semibold text-foreground/40">
              Próximamente
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
