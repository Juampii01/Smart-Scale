"use client"

/**
 * Admin "view as" — impersonation visual.
 *
 * El admin puede activar un modo "ver como [setter|team]" para QA-ear el UX
 * de otros roles sin tener que log out/in. Es solo UI: las llamadas a la API
 * siguen yendo con el JWT del admin, así que la data devuelta NO está
 * filtrada por rol. Para impersonation real de DB, hay que extender el
 * backend (phase 2).
 *
 * Persistencia: localStorage. Sobrevive reloads y navegación.
 */

import { useSyncExternalStore } from "react"

const STORAGE_KEY = "smartScale.viewAsRole"
const EVENT_NAME  = "smartScale.viewAsRole.change"

export type ViewAsRole = "setter" | "team" | null

function readStorage(): ViewAsRole {
  if (typeof window === "undefined") return null
  const v = window.localStorage.getItem(STORAGE_KEY)
  if (v === "setter" || v === "team") return v
  return null
}

export function getViewAsRole(): ViewAsRole {
  return readStorage()
}

export function setViewAsRole(role: ViewAsRole) {
  if (typeof window === "undefined") return
  if (role) window.localStorage.setItem(STORAGE_KEY, role)
  else      window.localStorage.removeItem(STORAGE_KEY)
  // notificar a hooks suscritos
  window.dispatchEvent(new Event(EVENT_NAME))
}

/** React hook reactivo. Se reactualiza cuando setViewAsRole cambia. */
export function useViewAsRole(): ViewAsRole {
  return useSyncExternalStore(
    (cb) => {
      const handler = () => cb()
      if (typeof window !== "undefined") {
        window.addEventListener(EVENT_NAME, handler)
        // También escuchar cambios de storage de OTRA tab
        window.addEventListener("storage", handler)
      }
      return () => {
        if (typeof window !== "undefined") {
          window.removeEventListener(EVENT_NAME, handler)
          window.removeEventListener("storage", handler)
        }
      }
    },
    readStorage,
    () => null,  // SSR
  )
}

/**
 * Devuelve el rol efectivo: si admin está en modo "view as", devuelve ese rol;
 * si no, devuelve el rol real.
 *
 * Solo se aplica si el rol REAL es admin. Otros roles no pueden impersonar.
 */
export function useEffectiveRole(actualRole: string | null): string | null {
  const viewAs = useViewAsRole()
  if (!viewAs) return actualRole
  if (String(actualRole ?? "").toLowerCase() !== "admin") return actualRole  // safeguard
  return viewAs
}
