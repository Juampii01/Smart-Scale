import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminOnboardingView } from "@/components/views/admin-onboarding-view"

export const dynamic = "force-dynamic"

export default function AdminOnboardingPage() {
  return (
    <DashboardLayout>
      <AdminOnboardingView />
    </DashboardLayout>
  )
}
