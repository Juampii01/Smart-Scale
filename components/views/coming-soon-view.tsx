"use client"

import { Lock } from "lucide-react"

interface ComingSoonViewProps {
  name: string
  description?: string
}

export function ComingSoonView({ name, description }: ComingSoonViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 select-none">
      {/* Animated lock with pulsing rings */}
      <div className="relative flex items-center justify-center">
        {/* Outer ring */}
        <span
          className="absolute h-40 w-40 rounded-full border border-[#ffde21]/10 animate-ping"
          style={{ animationDuration: "3s" }}
        />
        {/* Middle ring */}
        <span
          className="absolute h-28 w-28 rounded-full border border-[#ffde21]/20 animate-ping"
          style={{ animationDuration: "2.2s", animationDelay: "0.4s" }}
        />
        {/* Inner ring */}
        <span
          className="absolute h-20 w-20 rounded-full border border-[#ffde21]/30 animate-ping"
          style={{ animationDuration: "1.6s", animationDelay: "0.8s" }}
        />
        {/* Lock icon box */}
        <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ffde21]/10 border border-[#ffde21]/30 animate-pulse">
          <Lock className="h-7 w-7 text-[#ffde21]" />
        </div>
      </div>

      {/* Status badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-[#ffde21]/30 bg-[#ffde21]/5 px-4 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#ffde21] animate-pulse" />
        <span className="text-xs font-semibold text-[#ffde21] tracking-widest uppercase">
          En desarrollo
        </span>
      </div>

      {/* Text */}
      <div className="space-y-3">
        <h2 className="text-3xl font-bold text-white">Próximamente</h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
          <span className="font-medium text-white/70">{name}</span>{" "}
          {description ?? "está siendo preparado y estará disponible muy pronto."}
        </p>
      </div>

      {/* Bouncing dots */}
      <div className="flex items-center gap-2">
        {[0, 0.15, 0.3].map((delay, i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-[#ffde21]/50 animate-bounce"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </div>
    </div>
  )
}
