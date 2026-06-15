import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ContentVaultView } from "@/components/views/content-vault-view"

export default function IgVaultPage() {
  return (
    <DashboardLayout>
      <ContentVaultView channel="instagram" />
    </DashboardLayout>
  )
}
