"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MetricsOverviewPanel } from "./metrics-overview-panel"
import { MetricsCommissionsPanel } from "./metrics-commissions-panel"
import { ArrowDownUp, BarChart3, DollarSign, Users } from "lucide-react"

export interface MetricsContainerProps {
  setterId: string
}

export function MetricsContainer({ setterId }: MetricsContainerProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return now.toISOString().slice(0, 7) + "-01"
  })

  const handlePreviousMonth = () => {
    const date = new Date(selectedMonth)
    date.setMonth(date.getMonth() - 1)
    setSelectedMonth(date.toISOString().slice(0, 7) + "-01")
  }

  const handleNextMonth = () => {
    const date = new Date(selectedMonth)
    date.setMonth(date.getMonth() + 1)
    setSelectedMonth(date.toISOString().slice(0, 7) + "-01")
  }

  const monthName = new Date(selectedMonth).toLocaleString("es-AR", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Metrics</h2>
          <p className="text-sm text-muted-foreground">
            Performance metrics for {monthName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousMonth}
            className="px-3 py-1 text-sm rounded border border-border hover:bg-muted transition-colors"
          >
            ←
          </button>
          <span className="text-sm font-medium min-w-fit">{monthName}</span>
          <button
            onClick={handleNextMonth}
            disabled={selectedMonth === new Date().toISOString().slice(0, 7) + "-01"}
            className="px-3 py-1 text-sm rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            →
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Revenue</span>
          </TabsTrigger>
          <TabsTrigger value="acquisition" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Acquisition</span>
          </TabsTrigger>
          <TabsTrigger value="commissions" className="flex items-center gap-2">
            <ArrowDownUp className="h-4 w-4" />
            <span className="hidden sm:inline">Commissions</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <MetricsOverviewPanel setterId={setterId} month={selectedMonth} />
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue">
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">Revenue charts coming soon...</p>
          </div>
        </TabsContent>

        {/* Acquisition Tab */}
        <TabsContent value="acquisition">
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">Acquisition metrics coming soon...</p>
          </div>
        </TabsContent>

        {/* Commissions Tab */}
        <TabsContent value="commissions">
          <MetricsCommissionsPanel setterId={setterId} month={selectedMonth} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
