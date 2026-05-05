-- ============================================================================
-- Subscription billing — clientes con plan mensual auto-renovable
-- ============================================================================
-- Marca clientes que tienen un plan mensual recurrente. El cron diario
-- /api/cron/billing-alerts:
--   - Crea la siguiente cuota cuando la última está paga.
--   - Manda alerta a Slack 5 días antes del vencimiento (una vez por cuota).

alter table public.crm_clients
  add column if not exists is_monthly_subscription boolean not null default false;

alter table public.crm_installments
  add column if not exists alert_sent_at timestamptz;

create index if not exists crm_clients_monthly_idx
  on public.crm_clients (is_monthly_subscription)
  where is_monthly_subscription = true;

notify pgrst, 'reload schema';
