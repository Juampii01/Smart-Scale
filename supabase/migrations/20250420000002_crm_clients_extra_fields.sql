-- Add extra fields from onboarding form
alter table crm_clients
  add column if not exists setter       text,
  add column if not exists closer       text,
  add column if not exists programa     text,
  add column if not exists forma_pago   text,
  add column if not exists total_amount numeric(12,2);

-- Additional client profile fields
alter table crm_clients
  add column if not exists address            text,
  add column if not exists dashboard_email    text,
  add column if not exists dashboard_password text;
