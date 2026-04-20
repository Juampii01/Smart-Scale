import { DashboardLayout }   from "@/components/layout/dashboard-layout"
import { AdminClientsView } from "@/components/views/admin-clients-view"

export const dynamic = "force-dynamic"

export default function AdminClientsPage() {
  return (
    <DashboardLayout>
      <AdminClientsView />
    </DashboardLayout>
  )
}
