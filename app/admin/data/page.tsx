import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminDataView }   from "@/components/views/admin-data-view"

export const dynamic = "force-dynamic"

export default function AdminDataPage() {
  return (
    <DashboardLayout>
      <AdminDataView />
    </DashboardLayout>
  )
}
