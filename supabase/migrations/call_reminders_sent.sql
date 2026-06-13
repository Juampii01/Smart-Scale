-- Control de avisos de llamadas ya enviados (evita duplicados con el cron cada 5 min)
CREATE TABLE IF NOT EXISTS call_reminders_sent (
  id        bigserial PRIMARY KEY,
  event_id  uuid NOT NULL,
  call_date date NOT NULL,
  kind      text NOT NULL,          -- 'morning' | '5min'
  sent_at   timestamptz DEFAULT now() NOT NULL,
  UNIQUE (event_id, call_date, kind)
);

ALTER TABLE call_reminders_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_reminders_block_direct" ON call_reminders_sent FOR SELECT USING (false);
