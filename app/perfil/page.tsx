import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProfileView } from "@/components/views/profile-view"

export const dynamic = "force-dynamic"

export default function PerfilPage() {
  return (
    <DashboardLayout>
      <ProfileView />
    </DashboardLayout>
  )
}
