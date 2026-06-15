import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ContentIdeasView } from "@/components/views/content-ideas-view"

export default function IgIdeasPage() {
  return (
    <DashboardLayout>
      <ContentIdeasView channel="instagram" />
    </DashboardLayout>
  )
}
