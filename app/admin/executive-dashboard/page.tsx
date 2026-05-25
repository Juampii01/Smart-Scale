import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminExecutiveDashboardView } from "@/components/views/admin-executive-dashboard-view"

export const dynamic = "force-dynamic"

export default function AdminExecutiveDashboardPage() {
  return (
    <DashboardLayout>
      <AdminExecutiveDashboardView />
    </DashboardLayout>
  )
}
