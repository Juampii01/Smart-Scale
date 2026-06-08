import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { KanbanBoard } from "@/components/tareas/KanbanBoard"

export const dynamic = "force-dynamic"

export default function TareasPage() {
  return (
    <DashboardLayout>
      <KanbanBoard />
    </DashboardLayout>
  )
}
