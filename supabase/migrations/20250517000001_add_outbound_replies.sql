-- Add outbound_replies column to setting_daily_logs
-- Tracks replies received to outbound leads (separate from all conversations_replied)

ALTER TABLE setting_daily_logs
ADD COLUMN IF NOT EXISTS outbound_replies INTEGER DEFAULT 0;

-- Update documentation comment
COMMENT ON COLUMN setting_daily_logs.outbound_replies IS 'Number of replies received to outbound leads sent today';
