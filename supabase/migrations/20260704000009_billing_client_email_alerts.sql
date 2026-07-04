-- Tracking de los emails de cobro/pago al CLIENTE (separado del tracking de
-- Slack al equipo, que ya existe en alert_sent_at/overdue_alert_sent_at) —
-- son canales independientes, uno puede fallar sin afectar al otro.
--
-- overdue_alert_snoozed_until: el admin lo carga a mano cuando ya arregló
-- algo distinto con el cliente por privado — el cron no manda el email de
-- "cuota vencida" mientras esta fecha esté en el futuro. Solo afecta el
-- email al cliente, no el aviso interno de Slack al equipo.
alter table public.crm_installments
  add column if not exists client_alert_sent_at         timestamptz,
  add column if not exists client_overdue_alert_sent_at  timestamptz,
  add column if not exists overdue_alert_snoozed_until   date;
