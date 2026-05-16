-- Add setter_id (uuid → profiles) to crm_clients
-- This enables the onboarding flow to associate a client with the setter who closed them,
-- and will be used for MRR / commission tracking in the next iteration.

alter table crm_clients
  add column if not exists setter_id uuid references auth.users(id) on delete set null;

create index if not exists crm_clients_setter_id_idx on public.crm_clients (setter_id);
