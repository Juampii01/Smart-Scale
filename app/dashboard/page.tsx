import { DashboardLayout } from "@/components/dashboard-layout";
import { BusinessKPIs } from "@/components/business-kpis";
import { TrendCharts } from "@/components/trend-charts";

export default function PerformanceCenterPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold mb-6">Performance Center</h1>
        <BusinessKPIs />
        <TrendCharts />
      </div>
    </DashboardLayout>
  );
}
