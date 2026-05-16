-- Extend setting_daily_logs table with new metric columns
-- Setter enters inbound_applications and outbound_leads daily
-- These are aggregated into setter_monthly_metrics

ALTER TABLE setting_daily_logs
ADD COLUMN IF NOT EXISTS inbound_applications INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS outbound_leads       INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_collected       NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS mrr_calculated       NUMERIC(12,2) DEFAULT 0;

-- Create index for daily queries (commonly filtered by date range)
CREATE INDEX IF NOT EXISTS idx_setting_daily_logs_setter_date
  ON setting_daily_logs(setter_id, date DESC);

-- Index for monthly aggregations
CREATE INDEX IF NOT EXISTS idx_setting_daily_logs_month
  ON setting_daily_logs(setter_id, date_trunc('month', date::timestamp)::date);
