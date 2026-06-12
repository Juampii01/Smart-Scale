import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { RenovacionView } from "@/components/views/renovacion-view"

export const dynamic = "force-dynamic"

export default function RenovacionPage() {
  return (
    <DashboardLayout>
      <RenovacionView />
    </DashboardLayout>
  )
}
