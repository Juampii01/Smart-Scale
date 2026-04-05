import { cn } from "@/lib/utils"

export function Sk({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />
}

/** KPI card skeleton — matches BusinessKPIs card exactly */
export function KpiCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
      <div className="h-[2px] w-full skeleton" />
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <Sk className="h-9 w-9 rounded-xl" />
          <Sk className="h-6 w-14 rounded-full" />
        </div>
        <Sk className="h-2.5 w-24 mb-3" />
        <Sk className="h-8 w-28" />
        <Sk className="h-2 w-32 mt-3" />
      </div>
    </div>
  )
}

/** Generic stat card — matches StatCard in SalesView / ChannelsView */
export function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
      <Sk className="h-2.5 w-24 mb-3" />
      <Sk className="h-8 w-20" />
      <Sk className="h-2 w-28 mt-2" />
    </div>
  )
}

/** Funnel row skeleton — matches SalesView funnel steps */
export function FunnelRowSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Sk className="h-2.5 w-32" />
          <Sk className="h-8 w-12" />
        </div>
        <Sk className="h-7 w-14 rounded-full" />
      </div>
    </div>
  )
}

/** Channel block skeleton */
export function ChannelBlockSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111113] overflow-hidden">
      <div className="h-[2px] w-full skeleton" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sk className="h-8 w-8 rounded-lg" />
          <Sk className="h-3 w-28" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Sk className="h-2.5 w-28" />
            <Sk className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Reflection card skeleton */
export function ReflectionCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
      <div className="flex items-center gap-3 mb-5">
        <Sk className="h-10 w-10 rounded-full" />
        <Sk className="h-3 w-36" />
      </div>
      <Sk className="h-3 w-full mb-2" />
      <Sk className="h-3 w-4/5 mb-2" />
      <Sk className="h-3 w-3/5" />
    </div>
  )
}

/** Section header skeleton */
export function SectionHeaderSkeleton() {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <div className="h-4 w-[3px] rounded-full bg-[#ffde21]/30" />
      <Sk className="h-2.5 w-40" />
    </div>
  )
}
