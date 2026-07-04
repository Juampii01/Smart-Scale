import { DashboardLayout }   from "@/components/layout/dashboard-layout"
import { AnnKnowledgeView } from "@/components/views/ann-knowledge-view"

export const dynamic = "force-dynamic"

export default function AnnKnowledgePage() {
  return (
    <DashboardLayout>
      <AnnKnowledgeView />
    </DashboardLayout>
  )
}
