import { DashboardLayout }    from "@/components/layout/dashboard-layout"
import { AdminPaymentsView }  from "@/components/views/admin-payments-view"

export const dynamic = "force-dynamic"

export default function AdminPaymentsPage() {
  return (
    <DashboardLayout>
      <AdminPaymentsView />
    </DashboardLayout>
  )
}
