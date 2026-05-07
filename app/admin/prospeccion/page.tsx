import { DashboardLayout }      from "@/components/layout/dashboard-layout"
import { AdminProspeccionView } from "@/components/views/admin-prospeccion-view"

export const dynamic = "force-dynamic"

export default function AdminProspeccionPage() {
  return (
    <DashboardLayout>
      <AdminProspeccionView />
    </DashboardLayout>
  )
}
