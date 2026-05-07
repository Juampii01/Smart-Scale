import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminEodView } from "@/components/views/admin-eod-view"

export const dynamic = "force-dynamic"

export default function AdminEodPage() {
  return (
    <DashboardLayout>
      <AdminEodView />
    </DashboardLayout>
  )
}
