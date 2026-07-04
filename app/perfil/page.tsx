import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ContextRoomView } from "@/components/views/context-room-view"

export const dynamic = "force-dynamic"

export default function PerfilPage() {
  return (
    <DashboardLayout>
      <ContextRoomView />
    </DashboardLayout>
  )
}
