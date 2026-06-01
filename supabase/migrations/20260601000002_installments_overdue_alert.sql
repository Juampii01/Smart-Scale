-- Trackear las alertas de cuotas VENCIDAS por separado de las de aviso previo.
--
-- alert_sent_at      → se setea cuando se manda el aviso "5 días antes"
-- overdue_alert_sent_at → se setea cuando se manda el aviso de cuota ya vencida
--
-- Tenerlas separadas permite que una cuota reciba (a) un aviso previo y luego
-- (b) un aviso de vencida, sin que uno bloquee al otro. Cada uno se manda una
-- sola vez para no spamear.

ALTER TABLE public.crm_installments
  ADD COLUMN IF NOT EXISTS overdue_alert_sent_at timestamptz;

COMMENT ON COLUMN public.crm_installments.overdue_alert_sent_at IS
  'Timestamp del aviso de cuota vencida (NULL = todavía no se avisó). Separado de alert_sent_at que es el aviso previo.';
