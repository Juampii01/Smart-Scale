import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminLeadsView }  from "@/components/views/admin-leads-view"

export const dynamic = "force-dynamic"

export default function AdminLeadsPage() {
  return (
    <DashboardLayout>
      <AdminLeadsView />
    </DashboardLayout>
  )
}
