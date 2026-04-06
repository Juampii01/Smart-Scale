import { DashboardLayout }   from "@/components/layout/dashboard-layout"
import { BusinessKPIs }      from "@/components/sections/business-kpis"
import { MoMPanel }          from "@/components/sections/mom-panel"
import { CorrelationChart }  from "@/components/sections/correlation-chart"
import { TrendCharts }       from "@/components/sections/trend-charts"

export default function PerformanceCenterPage() {
  return (
    <DashboardLayout>
      <div className="space-y-14">
        {/* 1. Snapshot del mes actual con sparklines */}
        <BusinessKPIs />

        {/* 2. ¿Qué cambió vs el mes anterior? — imposible no notarlo */}
        <MoMPanel />

        {/* 3. ¿Por qué cambió? — correlaciones acción ↔ resultado */}
        <CorrelationChart />

        {/* 4. Contexto histórico — tendencia de cada métrica */}
        <TrendCharts />
      </div>
    </DashboardLayout>
  )
}
