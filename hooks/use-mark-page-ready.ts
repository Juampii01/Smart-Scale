import { useEffect } from "react"
import { pageReadyBus } from "@/lib/page-ready-bus"

/**
 * Call this hook in any view component.
 * When `isReady` becomes true, signals the PageLoader to fade out.
 */
export function useMarkPageReady(isReady: boolean) {
  useEffect(() => {
    if (isReady) pageReadyBus.emit()
  }, [isReady])
}
