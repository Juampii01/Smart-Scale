import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminSettingView } from "@/components/views/admin-setting-view"

export const dynamic = "force-dynamic"

export default function AdminSettingPage() {
  return (
    <DashboardLayout>
      <AdminSettingView />
    </DashboardLayout>
  )
}
