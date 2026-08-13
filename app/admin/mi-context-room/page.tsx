import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { TeamContextRoomView } from "@/components/views/team-context-room-view"

export const dynamic = "force-dynamic"

export default function MiContextRoomPage() {
  return (
    <DashboardLayout>
      <TeamContextRoomView />
    </DashboardLayout>
  )
}
