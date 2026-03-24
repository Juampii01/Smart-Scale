"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ComingSoonView } from "@/components/views/coming-soon-view"

export default function AuditPage() {
  return (
    <DashboardLayout>
      <ComingSoonView name="Audit" />
    </DashboardLayout>
  )
}
