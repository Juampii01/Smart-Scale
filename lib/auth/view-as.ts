"use client"

import { useEffect, useState } from "react"
import { isAdmin as isAdminRole } from "@/lib/auth/permissions"
import { createClient } from "@/lib/supabase"

/**
 * Admin "view as" — impersonation visual.
 *
 * El admin puede activar un modo "ver como [setter|client]" para QA-ear el UX
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

export type ViewAsRole = "setter" | "client" | null

function readStorage(): ViewAsRole {
  if (typeof window === "undefined") return null
  const v = window.localStorage.getItem(STORAGE_KEY)
  if (v === "setter" || v === "client") return v
  // Legacy: si quedó "team" guardado, lo limpiamos
  if (v === "team") window.localStorage.removeItem(STORAGE_KEY)
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
  if (!isAdminRole(actualRole)) return actualRole  // safeguard: solo admin/developer pueden impersonar
  return viewAs
}

/**
 * "Ver Clientes" — exclusivo del platform owner (isPlatformOwnerEmail). Le
 * permite navegar el sector interno (Leads/Setting/Prospección) de
 * CUALQUIER cliente sin hacer login como ellos. Dimensión separada de
 * ViewAsRole (esto cambia de TENANT, no de rol).
 *
 * Mismo gotcha que ViewAsRole: es solo UI — cada fetch tiene que propagar
 * explícitamente `?client_id=` (GET) o `client_id` (POST/PATCH/DELETE) para
 * que el backend (resolveInternalScope) realmente cambie de tenant. Sin
 * eso, el "Ver Clientes" es cosmético. El backend además solo honra este
 * client_id si el caller es platform owner — cualquier otro usuario que
 * lo tuviera seteado (imposible por UI) sería ignorado ahí.
 */
export type ViewAsTenant = { id: string; name: string; isInternalWorkspace: boolean } | null

const TENANT_STORAGE_KEY = "smartScale.viewAsTenant"
const TENANT_EVENT_NAME  = "smartScale.viewAsTenant.change"

function readTenantStorage(): ViewAsTenant {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(TENANT_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.id === "string" && typeof parsed.name === "string") {
      return { id: parsed.id, name: parsed.name, isInternalWorkspace: Boolean(parsed.isInternalWorkspace) }
    }
  } catch {}
  return null
}

export function getViewAsTenant(): ViewAsTenant {
  return readTenantStorage()
}

export function setViewAsTenant(tenant: ViewAsTenant) {
  if (typeof window === "undefined") return
  if (tenant) window.localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenant))
  else        window.localStorage.removeItem(TENANT_STORAGE_KEY)
  window.dispatchEvent(new Event(TENANT_EVENT_NAME))
}

export function useViewAsTenant(): ViewAsTenant {
  return useSyncExternalStore(
    (cb) => {
      const handler = () => cb()
      if (typeof window !== "undefined") {
        window.addEventListener(TENANT_EVENT_NAME, handler)
        window.addEventListener("storage", handler)
      }
      return () => {
        if (typeof window !== "undefined") {
          window.removeEventListener(TENANT_EVENT_NAME, handler)
          window.removeEventListener("storage", handler)
        }
      }
    },
    readTenantStorage,
    () => null,
  )
}

/**
 * Resuelve si el usuario logueado está "dentro" del sector interno de
 * Smart Scale (vs. el de un cliente con su propio sector). Combina el
 * tenant propio (profiles.internal_tenant_id → clients.is_internal_workspace)
 * con el override de "Ver Clientes" si está activo. Usado por el sidebar
 * y por vistas que gatean contenido específico de Ann (ej. tabs de
 * Centro Operativo) — mismo criterio en los dos lugares, una sola fuente.
 */
export function useIsOwnSectorInternal(): { loading: boolean; isOwnSectorInternal: boolean } {
  const [ownIsInternal, setOwnIsInternal] = useState<boolean | null>(null)
  const viewAsTenant = useViewAsTenant()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { setOwnIsInternal(true); return }
      supabase.from("profiles").select("internal_tenant_id").eq("id", data.user.id).maybeSingle()
        .then(({ data: prof }) => {
          const tenantId = (prof as any)?.internal_tenant_id
          if (!tenantId) { setOwnIsInternal(true); return }
          supabase.from("clients").select("is_internal_workspace").eq("id", tenantId).maybeSingle()
            .then(({ data: tenant }) => setOwnIsInternal(Boolean((tenant as any)?.is_internal_workspace ?? true)))
        })
    })
  }, [])

  if (viewAsTenant) return { loading: false, isOwnSectorInternal: viewAsTenant.isInternalWorkspace }
  if (ownIsInternal === null) return { loading: true, isOwnSectorInternal: true }
  return { loading: false, isOwnSectorInternal: ownIsInternal }
}

/**
 * Helpers no-reactivos para propagar el "Ver Clientes" activo a un fetch
 * puntual (dentro de un event handler, no un render) — leads/setting/
 * prospección los usan para que sus GET/POST/PATCH/DELETE apunten al
 * tenant elegido en vez de caer siempre al propio. Sin esto, "Ver Clientes"
 * es cosmético (gotcha ya documentada arriba).
 */
export function viewAsTenantQueryParam(): string {
  const t = getViewAsTenant()
  return t ? `?client_id=${encodeURIComponent(t.id)}` : ""
}

export function viewAsTenantBodyField(): { client_id?: string } {
  const t = getViewAsTenant()
  return t ? { client_id: t.id } : {}
}
