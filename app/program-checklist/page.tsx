"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProgramChecklistView } from "@/components/views/program-checklist-view"


export default function ProgramChecklistPage() {
  return (
    <DashboardLayout>
      <ProgramChecklistView />
    </DashboardLayout>
  )
}
