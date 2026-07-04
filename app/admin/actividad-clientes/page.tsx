import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminClientActivityView } from "@/components/views/admin-client-activity-view"

export const dynamic = "force-dynamic"

export default function AdminClientActivityPage() {
  return (
    <DashboardLayout>
      <AdminClientActivityView />
    </DashboardLayout>
  )
}
