import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ChannelShellView } from "@/components/views/channel-shell-view"

export default function YtVaultPage() {
  return (
    <DashboardLayout>
      <ChannelShellView
        title="YouTube — Vault"
        description="Guardá videos de referencia para analizar qué funciona en tu nicho."
        emptyIcon="youtube"
        emptyText="Tu vault está vacío"
        emptySubtext="Guardá videos de referencia para analizarlos acá."
        actionLabel="+ Guardar video"
        comingSoon
      />
    </DashboardLayout>
  )
}
