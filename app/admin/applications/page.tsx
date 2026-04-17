import { DashboardLayout }        from "@/components/layout/dashboard-layout"
import { AdminApplicationsView }  from "@/components/views/admin-applications-view"

export default function AdminApplicationsPage() {
  return (
    <DashboardLayout>
      <AdminApplicationsView />
    </DashboardLayout>
  )
}
