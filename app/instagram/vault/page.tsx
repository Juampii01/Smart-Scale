import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ChannelShellView } from "@/components/views/channel-shell-view"

export default function IgVaultPage() {
  return (
    <DashboardLayout>
      <ChannelShellView
        title="Instagram — Vault"
        description="Guardá reels y posts de referencia para analizar qué funciona."
        emptyIcon="instagram"
        emptyText="Tu vault está vacío"
        emptySubtext="Guardá posts o reels de referencia para analizarlos acá."
        actionLabel="+ Guardar post"
        comingSoon
      />
    </DashboardLayout>
  )
}
