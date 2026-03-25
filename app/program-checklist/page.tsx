"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProgramChecklistView } from "@/components/views/program-checklist-view"
import { ComingSoonView } from "@/components/views/coming-soon-view"

export default function ProgramChecklistPage() {
  return (
    <DashboardLayout>
      <ComingSoonView name="Checklist de Implementación" description="Esta sección está en desarrollo, pero puedes ver y usar el checklist completo aquí abajo." />
    </DashboardLayout>
  )
}
