-- ─── Event Queue ──────────────────────────────────────────────────────────────
-- outbound_events: queue for async integrations (Slack, Airtable, etc.)
CREATE TABLE IF NOT EXISTS outbound_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        text NOT NULL,          -- e.g. 'monthly_report.completed', 'sale.registered'
  payload           jsonb NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed | cancelled
  attempts          int NOT NULL DEFAULT 0,
  max_attempts      int NOT NULL DEFAULT 3,
  error_message     text,
  client_id         uuid,
  user_id           uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  next_retry_at     timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_outbound_events_status_retry
  ON outbound_events (status, next_retry_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_outbound_events_client_id
  ON outbound_events (client_id);

ALTER TABLE outbound_events ENABLE ROW LEVEL SECURITY;

-- Admins (service role) can manage all; authenticated users can see their own
CREATE POLICY "Service role full access on outbound_events"
  ON outbound_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own events"
  ON outbound_events FOR SELECT
  USING (auth.uid() = user_id);

-- ─── Event Logs ───────────────────────────────────────────────────────────────
-- event_logs: per-attempt log entries for traceability and debugging
CREATE TABLE IF NOT EXISTS event_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES outbound_events(id) ON DELETE CASCADE,
  level       text NOT NULL DEFAULT 'info',   -- info | warn | error
  message     text NOT NULL,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_event_id
  ON event_logs (event_id);

ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on event_logs"
  ON event_logs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own event logs"
  ON event_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outbound_events oe
      WHERE oe.id = event_logs.event_id
        AND oe.user_id = auth.uid()
    )
  );

-- ─── updated_at trigger for outbound_events ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_outbound_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outbound_events_updated_at ON outbound_events;
CREATE TRIGGER trg_outbound_events_updated_at
  BEFORE UPDATE ON outbound_events
  FOR EACH ROW EXECUTE FUNCTION update_outbound_events_updated_at();

-- ─── Helper: get next batch of pending events ─────────────────────────────────
CREATE OR REPLACE FUNCTION get_pending_events(batch_size int DEFAULT 10)
RETURNS SETOF outbound_events
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT *
    FROM outbound_events
    WHERE status IN ('pending', 'failed')
      AND next_retry_at <= now()
      AND attempts < max_attempts
    ORDER BY next_retry_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED;
END;
$$;
