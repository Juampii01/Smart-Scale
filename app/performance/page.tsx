import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { PerformanceView } from "@/components/views/performance-view"

export default function PerformancePage() {
  return (
    <DashboardLayout>
      <PerformanceView />
    </DashboardLayout>
  )
}
