import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ContentCompetitorsView } from "@/components/views/content-competitors-view"

export default function IgCompetitorsPage() {
  return (
    <DashboardLayout>
      <ContentCompetitorsView channel="instagram" />
    </DashboardLayout>
  )
}
