import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ChannelShellView } from "@/components/views/channel-shell-view"

export default function ClaudeSkillsPage() {
  return (
    <DashboardLayout>
      <ChannelShellView
        title="Claude Skills"
        description="Habilidades y flujos de trabajo potenciados por Claude AI — próximamente."
        emptyIcon="instagram"
        emptyText="Claude Skills está en camino"
        emptySubtext="Pronto vas a tener acceso a skills de Claude integradas directamente en tu dashboard."
        actionLabel="Disponible pronto"
        comingSoon
      />
    </DashboardLayout>
  )
}
