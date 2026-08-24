"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { CrmShell } from "@/components/layout/crm-shell"
import { CrmPipelineView } from "@/components/views/crm-pipeline-view"

/** /crm/pipeline — standalone, con su propio shell (CrmShell), no
 *  DashboardLayout. Gate real está acá, no solo en que el sidebar externo
 *  esconda la puerta: sin esto, alguien podría entrar por URL directa
 *  aunque crm_enabled esté apagado. */
export default function CrmPipelinePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const overrideClientId = searchParams.get("client_id")

  const [status, setStatus] = useState<"loading" | "ready" | "no-access">("loading")
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [readOnly, setReadOnly] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.replace(`/login?redirect=${encodeURIComponent("/crm/pipeline")}`)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace("/login"); return }

    const { data: profile } = await supabase.from("profiles").select("role, client_id").eq("id", user.id).maybeSingle()
    const role = String((profile as any)?.role ?? "").toLowerCase()
    const isInternal = role === "admin" || role === "team" || role === "setter" || role === "developer"

    const targetClientId = isInternal ? overrideClientId : (profile as any)?.client_id
    if (!targetClientId) { setStatus("no-access"); return }

    const { data: clientRow } = await supabase.from("clients").select("nombre, name, crm_enabled").eq("id", targetClientId).maybeSingle()
    const enabled = !!(clientRow as any)?.crm_enabled
    // Staff entra siempre en solo lectura si el flag está prendido — nunca
    // se le pide confirmación de escritura, la API la rechaza igual, pero
    // así ni se le muestran los controles.
    if (!enabled) { setStatus("no-access"); return }

    setClientId(targetClientId)
    setClientName((clientRow as any)?.nombre || (clientRow as any)?.name || null)
    setReadOnly(isInternal)
    setStatus("ready")
  }, [overrideClientId, router])

  useEffect(() => { load() }, [load])

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
      </div>
    )
  }

  if (status === "no-access") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center">
        <p className="text-sm font-medium text-foreground/60">Todavía no tenés acceso al CRM interno.</p>
        <p className="text-[13px] text-foreground/40">Avisale al equipo de Smart Scale si creés que deberías tenerlo.</p>
      </div>
    )
  }

  return (
    <CrmShell clientName={clientName} readOnly={readOnly}>
      <CrmPipelineView clientId={clientId} readOnly={readOnly} />
    </CrmShell>
  )
}
