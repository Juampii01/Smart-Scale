"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarDays, Clock, ExternalLink, MapPin } from "lucide-react"

type CalendarSectionProps = {
  title: string
  subtitle?: string
  rightSlot?: ReactNode
  children: ReactNode
  className?: string
}

export function CalendarSection({
  title,
  subtitle,
  rightSlot,
  children,
  className,
}: CalendarSectionProps) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden",
        "border border-[#29c6d6]/35",
        "bg-gradient-to-br from-card via-card/70 to-card/30",
        "shadow-[0_0_0_1px_rgba(41,198,214,0.10),0_25px_60px_-30px_rgba(0,0,0,0.8)]",
        "transition-all duration-200",
        "hover:border-[#29c6d6]/55 hover:shadow-[0_0_0_1px_rgba(41,198,214,0.16),0_30px_70px_-30px_rgba(0,0,0,0.85)]",
        className
      )}
    >
      {/* Top accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#29c6d6]/10 via-[#29c6d6]/30 to-[#29c6d6]/10" />
      {/* glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(41,198,214,0.22),transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#29c6d6]/10 blur-3xl" />

      <CardHeader className="relative pb-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-4 text-xl font-semibold tracking-[-0.02em]">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-black/30 ring-1 ring-white/10">
                <CalendarDays className="h-6 w-6 text-[#29c6d6]" />
              </div>
              <div className="space-y-1">
                <div className="text-foreground">{title}</div>
                {subtitle ? <div className="text-sm font-medium text-[#29c6d6]">{subtitle}</div> : null}
              </div>
            </CardTitle>
          </div>

          {rightSlot ? (
            <div className="shrink-0">
              <div className="rounded-full border border-[#29c6d6]/25 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
                {rightSlot}
              </div>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="relative pt-6">{children}</CardContent>
    </Card>
  )
}

export function WeeklyCallCard({ call, className }: { call: any; className?: string }) {
  const title = call?.title ?? "Weekly Call"
  const host = call?.host ?? call?.speaker ?? call?.with ?? ""
  const day = call?.day ?? ""
  const time = call?.time ?? ""
  const timezone = call?.timezone ?? "Miami"
  const platform = call?.platform ?? "Zoom"
  const joinUrl = call?.url ?? call?.joinUrl ?? call?.zoomUrl ?? ""
  const passcode = call?.passcode ?? call?.code ?? call?.startCode ?? ""
  const status = call?.status ?? "Activo"

  return (
    <Card
      className={cn(
        "group relative overflow-hidden",
        "border border-[#29c6d6]/35",
        "bg-gradient-to-br from-card via-card/70 to-card/30",
        "shadow-[0_0_0_1px_rgba(41,198,214,0.10),0_25px_60px_-30px_rgba(0,0,0,0.8)]",
        "transition-all duration-200",
        "hover:border-[#29c6d6]/55 hover:shadow-[0_0_0_1px_rgba(41,198,214,0.16),0_30px_70px_-30px_rgba(0,0,0,0.85)]",
        className
      )}
    >
      {/* Top accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#29c6d6]/10 via-[#29c6d6]/30 to-[#29c6d6]/10" />
      {/* glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(41,198,214,0.22),transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#29c6d6]/10 blur-3xl" />

      <CardContent className="relative p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
            {host ? <p className="text-sm text-white/60">Con {host}</p> : null}
          </div>

          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              status === "Cancelado"
                ? "border border-white/10 bg-white/5 text-white/60 line-through"
                : "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
            )}
          >
            {status}
          </span>
        </div>

        <div className="mt-6 space-y-3 text-white/70">
          {day ? (
            <div className="flex items-center gap-3">
              <CalendarDays className="h-4 w-4 text-white/40" />
              <span>{day}</span>
            </div>
          ) : null}

          {(time || timezone) ? (
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-white/40" />
              <span>
                {time ? time : ""}
                {time && timezone ? " · " : ""}
                {timezone ? timezone : ""}
              </span>
            </div>
          ) : null}

          {platform ? (
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-white/40" />
              <span>{platform}</span>
            </div>
          ) : null}

          {passcode ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-medium text-white/50">Código de inicio</div>
              <div className="mt-1 font-mono text-lg text-white/85">{passcode}</div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-white/40">
            {joinUrl ? (
              <span className="block truncate">{joinUrl}</span>
            ) : (
              <span className="block truncate">—</span>
            )}
          </div>

          {joinUrl ? (
            <a href={joinUrl} target="_blank" rel="noreferrer" className="shrink-0">
              <Button className="h-10 rounded-xl bg-[#29c6d6] px-5 text-sm font-semibold text-black hover:bg-[#27b9c8] shadow-[0_18px_40px_-18px_rgba(41,198,214,0.65)]">
                Abrir
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          ) : (
            <Button
              disabled
              className="h-10 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white/40"
            >
              Abrir
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}