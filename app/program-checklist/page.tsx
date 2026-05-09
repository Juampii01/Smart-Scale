"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProgramTabsView } from "@/components/views/program-tabs-view"


export default function ProgramChecklistPage() {
  return (
    <DashboardLayout>
      <ProgramTabsView />
    </DashboardLayout>
  )
}
