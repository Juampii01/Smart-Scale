import { DashboardLayout }     from "@/components/layout/dashboard-layout"
import { OverviewHero }        from "@/components/sections/overview-hero"
import { PerformanceStatus }   from "@/components/sections/performance-status"

// Overview = pantalla de inicio limpia: snapshot del mes (KPIs) + estado de
// performance. Los gráficos de análisis (MoM, correlaciones, tendencias) viven
// en Performance / All Metrics para que el Overview no tenga ruido.
export default function PerformanceCenterPage() {
  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Saludo + revenue destacado + métricas clave */}
        <OverviewHero />

        {/* Estado de performance por etapas */}
        <PerformanceStatus />
      </div>
    </DashboardLayout>
  )
}
