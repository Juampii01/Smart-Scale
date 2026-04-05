"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [key, setKey] = useState(pathname)
  const [animating, setAnimating] = useState(false)
  const prevRef = useRef(pathname)

  useEffect(() => {
    if (prevRef.current === pathname) return
    prevRef.current = pathname
    setAnimating(false)
    // Small tick so CSS re-applies the animation class
    requestAnimationFrame(() => {
      setKey(pathname)
      setAnimating(true)
    })
  }, [pathname])

  return (
    <div key={key} className="page-enter">
      {children}
    </div>
  )
}
