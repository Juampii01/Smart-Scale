import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ChannelShellView } from "@/components/views/channel-shell-view"

export default function YtCompetitorsPage() {
  return (
    <DashboardLayout>
      <ChannelShellView
        title="YouTube — Competitors"
        description="Investigá canales de YouTube para descubrir contenido de alto rendimiento."
        emptyIcon="youtube"
        emptyText="Todavía no tenés canales guardados"
        emptySubtext="Agregá un canal de YouTube para analizar su estrategia."
        actionLabel="+ Agregar canal"
        comingSoon
      />
    </DashboardLayout>
  )
}
