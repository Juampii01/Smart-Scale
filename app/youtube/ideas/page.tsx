import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ContentIdeasView } from "@/components/views/content-ideas-view"

export default function YtIdeasPage() {
  return (
    <DashboardLayout>
      <ContentIdeasView channel="youtube" />
    </DashboardLayout>
  )
}
