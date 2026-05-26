"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AdminCalendarView } from "@/components/views/admin-calendar-view"

export default function AdminAgendaPage() {
  return (
    <DashboardLayout>
      <AdminCalendarView />
    </DashboardLayout>
  )
}
