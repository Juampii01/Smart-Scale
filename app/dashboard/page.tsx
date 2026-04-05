import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { BusinessKPIs } from "@/components/sections/business-kpis";
import { TrendCharts } from "@/components/sections/trend-charts";

export default function PerformanceCenterPage() {
  return (
    <DashboardLayout>
      <div className="space-y-10">
        <BusinessKPIs />
        <TrendCharts />
      </div>
    </DashboardLayout>
  );
}
