"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { usePathname, useSearchParams } from "next/navigation"

function ProgressBarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const [completing, setCompleting] = useState(false)
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevRef = useRef("")

  const key = pathname + searchParams.toString()

  useEffect(() => {
    if (prevRef.current === key) return
    prevRef.current = key

    // Clear any existing timers
    if (rafRef.current) clearTimeout(rafRef.current)

    // Start fresh
    setCompleting(false)
    setWidth(0)
    setVisible(true)

    // Animate to ~80% quickly, then stall
    let current = 0
    const tick = () => {
      current += (90 - current) * 0.18
      setWidth(current)
      if (current < 88) {
        rafRef.current = setTimeout(tick, 60)
      }
    }
    rafRef.current = setTimeout(tick, 16)

    // Complete after short delay
    const completeTimer = setTimeout(() => {
      setCompleting(true)
      setWidth(100)
      setTimeout(() => {
        setVisible(false)
        setWidth(0)
        setCompleting(false)
      }, 350)
    }, 320)

    return () => {
      if (rafRef.current) clearTimeout(rafRef.current)
      clearTimeout(completeTimer)
    }
  }, [key])

  if (!visible) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] h-[2px] pointer-events-none"
      aria-hidden
    >
      <div
        className="h-full progress-shimmer rounded-r-full"
        style={{
          width: `${width}%`,
          transition: completing
            ? "width 0.2s ease-out, opacity 0.3s ease"
            : "width 0.08s linear",
          boxShadow: "0 0 10px #ffde21, 0 0 4px #ffde2180",
        }}
      />
    </div>
  )
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  )
}
