import { DashboardLayout }            from "@/components/layout/dashboard-layout"
import { AdminInstagramAccessView }   from "@/components/views/admin-instagram-access-view"

export const dynamic = "force-dynamic"

export default function AdminInstagramAccessPage() {
  return (
    <DashboardLayout>
      <AdminInstagramAccessView />
    </DashboardLayout>
  )
}
