"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { usePathname } from "next/navigation"

// Outer ring: 1 revolution every 0.7s → 3 revolutions = 2.1s
// Inner ring: 1 revolution every 0.5s (counter)
// Total cinematic time: 2.1s spin + 0.55s fade-out

const SPIN_DURATION   = 2100   // ms — exactly 3 outer rotations
const FADE_OUT        = 550    // ms

function PageLoaderInner() {
  const pathname    = usePathname()
  const prevPathRef = useRef(pathname)
  const [phase, setPhase] = useState<"hidden" | "enter" | "spin" | "leave">("hidden")
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  function clear() { timers.current.forEach(clearTimeout); timers.current = [] }
  function after(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms); timers.current.push(t); return t
  }

  // Intercept internal link clicks
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a")
      if (!a) return
      const href = a.getAttribute("href") ?? ""
      if (!href || href.startsWith("http") || href.startsWith("mailto") || href.startsWith("#")) return
      if (href === pathname) return

      clear()
      setPhase("enter")
      // Tiny delay so enter opacity kicks in, then switch to spin
      after(() => setPhase("spin"), 30)
      // After 3 rotations, start leave
      after(() => setPhase("leave"), 30 + SPIN_DURATION)
      // Fully hidden
      after(() => setPhase("hidden"), 30 + SPIN_DURATION + FADE_OUT)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [pathname])

  // Reset prevRef when path settles
  useEffect(() => {
    prevPathRef.current = pathname
  }, [pathname])

  if (phase === "hidden") return null

  const opacity = phase === "enter" ? 0 : phase === "leave" ? 0 : 1
  const scale   = phase === "leave" ? 1.06 : 1

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0c0c0d] select-none"
      style={{
        opacity,
        transform: `scale(${scale})`,
        transition: phase === "leave"
          ? `opacity ${FADE_OUT}ms cubic-bezier(0.4,0,0.2,1), transform ${FADE_OUT}ms cubic-bezier(0.4,0,0.2,1)`
          : phase === "enter"
          ? "opacity 0.08s ease-in"
          : "none",
        pointerEvents: phase === "leave" ? "none" : "all",
      }}
    >
      {/* Ambient radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(255,222,33,0.07) 0%, transparent 68%)",
        }}
      />

      {/* Outer diffuse glow ring */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 120, height: 120,
          background: "radial-gradient(circle, rgba(255,222,33,0.08) 0%, transparent 70%)",
          animation: "loader-pulse 1.4s ease-in-out infinite",
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-7"
        style={{ animation: "loader-enter 0.35s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="text-white text-2xl font-bold tracking-[0.28em]">SMART</span>
          <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold tracking-wide text-black">
            SCALE
          </span>
        </div>

        {/* Triple-ring spinner */}
        <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>

          {/* Outer ring — 3 full rotations in SPIN_DURATION */}
          <svg
            className="absolute"
            width="72" height="72" viewBox="0 0 72 72" fill="none"
            style={{ animation: `loader-spin ${SPIN_DURATION / 3}ms linear infinite` }}
          >
            <circle cx="36" cy="36" r="32" stroke="rgba(255,222,33,0.10)" strokeWidth="1.5" />
            <circle
              cx="36" cy="36" r="32"
              stroke="#ffde21" strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="38 163"
              style={{ filter: "drop-shadow(0 0 4px rgba(255,222,33,0.7))" }}
            />
          </svg>

          {/* Mid ring — counter-spin, slightly faster */}
          <svg
            className="absolute"
            width="52" height="52" viewBox="0 0 52 52" fill="none"
            style={{ animation: `loader-spin-reverse ${(SPIN_DURATION / 3) * 0.75}ms linear infinite` }}
          >
            <circle cx="26" cy="26" r="22" stroke="rgba(255,222,33,0.06)" strokeWidth="1.5" />
            <circle
              cx="26" cy="26" r="22"
              stroke="rgba(255,222,33,0.55)" strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="18 120"
            />
          </svg>

          {/* Inner ring — same direction as outer, faster */}
          <svg
            className="absolute"
            width="32" height="32" viewBox="0 0 32 32" fill="none"
            style={{ animation: `loader-spin ${(SPIN_DURATION / 3) * 0.55}ms linear infinite` }}
          >
            <circle cx="16" cy="16" r="12" stroke="rgba(255,222,33,0.04)" strokeWidth="1.5" />
            <circle
              cx="16" cy="16" r="12"
              stroke="rgba(255,222,33,0.3)" strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="8 68"
            />
          </svg>

          {/* Center pulsing dot */}
          <div
            className="rounded-full bg-[#ffde21]"
            style={{
              width: 7, height: 7,
              boxShadow: "0 0 10px #ffde21, 0 0 22px rgba(255,222,33,0.5)",
              animation: "loader-pulse-dot 0.7s ease-in-out infinite alternate",
            }}
          />
        </div>

        {/* v2.0 badge */}
        <span className="rounded-full border border-[#ffde21]/18 bg-[#ffde21]/5 px-3.5 py-0.5 text-[10px] font-bold text-[#ffde21]/45 tracking-[0.22em] uppercase">
          Portal v2.0
        </span>
      </div>
    </div>
  )
}

export function PageLoader() {
  return (
    <Suspense fallback={null}>
      <PageLoaderInner />
    </Suspense>
  )
}
