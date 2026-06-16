import { DashboardLayout }     from "@/components/layout/dashboard-layout"
import { BusinessKPIs }        from "@/components/sections/business-kpis"
import { PerformanceStatus }   from "@/components/sections/performance-status"

// Overview = pantalla de inicio limpia: snapshot del mes (KPIs) + estado de
// performance. Los gráficos de análisis (MoM, correlaciones, tendencias) viven
// en Performance / All Metrics para que el Overview no tenga ruido.
export default function PerformanceCenterPage() {
  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Snapshot del mes actual */}
        <BusinessKPIs />

        {/* Estado de performance por etapas */}
        <PerformanceStatus />
      </div>
    </DashboardLayout>
  )
}
