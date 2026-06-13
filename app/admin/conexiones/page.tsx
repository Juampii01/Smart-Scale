import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminSocialView } from "@/components/views/admin-social-view"

export const dynamic = "force-dynamic"

export default function AdminConexionesPage() {
  return (
    <DashboardLayout>
      <AdminSocialView />
    </DashboardLayout>
  )
}
