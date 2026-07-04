-- Tracking de etapas de onboarding: cuenta creada -> contrato firmado (GHL) ->
-- 3 emails (Skool, Slack, Plataforma). 1:1 con crm_clients. Se crea una fila
-- para TODO cliente nuevo desde el momento del onboarding (no solo los que ya
-- firmaron), así la UI siempre tiene algo que mostrar.
create table if not exists public.onboarding_flow (
  id                      uuid primary key default gen_random_uuid(),
  crm_client_id           uuid not null unique references public.crm_clients(id) on delete cascade,
  ghl_contact_id          text,
  contract_signed_at      timestamptz,
  email_skool_sent_at     timestamptz,
  email_skool_error       text,
  email_slack_sent_at     timestamptz,
  email_slack_error       text,
  email_platform_sent_at  timestamptz,
  email_platform_error    text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Log crudo de cada webhook de GHL recibido — auditoría + para ver el payload
-- real la primera vez que el usuario dispare un contrato de prueba.
create table if not exists public.ghl_webhook_events (
  id             uuid primary key default gen_random_uuid(),
  raw_payload    jsonb not null,
  matched_client uuid references public.crm_clients(id) on delete set null,
  processed_at   timestamptz,
  error          text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_onboarding_flow_crm_client on public.onboarding_flow(crm_client_id);
create index if not exists idx_ghl_webhook_events_created on public.ghl_webhook_events(created_at desc);

alter table public.onboarding_flow    enable row level security;
alter table public.ghl_webhook_events enable row level security;
