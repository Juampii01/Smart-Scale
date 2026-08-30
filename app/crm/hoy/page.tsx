"use client"

import { Loader2 } from "lucide-react"
import { CrmShell } from "@/components/layout/crm-shell"
import { CrmHoyView } from "@/components/views/crm-hoy-view"
import { useCrmAccess } from "@/lib/crm/use-crm-access"

export default function CrmHoyPage() {
  const access = useCrmAccess("/crm/hoy")

  if (access.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-text-3" />
      </div>
    )
  }

  if (access.status === "no-access") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center">
        <p className="text-sm font-medium text-text-2">Todavía no tenés acceso al CRM interno.</p>
        <p className="text-[13px] text-text-2">Avisale al equipo de Smart Scale si creés que deberías tenerlo.</p>
      </div>
    )
  }

  return (
    <CrmShell clientName={access.clientName} readOnly={access.readOnly}>
      <CrmHoyView clientId={access.clientId} clientName={access.clientName} readOnly={access.readOnly} />
    </CrmShell>
  )
}
