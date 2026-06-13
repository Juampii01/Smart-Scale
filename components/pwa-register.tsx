"use client"

import { useEffect } from "react"

/** Registra el service worker para habilitar la PWA (instalable + offline básico). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[pwa] SW registration failed:", err?.message)
      })
    }
    // En una SPA el evento `load` suele dispararse ANTES de que monte este
    // componente → el listener nunca corre y el SW no se registra. Si la página
    // ya cargó, registrar al toque; si no, esperar al load.
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
    return () => window.removeEventListener("load", register)
  }, [])

  return null
}
