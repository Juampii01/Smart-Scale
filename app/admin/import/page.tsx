import { DashboardLayout }    from "@/components/layout/dashboard-layout"
import { AdminImportView }     from "@/components/views/admin-import-view"

export const dynamic = "force-dynamic"

export default function AdminImportPage() {
  return (
    <DashboardLayout>
      <AdminImportView />
    </DashboardLayout>
  )
}
