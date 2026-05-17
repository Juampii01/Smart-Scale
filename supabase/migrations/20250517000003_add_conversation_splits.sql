-- Add inbound/outbound conversation split columns to setting_daily_logs
-- Splits the "new_conversations" metric into inbound (from applications) and outbound (proactive contacts)

alter table public.setting_daily_logs
  add column if not exists new_conversations_inbound integer not null default 0,
  add column if not exists new_conversations_outbound integer not null default 0;

-- Create index for filtering by conversation type
create index if not exists setting_daily_logs_convos_idx
  on public.setting_daily_logs (date, setter_id, new_conversations_inbound, new_conversations_outbound);
