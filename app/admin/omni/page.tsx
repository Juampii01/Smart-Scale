import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminOmniView }  from "@/components/views/admin-omni-view"

export const dynamic = "force-dynamic"

export default function AdminOmniPage() {
  return (
    <DashboardLayout>
      <AdminOmniView />
    </DashboardLayout>
  )
}
