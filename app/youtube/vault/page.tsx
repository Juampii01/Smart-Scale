import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ContentVaultView } from "@/components/views/content-vault-view"

export default function YtVaultPage() {
  return (
    <DashboardLayout>
      <ContentVaultView channel="youtube" />
    </DashboardLayout>
  )
}
