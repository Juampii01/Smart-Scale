import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { SocialConnectionView } from "@/components/views/social-connection-view"

export const dynamic = "force-dynamic"

export default function MiInstagramPage() {
  return (
    <DashboardLayout>
      <SocialConnectionView platform="instagram" />
    </DashboardLayout>
  )
}
