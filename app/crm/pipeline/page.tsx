"use client"

import { Loader2 } from "lucide-react"
import { CrmShell } from "@/components/layout/crm-shell"
import { PipelineView } from "@/components/views/pipeline-view"
import { useCrmAccess } from "@/lib/crm/use-crm-access"

// Mismo motor de Kanban que /admin/leads (drag-and-drop, rating 1-5★, 8
// etapas, seguimiento por fecha) — pedido explícito del usuario: "todo
// igual, incluido rating y 8 etapas". Antes vivía en /pipeline (nunca
// lanzado); ahora cuelga del shell del CRM interno + el mismo gate de
// crm_enabled que el resto.
export default function CrmPipelinePage() {
  const access = useCrmAccess("/crm/pipeline")

  if (access.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
      </div>
    )
  }

  if (access.status === "no-access") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-background px-4 text-center">
        <p className="text-sm font-medium text-foreground/60">Todavía no tenés acceso al CRM interno.</p>
        <p className="text-[13px] text-foreground/40">Avisale al equipo de Smart Scale si creés que deberías tenerlo.</p>
      </div>
    )
  }

  return (
    <CrmShell clientName={access.clientName} readOnly={access.readOnly}>
      <PipelineView clientId={access.clientId} readOnly={access.readOnly} />
    </CrmShell>
  )
}
