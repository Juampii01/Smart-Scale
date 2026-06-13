import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminPushView } from "@/components/views/admin-push-view"

export const dynamic = "force-dynamic"

export default function AdminNotificacionesPage() {
  return (
    <DashboardLayout>
      <AdminPushView />
    </DashboardLayout>
  )
}
