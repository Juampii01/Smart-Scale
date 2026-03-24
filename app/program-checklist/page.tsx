"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ComingSoonView } from "@/components/views/coming-soon-view"

export default function ProgramChecklistPage() {
  return (
    <DashboardLayout>
      <ComingSoonView name="Program Journey Checklist" />
    </DashboardLayout>
  )
}
