import { DashboardLayout }             from "@/components/layout/dashboard-layout"
import { AdminCentroOperativoView }     from "@/components/views/admin-centro-operativo-view"

export const dynamic = "force-dynamic"

export default function AdminCentroOperativoPage() {
  return (
    <DashboardLayout>
      <AdminCentroOperativoView />
    </DashboardLayout>
  )
}
