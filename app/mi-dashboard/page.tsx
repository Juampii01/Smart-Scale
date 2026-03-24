import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { BusinessKPIs } from "@/components/sections/business-kpis";
import { TrendCharts } from "@/components/sections/trend-charts";

export default function MiDashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-6">Mi Dashboard Personalizado</h1>
        <BusinessKPIs />
        <TrendCharts />
      </div>
    </DashboardLayout>
  );
}
