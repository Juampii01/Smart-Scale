import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminDataView }   from "@/components/views/admin-data-view"

export default function AdminDataPage() {
  return (
    <DashboardLayout>
      <AdminDataView />
    </DashboardLayout>
  )
}
