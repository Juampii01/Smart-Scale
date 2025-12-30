import { DashboardLayout } from "@/components/dashboard-layout"
import { BusinessKPIs } from "@/components/business-kpis"
import { TrendCharts } from "@/components/trend-charts"

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <BusinessKPIs />
        <TrendCharts />
      </div>
    </DashboardLayout>
  )
}
