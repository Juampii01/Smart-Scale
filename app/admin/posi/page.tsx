import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminPosiView } from "@/components/views/admin-posi-view"

export const dynamic = "force-dynamic"

export default function AdminPosiPage() {
  return (
    <DashboardLayout>
      <AdminPosiView />
    </DashboardLayout>
  )
}
