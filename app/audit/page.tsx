import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AuditView } from "@/components/views/audit-view"

export const dynamic = "force-dynamic"

export default function AuditPage() {
  return (
    <DashboardLayout>
      <AuditView />
    </DashboardLayout>
  )
}
