import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminTeamApplicationsView } from "@/components/views/admin-team-applications-view"

export const dynamic = "force-dynamic"

export default function AdminTeamApplicationsPage() {
  return (
    <DashboardLayout>
      <AdminTeamApplicationsView />
    </DashboardLayout>
  )
}
