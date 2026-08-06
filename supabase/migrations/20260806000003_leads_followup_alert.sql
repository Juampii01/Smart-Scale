-- Trackea si ya se avisó (Zapier → Slack) el seguimiento vigente de un lead,
-- para que el cron diario no mande el mismo aviso todos los días. Se resetea
-- a null cada vez que se carga una fecha de seguimiento nueva (ver PATCH en
-- app/api/admin/leads/route.ts) para que la fecha nueva vuelva a disparar.
alter table public.leads add column if not exists follow_up_alert_sent_at timestamptz;
