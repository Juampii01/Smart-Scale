import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminDemoPanelView } from "@/components/views/admin-demo-panel-view"

export const dynamic = "force-dynamic"

export default function PanelDemoPage() {
  return (
    <DashboardLayout>
      <AdminDemoPanelView />
    </DashboardLayout>
  )
}
