// ─── Database row types ────────────────────────────────────────────────────────

/** Row from the monthly_reports table */
export type MonthlyReportRow = {
  id: string
  client_id: string
  month: string
  created_at?: string
  updated_at?: string
  [key: string]: any
}

/** Row from ai_diagnosis_requests + ai_diagnosis_results (joined) */
export type DiagnosisHistoryItem = {
  request_id: string
  status: string
  created_at: string | null
  updated_at: string | null
  result: string | null
}

// ─── Context types ─────────────────────────────────────────────────────────────

/** Aggregated metrics across a rolling 12-month window */
export type AnnualMetrics = {
  total_revenue: number
  [key: string]: any
} | null

export type AnnualMetricsContextType = {
  annualMetrics: AnnualMetrics
  loading: boolean
  error: string | null
}

// ─── Component prop types ──────────────────────────────────────────────────────

export type ToolItem = {
  title: string
  description: string
  href: string
  icon?: string
  badge?: string
}
