"use client"

import { KanbanBoard } from "@/components/tareas/KanbanBoard"

export default function TareasPage() {
  return (
    <main className="flex-1 p-6 min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <KanbanBoard />
    </main>
  )
}
