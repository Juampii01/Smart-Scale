import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ChannelShellView } from "@/components/views/channel-shell-view"

export default function IgCompetitorsPage() {
  return (
    <DashboardLayout>
      <ChannelShellView
        title="Instagram — Competitors"
        description="Agregá perfiles de competidores para analizar su estrategia de contenido."
        emptyIcon="instagram"
        emptyText="Todavía no tenés competidores guardados"
        emptySubtext="Agregá un perfil de Instagram para empezar a comparar."
        actionLabel="+ Agregar competidor"
        comingSoon
      />
    </DashboardLayout>
  )
}
