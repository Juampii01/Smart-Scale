import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { PipelineView } from "@/components/views/pipeline-view"

export default function PipelinePage() {
  return (
    <DashboardLayout>
      <PipelineView />
    </DashboardLayout>
  )
}
