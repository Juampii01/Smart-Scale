-- Setter Monthly Metrics Table
-- Centralized cache for monthly metrics per setter (cash collected, MRR, commissions, etc.)
-- Populated daily via cron job to avoid expensive real-time calculations

CREATE TABLE IF NOT EXISTS setter_monthly_metrics (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setter_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month                   DATE NOT NULL,  -- YYYY-MM-01 format for grouping

  -- Real business metrics
  cash_collected          NUMERIC(12,2) NOT NULL DEFAULT 0,     -- actual paid_at installments
  total_revenue           NUMERIC(12,2) NOT NULL DEFAULT 0,     -- expected revenue (active clients)
  mrr                     NUMERIC(12,2) NOT NULL DEFAULT 0,     -- auto-calculated Monthly Recurring Revenue

  -- Acquisition channels (inbound vs outbound)
  inbound_applications    INTEGER NOT NULL DEFAULT 0,           -- daily aggregated
  outbound_leads          INTEGER NOT NULL DEFAULT 0,           -- daily aggregated

  -- Client metrics
  new_clients_added       INTEGER NOT NULL DEFAULT 0,           -- clients created this month
  active_clients          INTEGER NOT NULL DEFAULT 0,           -- clients with status='activo'
  churn_clients           INTEGER NOT NULL DEFAULT 0,           -- clients that became inactive

  -- Commission tracking
  total_commissions       NUMERIC(12,2) NOT NULL DEFAULT 0,     -- 5% of cash_collected

  -- Timestamps
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(setter_id, month)
);

ALTER TABLE setter_monthly_metrics ENABLE ROW LEVEL SECURITY;

-- Service role can read/write all metrics
CREATE POLICY "service_role_all_metrics"
  ON setter_monthly_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Setters can read their own metrics
CREATE POLICY "setters_read_own_metrics"
  ON setter_monthly_metrics
  FOR SELECT
  TO authenticated
  USING (setter_id = auth.uid());

CREATE INDEX idx_setter_monthly_metrics_setter_month
  ON setter_monthly_metrics(setter_id, month DESC);

CREATE INDEX idx_setter_monthly_metrics_month
  ON setter_monthly_metrics(month DESC);

-- Setter Commissions Table
-- Granular commission tracking per month per setter
-- Enables drill-down and audit trails

CREATE TABLE IF NOT EXISTS setter_commissions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setter_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  period                  DATE NOT NULL,  -- YYYY-MM-01 for grouping

  -- Commission breakdown
  cash_collected_basis    NUMERIC(12,2) NOT NULL,     -- the cash amount this commission is calculated from
  commission_percentage   NUMERIC(4,2) NOT NULL,      -- e.g., 5.00 for 5%
  commission_amount       NUMERIC(12,2) NOT NULL,     -- calculated amount

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                   TEXT
);

ALTER TABLE setter_commissions ENABLE ROW LEVEL SECURITY;

-- Service role can read/write commissions
CREATE POLICY "service_role_all_commissions"
  ON setter_commissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Setters can read their own commissions
CREATE POLICY "setters_read_own_commissions"
  ON setter_commissions
  FOR SELECT
  TO authenticated
  USING (setter_id = auth.uid());

CREATE INDEX idx_setter_commissions_setter_period
  ON setter_commissions(setter_id, period DESC);

CREATE INDEX idx_setter_commissions_period
  ON setter_commissions(period DESC);
