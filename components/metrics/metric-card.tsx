"use client"

import { ReactNode } from "react"
import { Card } from "@/components/ui/card"

export interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: {
    direction: "up" | "down" | "neutral"
    percentage: number
  }
  className?: string
  children?: ReactNode
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
  children,
}: MetricCardProps) {
  return (
    <Card className={`p-6 ${className || ""}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {trend && (
              <div
                className={`text-xs font-semibold ${
                  trend.direction === "up"
                    ? "text-green-600 dark:text-green-400"
                    : trend.direction === "down"
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}{" "}
                {trend.percentage.toFixed(1)}%
              </div>
            )}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {icon && <div className="ml-4 text-2xl opacity-50">{icon}</div>}
      </div>
      {children && <div className="mt-4 pt-4 border-t border-border">{children}</div>}
    </Card>
  )
}

/**
 * Metric Card Grid - responsive grid for metric cards
 */
export function MetricCardGrid({
  children,
  columns = 4,
}: {
  children: ReactNode
  columns?: 1 | 2 | 3 | 4 | 5 | 6
}) {
  const gridClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  }

  return <div className={`grid gap-4 ${gridClasses[columns]}`}>{children}</div>
}
