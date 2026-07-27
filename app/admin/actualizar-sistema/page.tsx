import { DashboardLayout }          from "@/components/layout/dashboard-layout"
import { AdminFounderSurveyView }   from "@/components/views/admin-founder-survey-view"

export const dynamic = "force-dynamic"

export default function AdminActualizarSistemaPage() {
  return (
    <DashboardLayout>
      <AdminFounderSurveyView />
    </DashboardLayout>
  )
}
