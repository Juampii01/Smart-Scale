import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ContentCompetitorsView } from "@/components/views/content-competitors-view"

export default function YtCompetitorsPage() {
  return (
    <DashboardLayout>
      <ContentCompetitorsView channel="youtube" />
    </DashboardLayout>
  )
}
