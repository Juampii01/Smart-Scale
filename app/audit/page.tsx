"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AuditView } from "@/components/views/audit-view"

export default function AuditPage() {
  return (
    <DashboardLayout>
      <AuditView />
    </DashboardLayout>
  )
}
