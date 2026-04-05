import { useEffect, useState } from "react"

/**
 * Returns true while either `dataLoading` is true OR the minimum display
 * time (default 2000ms) hasn't elapsed yet — whichever is longer.
 */
export function useMinLoading(dataLoading: boolean, minMs = 2000): boolean {
  const [minPassed, setMinPassed] = useState(false)

  useEffect(() => {
    setMinPassed(false)
    const t = setTimeout(() => setMinPassed(true), minMs)
    return () => clearTimeout(t)
  }, [minMs])

  return !minPassed || dataLoading
}
