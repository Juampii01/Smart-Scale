import { DashboardLayout }        from "@/components/layout/dashboard-layout"
import { AdminApplicationsView }  from "@/components/views/admin-applications-view"

export const dynamic = "force-dynamic"

export default function AdminApplicationsPage() {
  return (
    <DashboardLayout>
      <AdminApplicationsView />
    </DashboardLayout>
  )
}
