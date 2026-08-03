import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminFounderCheckinsView } from "@/components/views/admin-founder-checkins-view"

export const dynamic = "force-dynamic"

export default function FounderCheckinsPage() {
  return (
    <DashboardLayout>
      <AdminFounderCheckinsView />
    </DashboardLayout>
  )
}
