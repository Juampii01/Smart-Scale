import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { LlenarView } from "@/components/views/llenar-view"

export const dynamic = "force-dynamic"

export default function LlenarPage() {
  return (
    <DashboardLayout>
      <LlenarView />
    </DashboardLayout>
  )
}
