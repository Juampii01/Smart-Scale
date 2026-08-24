"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"

export type CrmAccessStatus = "loading" | "ready" | "no-access"

export interface CrmAccess {
  status: CrmAccessStatus
  clientId: string | null
  clientName: string | null
  readOnly: boolean
}

/** Gate compartido por toda página bajo /crm/*: valida sesión + que
 *  clients.crm_enabled esté prendido para la cuenta en cuestión. No
 *  alcanza con que el sidebar esconda el link a esta pantalla — alguien
 *  podría entrar por URL directa. Staff interno entra en solo lectura vía
 *  ?client_id=; sin ese param, sin acceso (no hay cuenta propia). */
export function useCrmAccess(redirectPath: string): CrmAccess {
  const router = useRouter()
  const searchParams = useSearchParams()
  const overrideClientId = searchParams.get("client_id")

  const [state, setState] = useState<CrmAccess>({ status: "loading", clientId: null, clientName: null, readOnly: false })

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent(redirectPath + (overrideClientId ? `?client_id=${overrideClientId}` : ""))}`)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace("/login"); return }

    const { data: profile } = await supabase.from("profiles").select("role, client_id").eq("id", user.id).maybeSingle()
    const role = String((profile as any)?.role ?? "").toLowerCase()
    const isInternal = role === "admin" || role === "team" || role === "setter" || role === "developer"

    const targetClientId = isInternal ? overrideClientId : (profile as any)?.client_id
    if (!targetClientId) { setState((s) => ({ ...s, status: "no-access" })); return }

    const { data: clientRow } = await supabase.from("clients").select("nombre, name, crm_enabled").eq("id", targetClientId).maybeSingle()
    if (!(clientRow as any)?.crm_enabled) { setState((s) => ({ ...s, status: "no-access" })); return }

    setState({
      status: "ready",
      clientId: targetClientId,
      clientName: (clientRow as any)?.nombre || (clientRow as any)?.name || null,
      readOnly: isInternal,
    })
  }, [overrideClientId, router, redirectPath])

  useEffect(() => { load() }, [load])

  return state
}
